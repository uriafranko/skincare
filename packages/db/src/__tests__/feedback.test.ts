import { describe, expect, mock, test } from "bun:test";
import * as schema from "../schema";
import { createFakeDb } from "./fake-db";
import { createSharedMock } from "./shared-mock";

const fakeDb = createFakeDb();

mock.module("../client", () => ({
  getDb: () => fakeDb,
}));

mock.module("@skintext/shared", () => createSharedMock());

const { getUserFeedback, listUserFeedback, saveUserFeedback } = await import("../feedback");

describe("user feedback", () => {
  test("stores feedback content and keeps it correlated to the user", async () => {
    await saveUserFeedback({
      id: "feedback_1",
      userId: "usr_feedback",
      kind: "request",
      message: "I wish Lily could compare two photos side by side.",
    });

    const [stored] = fakeDb.rows(schema.userFeedback);
    expect(stored).toEqual(
      expect.objectContaining({
        id: "feedback_1",
        userId: "usr_feedback",
        kind: "request",
        message: "I wish Lily could compare two photos side by side.",
        status: "new",
      }),
    );

    const feedback = await getUserFeedback("feedback_1");
    expect(feedback).toEqual(
      expect.objectContaining({
        id: "feedback_1",
        userId: "usr_feedback",
        kind: "request",
        message: "I wish Lily could compare two photos side by side.",
        status: "new",
      }),
    );
  });

  test("lists only feedback belonging to the requested user", async () => {
    await saveUserFeedback({
      id: "feedback_2",
      userId: "usr_other",
      kind: "issue",
      message: "My reminder did not arrive.",
    });

    const feedback = await listUserFeedback("usr_feedback");
    expect(feedback.map((item) => item.id)).toEqual(["feedback_1"]);
  });
});
