import { createTool } from "@mastra/core/tools";
import {
  deleteAllProducts,
  deleteProduct,
  getAllProducts,
  getProduct,
  saveProduct,
  saveRoutineEntry,
} from "@skintext/db";
import { localDateString } from "@skintext/shared";
import { z } from "zod";
import { getSkintextRuntime } from "../runtime";
import { productInputSchema, routineSlotSchema } from "./schemas";

export const saveProductTool = createTool({
  id: "save-product",
  description:
    "Save a skincare product for future routine logging. Use this after reading a product label or when the user tells you a product they use.",
  inputSchema: z.object({
    product: productInputSchema,
    source: z.enum(["photo", "text", "manual"]),
  }),
  execute: async ({ product, source }, context) => {
    const { userId } = getSkintextRuntime(context.requestContext);
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

export const listProductsTool = createTool({
  id: "list-products",
  description: "List all saved skincare products for the user.",
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const { userId } = getSkintextRuntime(context.requestContext);
    const products = await getAllProducts(userId);
    if (products.length === 0) {
      return { products: [], message: "No products saved yet." };
    }
    return { products };
  },
});

export const deleteProductTool = createTool({
  id: "delete-saved-product",
  description: "Delete one saved skincare product after the user clearly asks to forget it.",
  inputSchema: z.object({
    productId: z.string(),
  }),
  execute: async ({ productId }, context) => {
    const { userId } = getSkintextRuntime(context.requestContext);
    const product = await getProduct(userId, productId);
    if (!product) return { deleted: false, message: "Saved product not found." };
    await deleteProduct(userId, productId);
    return { deleted: true, productId, name: product.name };
  },
});

export const deleteAllProductsTool = createTool({
  id: "delete-all-saved-products",
  description: "Delete all saved skincare products. Require explicit confirmation.",
  inputSchema: z.object({
    confirmed: z.boolean(),
  }),
  execute: async ({ confirmed }, context) => {
    if (!confirmed) {
      return {
        deleted: false,
        warning:
          "This permanently deletes every saved product but does not delete routine logs or conversation history. Ask the user to confirm.",
      };
    }
    const { userId } = getSkintextRuntime(context.requestContext);
    const products = await getAllProducts(userId);
    await deleteAllProducts(userId);
    return { deleted: true, count: products.length };
  },
});

export const logProductUseTool = createTool({
  id: "log-product-use",
  description:
    "Log a saved or named skincare product as used in a morning/evening/custom routine slot.",
  inputSchema: z.object({
    slot: routineSlotSchema,
    productId: z.string().optional().describe("Saved product ID, if available"),
    productName: z.string().optional().describe("Product name if not saved yet"),
    completed: z.boolean().default(true),
    reaction: z.string().optional(),
    notes: z.string().optional(),
  }),
  execute: async ({ slot, productId, productName, completed, reaction, notes }, context) => {
    const { userId, timezone } = getSkintextRuntime(context.requestContext);
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
