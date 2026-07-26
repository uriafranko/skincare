import { env } from "@skintext/shared";
import { initLogger } from "evlog";
import { type EvlogVariables, evlog } from "evlog/hono";
import { Hono } from "hono";
import { handleIncoming } from "@/handler";
import { markRead, parseInbound } from "@/sendblue";
import { pruneExpiredUserImageBlobs } from "@/user-images";

initLogger({ env: { service: "skintext" } });

const app = new Hono<EvlogVariables>();
app.use(evlog());

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

app.post("/webhooks/sendblue", async (c) => {
  const log = c.get("log");

  try {
    const msg = parseInbound(c.req.raw.headers, await c.req.json());
    if (!msg) return c.json({ ok: true });

    const readReceipt = markRead(msg.phone).catch((error) => {
      log.error(error as Error);
    });
    await handleIncoming(msg.phone, msg.text, msg.imageUrl, msg.messageId);
    await readReceipt;
    return c.json({ ok: true });
  } catch (error) {
    log.error(error as Error);
    return c.json({ error: "webhook failed" }, 500);
  }
});

export default app;
