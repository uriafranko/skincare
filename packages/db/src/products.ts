import type { ProductEntry } from "@skintext/shared";
import { decrypt, encryptContent } from "@skintext/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { products } from "./schema";

async function encodeProduct(product: ProductEntry): Promise<string> {
  return encryptContent(JSON.stringify(product));
}

async function decodeProduct(raw: string): Promise<ProductEntry> {
  return JSON.parse(await decrypt(raw)) as ProductEntry;
}

export async function saveProduct(product: ProductEntry): Promise<void> {
  const value = await encodeProduct(product);
  await getDb()
    .insert(products)
    .values({ id: product.id, userId: product.userId, value, createdAt: product.createdAt })
    .onConflictDoUpdate({
      target: products.id,
      set: {
        userId: product.userId,
        value,
        createdAt: product.createdAt,
        updatedAt: sql`now()`,
      },
    });
}

export async function getProduct(userId: string, productId: string): Promise<ProductEntry | null> {
  const row = await getDb().query.products.findFirst({
    where: and(eq(products.userId, userId), eq(products.id, productId)),
  });
  if (!row) return null;
  return decodeProduct(row.value);
}

export async function getAllProducts(userId: string): Promise<ProductEntry[]> {
  const rows = await getDb().query.products.findMany({
    where: eq(products.userId, userId),
    orderBy: asc(products.createdAt),
  });

  const entries: ProductEntry[] = [];
  for (const row of rows) {
    entries.push(await decodeProduct(row.value));
  }
  return entries;
}

export async function deleteProduct(userId: string, productId: string): Promise<void> {
  await getDb()
    .delete(products)
    .where(and(eq(products.userId, userId), eq(products.id, productId)));
}

export async function deleteAllProducts(userId: string): Promise<void> {
  await getDb().delete(products).where(eq(products.userId, userId));
}
