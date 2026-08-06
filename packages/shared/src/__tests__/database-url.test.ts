import { describe, expect, test } from "bun:test";
import { normalizePostgresConnectionString } from "../database-url";

describe("normalizePostgresConnectionString", () => {
  test("makes legacy pg SSL aliases explicit", () => {
    expect(
      normalizePostgresConnectionString(
        "postgresql://user:password@host/db?channel_binding=require&sslmode=require",
      ),
    ).toBe("postgresql://user:password@host/db?channel_binding=require&sslmode=verify-full");
  });

  test("leaves explicit and non-Postgres URLs unchanged", () => {
    expect(normalizePostgresConnectionString("postgresql://host/db?sslmode=verify-full")).toBe(
      "postgresql://host/db?sslmode=verify-full",
    );
    expect(normalizePostgresConnectionString("not-a-url")).toBe("not-a-url");
  });
});
