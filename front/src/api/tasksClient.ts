import { z } from "zod";
import type { TaskStatus, TaskSummary } from "../types";
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

const tasksPageSchema = z.object({
  items: z.array(taskSchema),
  total: z.number().int().nonnegative(),
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
