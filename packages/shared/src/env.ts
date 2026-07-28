import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { z } from "zod";
import { DEFAULT_AI_GATEWAY_MODEL } from "./model-config";

export const env = createEnv({
  server: {
    SENDBLUE_API_KEY: z.string().min(1),
    SENDBLUE_API_SECRET: z.string().min(1),
    SENDBLUE_FROM_NUMBER: z.string().min(1),
    SENDBLUE_WEBHOOK_SECRET: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().url().optional(),
    AI_GATEWAY_API_KEY: z.string().min(1),
    AI_GATEWAY_DEFAULT_MODEL: z.string().min(1).default(DEFAULT_AI_GATEWAY_MODEL),
    AI_GATEWAY_MEMORY_MODEL: z.string().min(1).optional(),
    ENCRYPTION_KEY: z.string().length(64),
    CRON_SECRET: z.string().min(1).optional(),
  },
  extends: [vercel()],
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
