import { Link, useParams } from "@tanstack/react-router";
import { GitBranch, Link2, TriangleAlert } from "lucide-react";
import { artifacts, tasks } from "../mockData";
import { Badge, Card, EmptyState, MetricCard, PageHeader } from "../components/Primitives";
import { statusTone } from "../components/status";

export function ArchitecturePage() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Knowledge"
        title="Architecture registry"
        detail="Task-linked architecture knowledge index with source metadata and stale warnings."
      />
      <section className="metric-grid compact">
        <MetricCard label="Accepted ADR" value={String(artifacts.filter((item) => item.status === "Accepted").length)} detail="Decision records linked to tasks" />
        <MetricCard label="Proposed RFC" value={String(artifacts.filter((item) => item.status === "Proposed").length)} detail="Needs owner review" />
        <MetricCard label="Stale links" value={String(artifacts.filter((item) => item.status === "Stale").length)} detail="Refresh required" />
        <MetricCard label="Linked tasks" value={String(tasks.filter((task) => task.artifacts.length > 0).length)} detail="Execution coverage" />
      </section>
      <Card title="Artifacts">
        <div className="list-stack">
          {artifacts.map((artifact) => (
            <Link
              key={artifact.id}
              to="/architecture/adr/$artifactId"
              params={{ artifactId: artifact.id }}
              className="artifact-row"
            >
              <GitBranch size={18} />
              <div>
                <strong>{artifact.title}</strong>
                <span>{artifact.type} · {artifact.sourcePath}</span>
              </div>
              <Badge tone={statusTone(artifact.status)}>{artifact.status}</Badge>
              <span className="muted">{artifact.linkedTaskIds.length} linked tasks</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function ArchitectureDetailPage() {
  const { artifactId } = useParams({ from: "/architecture/adr/$artifactId" });
  const artifact = artifacts.find((item) => item.id === artifactId);

  if (artifact === undefined) {
    return <EmptyState title="Artifact not found" detail="The architecture route could not be resolved." />;
  }

  const linkedTasks = tasks.filter((task) => artifact.linkedTaskIds.includes(task.id));

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={`${artifact.type} · ${artifact.owner}`}
        title={artifact.title}
        detail={artifact.summary}
        actions={<Badge tone={statusTone(artifact.status)}>{artifact.status}</Badge>}
      />
      <section className="dashboard-grid">
        <Card title="Source preview">
          <p>{artifact.sourcePath}</p>
          <p className="muted">Git-backed source remains outside the frontend editor in MVP.</p>
        </Card>
        <Card title="Warnings">
          {artifact.status === "Stale" ? (
            <div className="review-row">
              <TriangleAlert size={17} />
              <span>Artifact is stale and should be refreshed before release.</span>
            </div>
          ) : (
            <div className="review-row">
              <Link2 size={17} />
              <span>Artifact is linked to active execution context.</span>
            </div>
          )}
        </Card>
      </section>
      <Card title="Linked tasks">
        <div className="list-stack">
          {linkedTasks.map((task) => (
            <Link key={task.id} to="/tasks/$taskId" params={{ taskId: task.id }} className="review-row">
              <Badge tone={statusTone(task.status)}>{task.status}</Badge>
              <div>
                <strong>{task.number}</strong>
                <span>{task.title}</span>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
