import { mock } from "bun:test";
import { createSharedMock } from "./shared-mock";

mock.module("@skintext/shared", () => createSharedMock());
