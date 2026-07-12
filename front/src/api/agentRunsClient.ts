import { z } from "zod";
import type { AgentRunSummary } from "../types";
import { apiJson, ApiClientError } from "./http";

const agentRunSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["Completed", "Failed", "ReviewRequired"]),
  provider: z.string().min(1),
  model: z.string().min(1),
  agentName: z.string().min(1),
  taskId: z.string().min(1),
  changedFiles: z.array(z.string().min(1)),
  evidenceCount: z.number().int().nonnegative(),
  unresolvedCount: z.number().int().nonnegative(),
  requiresReview: z.boolean(),
});

const agentRunsPageSchema = z.object({
  items: z.array(agentRunSchema),
  total: z.number().int().nonnegative(),
});

export async function requestAgentRuns(signal?: AbortSignal): Promise<readonly AgentRunSummary[]> {
  const payload = await apiJson("api/agent-runs", { signal });

  try {
    return agentRunsPageSchema.parse(payload).items;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiClientError("Agent runs response did not match the API contract.", {
        code: "INVALID_AGENT_RUNS_RESPONSE",
        status: null,
      });
    }

    throw error;
  }
}

export async function requestAgentRun(runId: string, signal?: AbortSignal): Promise<AgentRunSummary> {
  const payload = await apiJson(`api/agent-runs/${encodeURIComponent(runId)}`, { signal });

  try {
    return agentRunSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiClientError("Agent run detail response did not match the API contract.", {
        code: "INVALID_AGENT_RUN_RESPONSE",
        status: null,
      });
    }

    throw error;
  }
}
