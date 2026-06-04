import { describe, expect, mock, test } from "bun:test";

const hashStore: Record<string, Record<string, string>> = {};

const mockRedis = {
  hset: mock((key: string, value: Record<string, string>) => {
    hashStore[key] = { ...(hashStore[key] ?? {}), ...value };
    return Promise.resolve(1);
  }),
  hget: mock((key: string, field: string) => Promise.resolve(hashStore[key]?.[field] ?? null)),
  hgetall: mock((key: string) => Promise.resolve(hashStore[key] ?? null)),
  hdel: mock((key: string, field: string) => {
    if (hashStore[key]) delete hashStore[key][field];
    return Promise.resolve(1);
  }),
  del: mock((key: string) => {
    delete hashStore[key];
    return Promise.resolve(1);
  }),
};

mock.module("../client", () => ({
  getRedis: () => mockRedis,
}));

mock.module("@skintext/shared", () => ({
  encryptContent: async (s: string) => `enc:${s}`,
  decrypt: async (s: string) => s.replace(/^enc:/, ""),
}));

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
