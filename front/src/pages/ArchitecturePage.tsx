import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { GitBranch, Link2, TriangleAlert } from "lucide-react";
import { requestArchitectureArtifact, requestArchitectureArtifacts } from "../api/architectureClient";
import { isApiClientError } from "../api/http";
import { requestTasks } from "../api/tasksClient";
import { Badge, Card, EmptyState, MetricCard, PageHeader } from "../components/Primitives";
import { statusTone } from "../components/status";
import type { ArchitectureArtifact, TaskSummary } from "../types";
import { useUnauthorizedRedirect } from "./authRedirect";

export function ArchitecturePage() {
  const navigate = useNavigate();
  const artifactsQuery = useQuery({
    queryFn: ({ signal }) => requestArchitectureArtifacts(signal),
    queryKey: ["architecture", "artifacts"],
    retry: false,
  });
  useUnauthorizedRedirect(artifactsQuery.error, navigate);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Knowledge"
        title="Architecture registry"
        detail="Task-linked architecture knowledge index with source metadata and stale warnings."
      />
      <ArchitectureContent
        artifacts={artifactsQuery.data ?? []}
        error={artifactsQuery.error}
        isLoading={artifactsQuery.isLoading}
        onRetry={() => {
          void artifactsQuery.refetch();
        }}
      />
    </div>
  );
}

function ArchitectureContent({
  artifacts,
  error,
  isLoading,
  onRetry,
}: {
  readonly artifacts: readonly ArchitectureArtifact[];
  readonly error: Error | null;
  readonly isLoading: boolean;
  readonly onRetry: () => void;
}) {
  if (isLoading) {
    return <EmptyState title="Loading architecture" detail="Fetching backend architecture artifacts." />;
  }

  if (isApiClientError(error) && error.status === 403) {
    return <EmptyState title="Forbidden" detail="Your current role cannot read architecture artifacts." />;
  }

  if (error !== null) {
    return <RetryState detail="Backend architecture artifacts could not be loaded." onRetry={onRetry} title="Architecture unavailable" />;
  }

  return (
    <>
      <ArchitectureMetrics artifacts={artifacts} />
      <Card title="Artifacts">
        <div className="list-stack">
          {artifacts.map((artifact) => (
            <ArtifactRow artifact={artifact} key={artifact.id} />
          ))}
          {artifacts.length === 0 && <EmptyState title="No artifacts" detail="The backend returned no architecture artifacts." />}
        </div>
      </Card>
    </>
  );
}

function ArchitectureMetrics({ artifacts }: { readonly artifacts: readonly ArchitectureArtifact[] }) {
  const linkedTasks = new Set(artifacts.flatMap((artifact) => artifact.linkedTaskIds)).size;

  return (
    <section className="metric-grid compact">
      <MetricCard label="Accepted ADR" value={String(artifacts.filter((item) => item.status === "Accepted").length)} detail="Decision records linked to tasks" />
      <MetricCard label="Proposed RFC" value={String(artifacts.filter((item) => item.status === "Proposed").length)} detail="Needs owner review" />
      <MetricCard label="Stale links" value={String(artifacts.filter((item) => item.status === "Stale").length)} detail="Refresh required" />
      <MetricCard label="Linked tasks" value={String(linkedTasks)} detail="Execution coverage" />
    </section>
  );
}

function ArtifactRow({ artifact }: { readonly artifact: ArchitectureArtifact }) {
  return (
    <Link key={artifact.id} to="/architecture/adr/$artifactId" params={{ artifactId: artifact.id }} className="artifact-row">
      <GitBranch size={18} />
      <div>
        <strong>{artifact.title}</strong>
        <span>{artifact.type} · {artifact.sourcePath}</span>
      </div>
      <Badge tone={statusTone(artifact.status)}>{artifact.status}</Badge>
      <span className="muted">{artifact.linkedTaskIds.length} linked tasks</span>
    </Link>
  );
}

export function ArchitectureDetailPage() {
  const navigate = useNavigate();
  const { artifactId } = useParams({ from: "/architecture/adr/$artifactId" });
  const artifactQuery = useQuery({
    queryFn: ({ signal }) => requestArchitectureArtifact(artifactId, signal),
    queryKey: ["architecture", "artifact", artifactId],
    retry: false,
  });
  const tasksQuery = useQuery({
    queryFn: ({ signal }) => requestTasks(signal),
    queryKey: ["tasks", "architecture-detail"],
    retry: false,
  });
  useUnauthorizedRedirect(artifactQuery.error, navigate);

  if (artifactQuery.isLoading) {
    return <EmptyState title="Loading artifact" detail="Fetching backend architecture detail." />;
  }

  if (isApiClientError(artifactQuery.error) && (artifactQuery.error.status === 404 || artifactQuery.error.code === "NOT_FOUND")) {
    return <EmptyState title="Artifact not found" detail="The requested architecture artifact is not available from the backend." />;
  }

  if (artifactQuery.error !== null) {
    return <RetryState detail="Backend architecture detail could not be loaded." onRetry={() => void artifactQuery.refetch()} title="Artifact unavailable" />;
  }

  if (artifactQuery.data === undefined) {
    return <EmptyState title="Artifact not found" detail="The backend did not return architecture detail." />;
  }

  return <ArchitectureDetail artifact={artifactQuery.data} taskError={tasksQuery.error} tasks={tasksQuery.data ?? []} />;
}

function ArchitectureDetail({
  artifact,
  taskError,
  tasks,
}: {
  readonly artifact: ArchitectureArtifact;
  readonly taskError: Error | null;
  readonly tasks: readonly TaskSummary[];
}) {
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
          <ArtifactWarning artifact={artifact} />
        </Card>
      </section>
      <Card title="Linked tasks">
        <div className="list-stack">
          {taskError !== null && <EmptyState title="Linked tasks unavailable" detail="Backend task list could not be loaded." />}
          {taskError === null && linkedTasks.map((task) => (
            <Link key={task.id} to="/tasks/$taskId" params={{ taskId: task.id }} className="review-row">
              <Badge tone={statusTone(task.status)}>{task.status}</Badge>
              <div>
                <strong>{task.number}</strong>
                <span>{task.title}</span>
              </div>
            </Link>
          ))}
          {taskError === null && linkedTasks.length === 0 && <EmptyState title="No linked tasks" detail="No backend tasks are linked to this artifact." />}
        </div>
      </Card>
    </div>
  );
}

function ArtifactWarning({ artifact }: { readonly artifact: ArchitectureArtifact }) {
  if (artifact.status === "Stale") {
    return (
      <div className="review-row">
        <TriangleAlert size={17} />
        <span>Artifact is stale and should be refreshed before release.</span>
      </div>
    );
  }

  return (
    <div className="review-row">
      <Link2 size={17} />
      <span>Artifact is linked to active execution context.</span>
    </div>
  );
}

function RetryState({ detail, onRetry, title }: { readonly detail: string; readonly onRetry: () => void; readonly title: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{detail}</span>
      <button className="button" type="button" onClick={onRetry}>Retry</button>
    </div>
  );
}
