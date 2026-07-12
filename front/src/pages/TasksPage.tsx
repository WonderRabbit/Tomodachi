import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowRight, GitBranch, PlayCircle } from "lucide-react";
import { requestTaskContext, requestTasks } from "../api/tasksClient";
import { isApiClientError } from "../api/http";
import { Badge, Card, EmptyState, PageHeader } from "../components/Primitives";
import { statusTone } from "../components/status";
import type { TaskContext, TaskSummary } from "../types";
import { useUnauthorizedRedirect } from "./authRedirect";

export function TasksPage() {
  const navigate = useNavigate();
  const tasksQuery = useQuery({
    queryFn: ({ signal }) => requestTasks(signal),
    queryKey: ["tasks"],
    retry: false,
  });

  useUnauthorizedRedirect(tasksQuery.error, navigate);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Lifecycle"
        title="Tasks"
        detail="Cross-project execution table backed by the Tomodachi API."
        actions={<Badge tone="accent">backend task list</Badge>}
      />
      <Card title="All tasks">
        <TasksContent
          error={tasksQuery.error}
          isLoading={tasksQuery.isLoading}
          onRetry={() => {
            void tasksQuery.refetch();
          }}
          tasks={tasksQuery.data ?? []}
        />
      </Card>
    </div>
  );
}

export function TaskDetailPage() {
  const navigate = useNavigate();
  const { taskId } = useParams({ from: "/tasks/$taskId" });
  const contextQuery = useQuery({
    queryFn: ({ signal }) => requestTaskContext(taskId, signal),
    queryKey: ["task-context", taskId],
    retry: false,
  });

  useUnauthorizedRedirect(contextQuery.error, navigate);

  return (
    <TaskDetailContent
      context={contextQuery.data}
      error={contextQuery.error}
      isLoading={contextQuery.isLoading}
      onRetry={() => {
        void contextQuery.refetch();
      }}
    />
  );
}

function TasksContent({
  error,
  isLoading,
  onRetry,
  tasks,
}: {
  readonly error: Error | null;
  readonly isLoading: boolean;
  readonly onRetry: () => void;
  readonly tasks: readonly TaskSummary[];
}) {
  if (isLoading) {
    return <EmptyState title="Loading tasks" detail="Fetching task summaries from the backend." />;
  }

  if (isApiClientError(error) && error.status === 403) {
    return <EmptyState title="Forbidden" detail="Your current role cannot read task summaries." />;
  }

  if (error !== null) {
    return (
      <div className="empty-state">
        <strong>Tasks unavailable</strong>
        <span>Backend task summaries could not be loaded.</span>
        <button className="button" type="button" onClick={onRetry}>Retry</button>
      </div>
    );
  }

  if (tasks.length === 0) {
    return <EmptyState title="No tasks" detail="The backend returned an empty task list." />;
  }

  return (
    <div className="table-wrap">
      <table className="responsive-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Project</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Assignee</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td data-label="Task">
                <Link to="/tasks/$taskId" params={{ taskId: task.id }}>
                  {task.number} · {task.title}
                </Link>
              </td>
              <td data-label="Project">{task.projectId}</td>
              <td data-label="Status"><Badge tone={statusTone(task.status)}>{task.status}</Badge></td>
              <td data-label="Priority">{task.priority}</td>
              <td data-label="Assignee">{task.assignee}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskDetailContent({
  context,
  error,
  isLoading,
  onRetry,
}: {
  readonly context: TaskContext | undefined;
  readonly error: Error | null;
  readonly isLoading: boolean;
  readonly onRetry: () => void;
}) {
  if (isLoading) {
    return <EmptyState title="Loading task" detail="Fetching task context from the backend." />;
  }

  if (isApiClientError(error) && (error.status === 404 || error.code === "NOT_FOUND")) {
    return <EmptyState title="Task not found" detail="The requested task id is not available from the backend." />;
  }

  if (error !== null) {
    return (
      <div className="empty-state">
        <strong>Task unavailable</strong>
        <span>Backend task context could not be loaded.</span>
        <button className="button" type="button" onClick={onRetry}>Retry</button>
      </div>
    );
  }

  if (context === undefined) {
    return <EmptyState title="Task not found" detail="The backend did not return task context." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={context.task.number}
        title={context.task.title}
        detail={`${context.project.key} · ${context.task.assignee} · backend task context`}
        actions={<Badge tone={statusTone(context.task.status)}>{context.task.status}</Badge>}
      />
      <section className="dashboard-grid">
        <Card title="Status transition">
          <div className="transition-strip">
            <Badge>{context.task.status}</Badge>
            <ArrowRight size={16} />
            <button className="button" type="button">
              <PlayCircle size={16} />
              Start transition
            </button>
          </div>
          <p className="muted">Allowed next states: {context.statusMachine[context.task.status]?.join(", ") ?? "none"}.</p>
        </Card>
        <Card title="Context bundle">
          <p>{context.project.name} provides backend-owned project context for this task.</p>
          <Badge tone="accent">{context.rules.length} backend rules</Badge>
        </Card>
      </section>
      <Card title="Architecture links">
        <div className="list-stack">
          {context.artifacts.map((artifact) => (
            <Link key={artifact.id} to="/architecture/adr/$artifactId" params={{ artifactId: artifact.id }} className="review-row">
              <GitBranch size={17} />
              <div>
                <strong>{artifact.title}</strong>
                <span>{artifact.type} · {artifact.sourcePath}</span>
              </div>
              <Badge tone={statusTone(artifact.status)}>{artifact.status}</Badge>
            </Link>
          ))}
          {context.artifacts.length === 0 && <EmptyState title="No artifacts" detail="No backend artifacts are linked to this task yet." />}
        </div>
      </Card>
      <Card title="Agent runs">
        <div className="list-stack">
          {context.agentRuns.map((run) => (
            <Link key={run.id} to="/agent-runs/$runId" params={{ runId: run.id }} className="review-row">
              <Badge tone={statusTone(run.status)}>{run.status}</Badge>
              <div>
                <strong>{run.id}</strong>
                <span>{run.changedFiles.length} files · {run.evidenceCount} evidence · {run.unresolvedCount} unresolved</span>
              </div>
            </Link>
          ))}
          {context.agentRuns.length === 0 && <EmptyState title="No runs" detail="No backend-normalized agent runs are linked to this task yet." />}
        </div>
      </Card>
    </div>
  );
}
