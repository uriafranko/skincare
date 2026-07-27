import { mock } from "bun:test";
import { createSharedMock } from "../../workflows/__tests__/shared-mock";

mock.module("@skintext/shared", () =>
  createSharedMock({
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      SENDBLUE_WEBHOOK_SECRET: "test",
    },
  }),
);
