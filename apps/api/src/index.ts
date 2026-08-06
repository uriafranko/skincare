import { env } from "@skintext/shared";
import { waitUntil } from "@vercel/functions";
import { initLogger } from "evlog";
import { type EvlogVariables, evlog } from "evlog/hono";
import { Hono } from "hono";
import { handleIncoming } from "@/handler";
import { errorForLogging } from "@/logging";
import { capturePostHogException } from "@/posthog";
import { reminderRunManager } from "@/reminder-runs";
import { markRead, parseInbound } from "@/sendblue";
import { pruneExpiredUserImageBlobs } from "@/user-images";

initLogger({ env: { service: "skintext" } });

const app = new Hono<EvlogVariables>();
app.use(evlog());

app.onError((error, c) => {
  capturePostHogException(error);
  c.get("log").error(errorForLogging(error));
  return c.json({ error: "internal server error" }, 500);
});

app.get("/health", (c) => c.json({ status: "ok", service: "skintext" }));

app.get("/cron/prune-images", async (c) => {
  if (env.CRON_SECRET) {
    const auth = c.req.header("Authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) return c.json({ error: "unauthorized" }, 401);
  } else if (process.env.NODE_ENV === "production") {
    return c.json({ error: "CRON_SECRET is required in production" }, 401);
  }

  const result = await pruneExpiredUserImageBlobs(c.get("log"));
  return c.json({ ok: true, ...result });
});

app.get("/cron/migrate-reminder-runs", async (c) => {
  if (env.CRON_SECRET) {
    const auth = c.req.header("Authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) return c.json({ error: "unauthorized" }, 401);
  } else if (process.env.NODE_ENV === "production") {
    return c.json({ error: "CRON_SECRET is required in production" }, 401);
  }

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
    waitUntil(
      Promise.all([
        markRead(msg.phone).catch((error) => {
          capturePostHogException(error);
          log.error(errorForLogging(error));
        }),
        handleIncoming(msg.phone, msg.text, msg.imageUrl, msg.messageId),
      ]).catch((error) => {
        capturePostHogException(error);
        log.error(errorForLogging(error));
      }),
    );
    return c.json({ ok: true });
  } catch (error) {
    capturePostHogException(error);
    log.error(errorForLogging(error));
    return c.json({ error: "webhook failed" }, 500);
  }
});

export default app;
