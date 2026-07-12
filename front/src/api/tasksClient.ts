import { z } from "zod";
import type { TaskContext, TaskStatus, TaskSummary } from "../types";
import { apiJson, ApiClientError } from "./http";

export const taskStatuses: readonly TaskStatus[] = [
  "Ready",
  "InProgress",
  "Blocked",
  "Review",
  "QA",
  "Done",
];

const taskStatusSchema = z.enum(taskStatuses);
const prioritySchema = z.enum(["Low", "Normal", "High", "Urgent"]);

const taskSchema = z.object({
  id: z.string().min(1),
  number: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  status: taskStatusSchema,
  priority: prioritySchema,
  assignee: z.string().min(1),
});

const healthStatusSchema = z.enum(["Healthy", "Watch", "Blocked"]);
const artifactTypeSchema = z.enum(["ADR", "RFC", "API", "Diagram"]);
const artifactStatusSchema = z.enum(["Accepted", "Proposed", "Stale"]);
const agentRunStatusSchema = z.enum(["Completed", "Failed", "ReviewRequired"]);

const projectSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
  owner: z.string().min(1),
  status: healthStatusSchema,
  progress: z.number().int().min(0).max(100),
  workspaceId: z.string().min(1),
});

const artifactSchema = z.object({
  id: z.string().min(1),
  type: artifactTypeSchema,
  title: z.string().min(1),
  status: artifactStatusSchema,
  sourcePath: z.string().min(1),
  linkedTaskIds: z.array(z.string().min(1)),
});

const agentRunSchema = z.object({
  id: z.string().min(1),
  status: agentRunStatusSchema,
  provider: z.string().min(1),
  model: z.string().min(1),
  agentName: z.string().min(1),
  taskId: z.string().min(1),
  changedFiles: z.array(z.string().min(1)),
  evidenceCount: z.number().int().nonnegative(),
  unresolvedCount: z.number().int().nonnegative(),
  requiresReview: z.boolean(),
});

const tasksPageSchema = z.object({
  items: z.array(taskSchema),
  total: z.number().int().nonnegative(),
});

const taskContextSchema = z.object({
  task: taskSchema,
  project: projectSchema,
  statusMachine: z.record(taskStatusSchema, z.array(taskStatusSchema)),
  artifacts: z.array(artifactSchema),
  agentRuns: z.array(agentRunSchema),
  rules: z.array(z.string().min(1)),
});

export async function requestTasks(signal?: AbortSignal): Promise<readonly TaskSummary[]> {
  const payload = await apiJson("api/tasks", { signal });

  try {
    return tasksPageSchema.parse(payload).items;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiClientError("Tasks response did not match the API contract.", {
        code: "INVALID_TASKS_RESPONSE",
        status: null,
      });
    }

    throw error;
  }
}

export async function requestTask(taskId: string, signal?: AbortSignal): Promise<TaskSummary> {
  const payload = await apiJson(`api/tasks/${encodeURIComponent(taskId)}`, { signal });

  try {
    return taskSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiClientError("Task response did not match the API contract.", {
        code: "INVALID_TASK_RESPONSE",
        status: null,
      });
    }

    throw error;
  }
}

export async function requestTaskContext(taskId: string, signal?: AbortSignal): Promise<TaskContext> {
  const payload = await apiJson(`api/opencode/task-context/${encodeURIComponent(taskId)}`, { signal });

  try {
    return taskContextSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiClientError("Task context response did not match the API contract.", {
        code: "INVALID_TASK_CONTEXT_RESPONSE",
        status: null,
      });
    }

    throw error;
  }
}
