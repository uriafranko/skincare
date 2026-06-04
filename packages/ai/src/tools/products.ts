import { getAllProducts, getProduct, saveProduct, saveRoutineEntry } from "@skintext/db";
import { localDateString } from "@skintext/shared";
import { tool } from "ai";
import { z } from "zod";
import { productInputSchema, routineSlotSchema } from "./schemas";

export const saveProductTool = tool({
  description:
    "Save a skincare product for future routine logging. Use this after reading a product label or when the user tells you a product they use.",
  inputSchema: z.object({
    userId: z.string(),
    product: productInputSchema,
    source: z.enum(["photo", "text", "manual"]),
  }),
  execute: async ({ userId, product, source }) => {
    const id = `product_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await saveProduct({
      id,
      userId,
      name: product.name,
      brand: product.brand,
      category: product.category,
      ingredients: product.ingredients ?? [],
      notes: product.notes,
      source,
      createdAt: new Date().toISOString(),
    });

    return { saved: true, productId: id, name: product.name, category: product.category ?? null };
  },
});

export const listProductsTool = tool({
  description: "List all saved skincare products for the user.",
  inputSchema: z.object({
    userId: z.string(),
  }),
  execute: async ({ userId }) => {
    const products = await getAllProducts(userId);
    if (products.length === 0) {
      return { products: [], message: "No products saved yet." };
    }
    return { products };
  },
});

export const logProductUseTool = tool({
  description:
    "Log a saved or named skincare product as used in a morning/evening/custom routine slot.",
  inputSchema: z.object({
    userId: z.string(),
    timezone: z.string(),
    slot: routineSlotSchema,
    productId: z.string().optional().describe("Saved product ID, if available"),
    productName: z.string().optional().describe("Product name if not saved yet"),
    completed: z.boolean().default(true),
    reaction: z.string().optional(),
    notes: z.string().optional(),
  }),
  execute: async ({
    userId,
    timezone,
    slot,
    productId,
    productName,
    completed,
    reaction,
    notes,
  }) => {
    const product = productId ? await getProduct(userId, productId) : null;
    const name = product?.name ?? productName;
    if (!name) {
      return { logged: false, message: "No product name or saved product ID provided." };
    }

    const localDate = localDateString(timezone);
    const id = `routine_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await saveRoutineEntry({
      id,
      userId,
      slot,
      completed,
      reaction,
      notes,
      source: "manual",
      steps: [
        {
          name: product?.category ?? "product use",
          category: product?.category,
          productId: product?.id ?? productId,
          productName: name,
          notes,
        },
      ],
      timestamp: new Date().toISOString(),
      localDate,
    });

    return {
      logged: true,
      entryId: id,
      slot,
      productId: product?.id ?? productId ?? null,
      productName: name,
      localDate,
    };
  },
});
