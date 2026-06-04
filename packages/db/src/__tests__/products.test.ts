import { describe, expect, mock, test } from "bun:test";
import { createFakeDb } from "./fake-db";
import { createSharedMock } from "./shared-mock";

const fakeDb = createFakeDb();

mock.module("../client", () => ({
  getDb: () => fakeDb,
}));

mock.module("@skintext/shared", () => createSharedMock());

const { deleteProduct, getAllProducts, getProduct, saveProduct } = await import("../products");

describe("products", () => {
  test("saves and retrieves products", async () => {
    await saveProduct({
      id: "product_1",
      userId: "usr_test",
      name: "Gentle Cleanser",
      category: "cleanser",
      ingredients: ["glycerin"],
      source: "text",
      createdAt: "2026-06-04T00:00:00.000Z",
    });

    const product = await getProduct("usr_test", "product_1");
    expect(product?.name).toBe("Gentle Cleanser");

    const all = await getAllProducts("usr_test");
    expect(all).toHaveLength(1);
  });

  test("deletes products", async () => {
    await deleteProduct("usr_test", "product_1");
    expect(await getProduct("usr_test", "product_1")).toBeNull();
  });
});
