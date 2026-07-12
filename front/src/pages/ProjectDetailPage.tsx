import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { requestProject } from "../api/projectsClient";
import { isApiClientError } from "../api/http";
import { requestTasks } from "../api/tasksClient";
import { Badge, Card, EmptyState, PageHeader, ProgressBar } from "../components/Primitives";
import { statusTone } from "../components/status";
import type { ProjectSummary, TaskSummary, TaskStatus } from "../types";
import { useUnauthorizedRedirect } from "./authRedirect";

export function ProjectDetailPage() {
  const navigate = useNavigate();
  const { projectId } = useParams({ from: "/projects/$projectId" });
  const projectQuery = useQuery({
    queryFn: ({ signal }) => requestProject(projectId, signal),
    queryKey: ["project", projectId],
    retry: false,
  });
  const tasksQuery = useQuery({
    queryFn: ({ signal }) => requestTasks(signal),
    queryKey: ["tasks"],
    retry: false,
  });

  useUnauthorizedRedirect(projectQuery.error ?? tasksQuery.error, navigate);

  const projectTasks = (tasksQuery.data ?? []).filter((task) => task.projectId === projectId);

  return (
    <ProjectDetailContent
      project={projectQuery.data}
      projectError={projectQuery.error}
      projectId={projectId}
      projectTasks={projectTasks}
      isLoading={projectQuery.isLoading || tasksQuery.isLoading}
      onRetry={() => {
        void projectQuery.refetch();
        void tasksQuery.refetch();
      }}
      tasksError={tasksQuery.error}
    />
  );
}

function ProjectDetailContent({
  isLoading,
  onRetry,
  project,
  projectError,
  projectId,
  projectTasks,
  tasksError,
}: {
  readonly isLoading: boolean;
  readonly onRetry: () => void;
  readonly project: ProjectSummary | undefined;
  readonly projectError: Error | null;
  readonly projectId: string;
  readonly projectTasks: readonly TaskSummary[];
  readonly tasksError: Error | null;
}) {
  if (isLoading) {
    return <EmptyState title="Loading project" detail="Fetching project detail from the backend." />;
  }

  if (isApiClientError(projectError) && (projectError.status === 404 || projectError.code === "NOT_FOUND")) {
    return <EmptyState title="Project not found" detail="The requested project id is not available from the backend." />;
  }

  if (projectError !== null || tasksError !== null) {
    return (
      <div className="empty-state">
        <strong>Project unavailable</strong>
        <span>Backend project detail could not be loaded.</span>
        <button className="button" type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (project === undefined) {
    return <EmptyState title="Project not found" detail="The backend did not return project detail." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={project.key}
        title={project.name}
        detail={`${project.owner} owns this backend project stream.`}
        actions={<Link className="button" to="/projects/$projectId/tasks/board" params={{ projectId }}>Open board</Link>}
      />
      <section className="dashboard-grid">
        <Card title="Progress">
          <ProgressBar value={project.progress} />
          <p>{project.progress}% complete from backend project summary.</p>
          <Badge tone={statusTone(project.status)}>{project.status}</Badge>
        </Card>
        <Card title="Task summary">
          <TaskCounts tasks={projectTasks} />
        </Card>
      </section>
      <Card title="Project tasks">
        <div className="status-board small-board">
          {taskStatuses.map((status) => (
            <TaskColumn key={status} status={status} tasks={projectTasks} />
          ))}
        </div>
      </Card>
    </div>
  );
}

const taskStatuses: readonly TaskStatus[] = ["Ready", "InProgress", "Blocked", "Review", "QA", "Done"];

function TaskCounts({ tasks }: { readonly tasks: readonly TaskSummary[] }) {
  const blocked = tasks.filter((task) => task.status === "Blocked").length;

  return (
    <div className="metric-grid compact">
      <Card><strong>{tasks.length}</strong><span>tasks</span></Card>
      <Card><strong>{blocked}</strong><span>blocked</span></Card>
    </div>
  );
}

function TaskColumn({ status, tasks }: { readonly status: TaskStatus; readonly tasks: readonly TaskSummary[] }) {
  const statusTasks = tasks.filter((task) => task.status === status);

  return (
    <div className="board-column">
      <h3>{status}</h3>
      {statusTasks.map((task) => (
        <Link key={task.id} to="/tasks/$taskId" params={{ taskId: task.id }} className="task-card">
          <strong>{task.number}</strong>
          <span>{task.title}</span>
        </Link>
      ))}
    </div>
  );
}
