import { env } from "@skintext/shared";
import { waitUntil } from "@vercel/functions";
import { createLogger, initLogger } from "evlog";
import { type EvlogVariables, evlog } from "evlog/hono";
import { Hono, type MiddlewareHandler } from "hono";
import { handleIncoming } from "@/handler";
import { reportError } from "@/logging";
import { reminderRunManager } from "@/reminder-runs";
import { markRead, parseInbound, sendTyping } from "@/sendblue";
import { pruneExpiredUserImageBlobs } from "@/user-images";

initLogger({ env: { service: "skintext" } });

const app = new Hono<EvlogVariables>();
app.use(evlog());

app.onError((error, c) => {
  reportError(c.get("log"), error);
  return c.json({ error: "internal server error" }, 500);
});

app.get("/health", (c) => c.json({ status: "ok", service: "skintext" }));

const authorizeCron: MiddlewareHandler<EvlogVariables> = async (c, next) => {
  if (env.CRON_SECRET) {
    const auth = c.req.header("Authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) return c.json({ error: "unauthorized" }, 401);
  } else if (process.env.NODE_ENV === "production") {
    return c.json({ error: "CRON_SECRET is required in production" }, 401);
  }

  await next();
};

app.use("/cron/*", authorizeCron);

app.get("/cron/prune-images", async (c) => {
  const result = await pruneExpiredUserImageBlobs(c.get("log"));
  return c.json({ ok: true, ...result });
});

app.get("/cron/migrate-reminder-runs", async (c) => {
  const result = await reminderRunManager.migrateStale(c.get("log"));
  return c.json({ ok: true, ...result });
});

app.post("/webhooks/sendblue", async (c) => {
  const log = c.get("log");

  try {
    const msg = parseInbound(c.req.raw.headers, await c.req.json());
    if (!msg) return c.json({ ok: true });

    // Acknowledge Sendblue before the slow AI/database work. Vercel keeps the
    // request alive for the background promise, while the early 200 prevents
    // inbound delivery/read-receipt state from waiting on the assistant.
    const backgroundLog = createLogger({
      scope: "webhook-background",
      provider: "sendblue",
      phone: msg.phone.slice(-4),
      messageId: msg.messageId,
    });
    waitUntil(
      Promise.all([
        sendTyping(msg.phone).catch((error) => {
          reportError(backgroundLog, error);
        }),
        markRead(msg.phone).catch((error) => {
          reportError(backgroundLog, error);
        }),
        handleIncoming(msg.phone, msg.text, msg.imageUrl, msg.messageId),
      ])
        .catch((error) => {
          reportError(backgroundLog, error);
        })
        .finally(() => backgroundLog.emit()),
    );
    return c.json({ ok: true });
  } catch (error) {
    reportError(log, error);
    return c.json({ error: "webhook failed" }, 500);
  }
});

export default app;
