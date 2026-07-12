import { z } from "zod";
import type { Product } from "../types";
import { apiJson, ApiClientError } from "./http";

const healthStatusSchema = z.enum(["Healthy", "Watch", "Blocked"]);

const productSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  status: healthStatusSchema,
  activeProjects: z.number().int().nonnegative(),
  openTasks: z.number().int().nonnegative(),
  lastActivity: z.string().min(1),
});

const productsPageSchema = z.object({
  items: z.array(productSchema),
  total: z.number().int().nonnegative(),
});

export async function requestProducts(signal?: AbortSignal): Promise<readonly Product[]> {
  const payload = await apiJson("api/products", { signal });

  try {
    return productsPageSchema.parse(payload).items.map((product) => ({
      ...product,
      lastActivity: formatLastActivity(product.lastActivity),
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiClientError("Products response did not match the API contract.", {
        code: "INVALID_PRODUCTS_RESPONSE",
        status: null,
      });
    }

    throw error;
  }
}

function formatLastActivity(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 16).replace("T", " ");
}
