import type { Badge } from "./Primitives";
import type { AgentRunStatus, ArtifactStatus, HealthStatus, TaskStatus } from "../types";

type BadgeTone = Parameters<typeof Badge>[0]["tone"];

export function statusTone(
  status: AgentRunStatus | ArtifactStatus | HealthStatus | TaskStatus,
): BadgeTone {
  if (status === "Healthy" || status === "Done" || status === "Completed" || status === "Accepted") {
    return "success";
  }

  if (status === "Blocked" || status === "Failed" || status === "Stale") {
    return "danger";
  }

  if (status === "Watch" || status === "Review" || status === "ReviewRequired" || status === "QA") {
    return "warning";
  }

  if (status === "InProgress" || status === "Proposed") {
    return "accent";
  }

  return "neutral";
}
