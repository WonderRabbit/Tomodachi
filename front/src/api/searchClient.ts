import { z } from "zod";
import type { SearchResult, SearchResultType } from "../types";
import { apiJson, ApiClientError } from "./http";

const searchResultTypeSchema = z.enum(["task", "project", "artifact", "agent-run"]);

const searchResultSchema = z.object({
  type: searchResultTypeSchema,
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  path: z.string().min(1),
});

const searchResponseSchema = z.object({
  query: z.string().min(1),
  type: searchResultTypeSchema.nullable(),
  items: z.array(searchResultSchema),
  total: z.number().int().nonnegative(),
});

export async function requestSearch(
  query: string,
  type: SearchResultType | "all",
  signal?: AbortSignal,
): Promise<readonly SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (type !== "all") {
    params.set("type", type);
  }
  const payload = await apiJson(`api/search?${params.toString()}`, { signal });

  try {
    return searchResponseSchema.parse(payload).items;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiClientError("Search response did not match the API contract.", {
        code: "INVALID_SEARCH_RESPONSE",
        status: null,
      });
    }

    throw error;
  }
}
