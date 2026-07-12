import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { requestProject } from "../api/projectsClient";
import { isApiClientError } from "../api/http";
import { requestTasks, taskStatuses } from "../api/tasksClient";
import { EmptyState, PageHeader } from "../components/Primitives";
import type { TaskSummary, TaskStatus } from "../types";
import { useUnauthorizedRedirect } from "./authRedirect";

export function ProjectBoardPage() {
  const navigate = useNavigate();
  const { projectId } = useParams({ from: "/projects/$projectId/tasks/board" });
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

  if (projectQuery.isLoading || tasksQuery.isLoading) {
    return <EmptyState title="Loading board" detail="Fetching project board data from the backend." />;
  }

  if (isApiClientError(projectQuery.error) && (projectQuery.error.status === 404 || projectQuery.error.code === "NOT_FOUND")) {
    return <EmptyState title="Project not found" detail="Board context could not be restored from the backend." />;
  }

  if (projectQuery.error !== null || tasksQuery.error !== null) {
    return <EmptyState title="Board unavailable" detail="Backend project board data could not be loaded." />;
  }

  if (projectQuery.data === undefined) {
    return <EmptyState title="Project not found" detail="The backend did not return board context." />;
  }

  const projectTasks = (tasksQuery.data ?? []).filter((task) => task.projectId === projectId);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={`${projectQuery.data.key} board`}
        title="Task board"
        detail="Status columns use backend project and task summaries."
      />
      <div className="status-board">
        {taskStatuses.map((status) => (
          <TaskColumn key={status} status={status} tasks={projectTasks} />
        ))}
      </div>
    </div>
  );
}

function TaskColumn({ status, tasks }: { readonly status: TaskStatus; readonly tasks: readonly TaskSummary[] }) {
  const statusTasks = tasks.filter((task) => task.status === status);

  return (
    <section className="board-column">
      <h3>{status}</h3>
      {statusTasks.map((task) => (
        <Link key={task.id} to="/tasks/$taskId" params={{ taskId: task.id }} className="task-card">
          <strong>{task.number}</strong>
          <span>{task.title}</span>
          <span className="muted">{task.assignee}</span>
        </Link>
      ))}
    </section>
  );
}
