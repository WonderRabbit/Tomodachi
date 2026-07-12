import { z } from "zod";
import type { DashboardSummary } from "../types";
import { apiJson, ApiClientError } from "./http";

const healthStatusSchema = z.enum(["Healthy", "Watch", "Blocked"]);

const dashboardSummarySchema = z.object({
  activeProjects: z.number().int().nonnegative(),
  tasksInFlight: z.number().int().nonnegative(),
  blockedTasks: z.number().int().nonnegative(),
  blockedTaskTitle: z.string().min(1).nullable(),
  agentReviewQueue: z.number().int().nonnegative(),
  projects: z.array(
    z.object({
      id: z.string().min(1),
      key: z.string().min(1),
      name: z.string().min(1),
      status: healthStatusSchema,
      progress: z.number().int().min(0).max(100),
      blockers: z.number().int().nonnegative(),
    }),
  ),
  reviewRuns: z.array(
    z.object({
      id: z.string().min(1),
      model: z.string().min(1),
      unresolvedCount: z.number().int().nonnegative(),
    }),
  ),
  architecture: z.object({
    acceptedArtifacts: z.number().int().nonnegative(),
    staleArtifacts: z.number().int().nonnegative(),
    linkedTasks: z.number().int().nonnegative(),
  }),
});

export async function requestDashboardSummary(signal?: AbortSignal): Promise<DashboardSummary> {
  const payload = await apiJson("api/dashboard/summary", { signal });

  try {
    return dashboardSummarySchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiClientError("Dashboard summary response did not match the API contract.", {
        code: "INVALID_DASHBOARD_SUMMARY_RESPONSE",
        status: null,
      });
    }

    throw error;
  }
}
