export type HealthStatus = "Healthy" | "Watch" | "Blocked";

export type TaskStatus =
  | "Ready"
  | "InProgress"
  | "Blocked"
  | "Review"
  | "QA"
  | "Done";

export type Priority = "Low" | "Normal" | "High" | "Urgent";

export type ArtifactType = "ADR" | "RFC" | "API" | "Diagram";

export type ArtifactStatus = "Accepted" | "Proposed" | "Stale";

export type AgentRunStatus = "Completed" | "Failed" | "ReviewRequired";

export interface Product {
  id: string;
  code: string;
  name: string;
  status: HealthStatus;
  activeProjects: number;
  openTasks: number;
  lastActivity: string;
}

export interface Project {
  id: string;
  key: string;
  productId: string;
  name: string;
  owner: string;
  status: HealthStatus;
  progress: number;
  due: string;
  blockers: number;
  linkedArtifacts: number;
  latestAgentRunId: string;
}

export interface ProjectSummary {
  id: string;
  key: string;
  name: string;
  owner: string;
  status: HealthStatus;
  progress: number;
}

export interface Task {
  id: string;
  number: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string;
  artifacts: string[];
  agentRunIds: string[];
  updated: string;
  blockerReason?: string;
}

export interface TaskSummary {
  id: string;
  number: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string;
}

export interface ArtifactSummary {
  id: string;
  type: ArtifactType;
  title: string;
  status: ArtifactStatus;
  sourcePath: string;
  linkedTaskIds: string[];
}

export interface AgentRunSummary {
  id: string;
  status: AgentRunStatus;
  provider: string;
  model: string;
  agentName: string;
  taskId: string;
  changedFiles: string[];
  evidenceCount: number;
  unresolvedCount: number;
  requiresReview: boolean;
}

export interface TaskContext {
  task: TaskSummary;
  project: ProjectSummary;
  statusMachine: Record<TaskStatus, TaskStatus[]>;
  artifacts: ArtifactSummary[];
  agentRuns: AgentRunSummary[];
  rules: string[];
}

export type SearchResultType = "task" | "project" | "artifact" | "agent-run";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  path: string;
}

export interface DashboardProjectSummary {
  id: string;
  key: string;
  name: string;
  status: HealthStatus;
  progress: number;
  blockers: number;
}

export interface DashboardReviewRun {
  id: string;
  model: string;
  unresolvedCount: number;
}

export interface DashboardArchitectureSummary {
  acceptedArtifacts: number;
  staleArtifacts: number;
  linkedTasks: number;
}

export interface DashboardSummary {
  activeProjects: number;
  tasksInFlight: number;
  blockedTasks: number;
  blockedTaskTitle: string | null;
  agentReviewQueue: number;
  projects: DashboardProjectSummary[];
  reviewRuns: DashboardReviewRun[];
  architecture: DashboardArchitectureSummary;
}

export interface ArchitectureArtifact {
  id: string;
  type: ArtifactType;
  title: string;
  status: ArtifactStatus;
  sourcePath: string;
  linkedTaskIds: string[];
  owner: string;
  updated: string;
  summary: string;
}

export interface AgentRun {
  id: string;
  status: AgentRunStatus;
  provider: string;
  model: string;
  agentName: string;
  taskId: string;
  changedFiles: string[];
  evidenceCount: number;
  unresolvedCount: number;
  requiresReview: boolean;
  started: string;
  duration: string;
  summary: string;
}

export interface NavItem {
  label: string;
  to:
    | "/"
    | "/products"
    | "/projects"
    | "/tasks"
    | "/architecture"
    | "/agent-runs"
    | "/settings";
}
