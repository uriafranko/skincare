import type { ProductEntry } from "@skintext/shared";
import { decrypt, encryptContent } from "@skintext/shared";
import { getRedis } from "./client";

const productsKey = (userId: string) => `products:${userId}`;

async function encodeProduct(product: ProductEntry): Promise<string> {
  return encryptContent(JSON.stringify(product));
}

async function decodeProduct(raw: string): Promise<ProductEntry> {
  return JSON.parse(await decrypt(raw)) as ProductEntry;
}

export async function saveProduct(product: ProductEntry): Promise<void> {
  const redis = getRedis();
  await redis.hset(productsKey(product.userId), {
    [product.id]: await encodeProduct(product),
  });
}

export async function getProduct(userId: string, productId: string): Promise<ProductEntry | null> {
  const redis = getRedis();
  const raw = await redis.hget<string>(productsKey(userId), productId);
  if (!raw || typeof raw !== "string") return null;
  return decodeProduct(raw);
}

export async function getAllProducts(userId: string): Promise<ProductEntry[]> {
  const redis = getRedis();
  const data = await redis.hgetall<Record<string, string>>(productsKey(userId));
  if (!data) return [];

  const products: ProductEntry[] = [];
  for (const raw of Object.values(data)) {
    products.push(await decodeProduct(raw));
  }
  return products.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function deleteProduct(userId: string, productId: string): Promise<void> {
  const redis = getRedis();
  await redis.hdel(productsKey(userId), productId);
}

export async function deleteAllProducts(userId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(productsKey(userId));
}
