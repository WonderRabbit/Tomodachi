import { z } from "zod";
import type { ProjectSummary } from "../types";
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

const projectsPageSchema = z.object({
  items: z.array(projectSchema),
  total: z.number().int().nonnegative(),
});

export async function requestProjects(signal?: AbortSignal): Promise<readonly ProjectSummary[]> {
  const payload = await apiJson("api/projects", { signal });

  try {
    return projectsPageSchema.parse(payload).items;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiClientError("Projects response did not match the API contract.", {
        code: "INVALID_PROJECTS_RESPONSE",
        status: null,
      });
    }

    throw error;
  }
}

export async function requestProject(projectId: string, signal?: AbortSignal): Promise<ProjectSummary> {
  const payload = await apiJson(`api/projects/${encodeURIComponent(projectId)}`, { signal });

  try {
    return projectSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiClientError("Project response did not match the API contract.", {
        code: "INVALID_PROJECT_RESPONSE",
        status: null,
      });
    }

    throw error;
  }
}
