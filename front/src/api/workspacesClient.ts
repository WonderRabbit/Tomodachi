import { z } from "zod";
import type { WorkspaceDetail } from "../types";
import { apiJson, ApiClientError } from "./http";

const healthStatusSchema = z.enum(["Healthy", "Watch", "Blocked"]);

const projectSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
  owner: z.string().min(1),
  status: healthStatusSchema,
  progress: z.number().int().min(0).max(100),
  workspaceId: z.string().min(1),
});

const workspaceSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string().min(1),
  name: z.string().min(1),
  owner: z.string().min(1),
  projectCount: z.number().int().nonnegative(),
  openTasks: z.number().int().nonnegative(),
  projects: z.array(projectSchema),
});

export async function requestWorkspace(workspaceId: string, signal?: AbortSignal): Promise<WorkspaceDetail> {
  const payload = await apiJson(`api/workspaces/${encodeURIComponent(workspaceId)}`, { signal });

  try {
    return workspaceSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiClientError("Workspace response did not match the API contract.", {
        code: "INVALID_WORKSPACE_RESPONSE",
        status: null,
      });
    }

    throw error;
  }
}
