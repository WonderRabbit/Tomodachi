import { Link, useParams } from "@tanstack/react-router";
import { artifacts, agentRuns, projects, taskStatuses, tasks } from "../mockData";
import { Badge, Card, EmptyState, PageHeader, ProgressBar } from "../components/Primitives";
import { statusTone } from "../components/status";

export function ProjectsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Lifecycle"
        title="Projects"
        detail="Saved views for active, blocked, review-needed, and architecture-unlinked work."
      />
      <section className="metric-grid compact">
        <Card><strong>{projects.length}</strong><span>tracked projects</span></Card>
        <Card><strong>{projects.filter((item) => item.status === "Blocked").length}</strong><span>blocked</span></Card>
        <Card><strong>{tasks.filter((task) => task.status === "Review").length}</strong><span>in review</span></Card>
        <Card><strong>{tasks.filter((task) => task.status === "Done").length}</strong><span>done this week</span></Card>
      </section>
      <Card title="Project list">
        <div className="list-stack">
          {projects.map((project) => (
            <Link
              key={project.id}
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              className="project-row"
            >
              <div>
                <strong>{project.key}</strong>
                <span>{project.name}</span>
              </div>
              <ProgressBar value={project.progress} />
              <Badge tone={statusTone(project.status)}>{project.status}</Badge>
              <span className="muted">{project.linkedArtifacts} artifacts</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function ProjectDetailPage() {
  const { projectId } = useParams({ from: "/projects/$projectId" });
  const project = projects.find((item) => item.id === projectId);

  if (project === undefined) {
    return <EmptyState title="Project not found" detail="The requested project id is not in the current dataset." />;
  }

  const projectTasks = tasks.filter((task) => task.projectId === project.id);
  const run = agentRuns.find((item) => item.id === project.latestAgentRunId);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={project.key}
        title={project.name}
        detail={`${project.owner} owns this stream. Due ${project.due}.`}
        actions={<Link className="button" to="/projects/$projectId/tasks/board" params={{ projectId }}>Open board</Link>}
      />
      <section className="dashboard-grid">
        <Card title="Progress">
          <ProgressBar value={project.progress} />
          <p>{project.progress}% complete with {project.blockers} blockers.</p>
        </Card>
        <Card title="Latest agent run">
          {run === undefined ? (
            <EmptyState title="No run" detail="No backend-normalized agent run is linked yet." />
          ) : (
            <Link to="/agent-runs/$runId" params={{ runId: run.id }} className="review-row">
              <Badge tone={statusTone(run.status)}>{run.status}</Badge>
              <span>{run.summary}</span>
            </Link>
          )}
        </Card>
      </section>
      <Card title="Project tasks">
        <div className="status-board small-board">
          {taskStatuses.map((status) => (
            <div key={status} className="board-column">
              <h3>{status}</h3>
              {projectTasks.filter((task) => task.status === status).map((task) => (
                <Link key={task.id} to="/tasks/$taskId" params={{ taskId: task.id }} className="task-card">
                  <strong>{task.number}</strong>
                  <span>{task.title}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function ProjectBoardPage() {
  const { projectId } = useParams({ from: "/projects/$projectId/tasks/board" });
  const project = projects.find((item) => item.id === projectId);
  const projectTasks = tasks.filter((task) => task.projectId === projectId);

  if (project === undefined) {
    return <EmptyState title="Project not found" detail="Board context could not be restored from the route." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={`${project.key} board`}
        title="Task board"
        detail="Status columns preserve the transition contract used by task detail."
      />
      <div className="status-board">
        {taskStatuses.map((status) => (
          <section key={status} className="board-column">
            <h3>{status}</h3>
            {projectTasks.filter((task) => task.status === status).map((task) => (
              <Link key={task.id} to="/tasks/$taskId" params={{ taskId: task.id }} className="task-card">
                <strong>{task.number}</strong>
                <span>{task.title}</span>
                <span className="muted">{task.assignee} · {task.artifacts.length} artifacts</span>
              </Link>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
