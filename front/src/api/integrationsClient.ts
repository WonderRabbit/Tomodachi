import { z } from "zod";
import { apiJson, ApiClientError } from "./http";

export interface OpenCodeSyncSummary {
  source: string;
  status: "Attention" | "Synced";
  lastSyncLabel: string;
  totalRuns: number;
  reviewRequiredRuns: number;
  failedRuns: number;
  unresolvedEvidence: number;
  changedFiles: number;
}

const openCodeSyncSummarySchema = z.object({
  source: z.string().min(1),
  status: z.enum(["Attention", "Synced"]),
  lastSyncLabel: z.string().min(1),
  totalRuns: z.number().int().nonnegative(),
  reviewRequiredRuns: z.number().int().nonnegative(),
  failedRuns: z.number().int().nonnegative(),
  unresolvedEvidence: z.number().int().nonnegative(),
  changedFiles: z.number().int().nonnegative(),
});

export async function requestOpenCodeSyncSummary(signal?: AbortSignal): Promise<OpenCodeSyncSummary> {
  const payload = await apiJson("api/integrations/opencode/sync-summary", { signal });

  try {
    return openCodeSyncSummarySchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiClientError("OpenCode sync summary did not match the API contract.", {
        code: "INVALID_OPENCODE_SYNC_SUMMARY",
        status: null,
      });
    }

    throw error;
  }
}
