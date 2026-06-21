import { Link, useParams } from "@tanstack/react-router";
import { ArrowRight, GitBranch, PlayCircle } from "lucide-react";
import { agentRuns, artifacts, projects, tasks } from "../mockData";
import { Badge, Card, EmptyState, PageHeader } from "../components/Primitives";
import { statusTone } from "../components/status";
import { TasksTable } from "../components/TasksTable";

export function TasksPage() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Lifecycle"
        title="Tasks"
        detail="Cross-project execution table with task, artifact, and agent context."
        actions={<Badge tone="accent">q, status, priority, projectId</Badge>}
      />
      <Card title="All tasks">
        <TasksTable data={tasks} />
      </Card>
    </div>
  );
}

export function TaskDetailPage() {
  const { taskId } = useParams({ from: "/tasks/$taskId" });
  const task = tasks.find((item) => item.id === taskId);

  if (task === undefined) {
    return <EmptyState title="Task not found" detail="The task route could not be resolved." />;
  }

  const project = projects.find((item) => item.id === task.projectId);
  const linkedArtifacts = artifacts.filter((artifact) => task.artifacts.includes(artifact.id));
  const linkedRuns = agentRuns.filter((run) => task.agentRunIds.includes(run.id));

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={task.number}
        title={task.title}
        detail={`${project?.key ?? "No project"} · ${task.assignee} · updated ${task.updated}`}
        actions={<Badge tone={statusTone(task.status)}>{task.status}</Badge>}
      />

      <section className="dashboard-grid">
        <Card title="Status transition">
          <div className="transition-strip">
            <Badge>{task.status}</Badge>
            <ArrowRight size={16} />
            <button className="button" type="button">
              <PlayCircle size={16} />
              Start transition
            </button>
          </div>
          <p className="muted">
            MVP keeps the transition surface visible; Spring will enforce allowed
            states, audit, idempotency, and rollback.
          </p>
          {task.blockerReason !== undefined && <Badge tone="danger">{task.blockerReason}</Badge>}
        </Card>
        <Card title="Context bundle">
          <p>
            Compact agent context includes project, status machine, linked
            artifacts, recent runs, and unresolved evidence.
          </p>
          <Badge tone="accent">backend facade only</Badge>
        </Card>
      </section>

      <Card title="Architecture links">
        <div className="list-stack">
          {linkedArtifacts.map((artifact) => (
            <Link
              key={artifact.id}
              to="/architecture/adr/$artifactId"
              params={{ artifactId: artifact.id }}
              className="review-row"
            >
              <GitBranch size={17} />
              <div>
                <strong>{artifact.title}</strong>
                <span>{artifact.type} · {artifact.sourcePath}</span>
              </div>
              <Badge tone={statusTone(artifact.status)}>{artifact.status}</Badge>
            </Link>
          ))}
        </div>
      </Card>

      <Card title="Agent runs">
        <div className="list-stack">
          {linkedRuns.map((run) => (
            <Link
              key={run.id}
              to="/agent-runs/$runId"
              params={{ runId: run.id }}
              className="review-row"
            >
              <Badge tone={statusTone(run.status)}>{run.status}</Badge>
              <div>
                <strong>{run.id}</strong>
                <span>{run.changedFiles.length} files · {run.evidenceCount} evidence · {run.unresolvedCount} unresolved</span>
              </div>
            </Link>
          ))}
          {linkedRuns.length === 0 && (
            <EmptyState title="No runs" detail="No backend-normalized agent runs are linked to this task yet." />
          )}
        </div>
      </Card>
    </div>
  );
}
