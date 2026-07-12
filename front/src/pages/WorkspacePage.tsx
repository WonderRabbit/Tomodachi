import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { requestWorkspace } from "../api/workspacesClient";
import { isApiClientError } from "../api/http";
import { Badge, Card, EmptyState, MetricCard, PageHeader, ProgressBar } from "../components/Primitives";
import { statusTone } from "../components/status";
import type { WorkspaceDetail } from "../types";
import { useUnauthorizedRedirect } from "./authRedirect";

export function WorkspacePage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams({ from: "/workspaces/$workspaceId" });
  const workspaceQuery = useQuery({
    queryFn: ({ signal }) => requestWorkspace(workspaceId, signal),
    queryKey: ["workspace", workspaceId],
    retry: false,
  });
  useUnauthorizedRedirect(workspaceQuery.error, navigate);

  return (
    <WorkspaceContent
      error={workspaceQuery.error}
      isLoading={workspaceQuery.isLoading}
      onRetry={() => void workspaceQuery.refetch()}
      workspace={workspaceQuery.data}
    />
  );
}

function WorkspaceContent({
  error,
  isLoading,
  onRetry,
  workspace,
}: {
  readonly error: Error | null;
  readonly isLoading: boolean;
  readonly onRetry: () => void;
  readonly workspace: WorkspaceDetail | undefined;
}) {
  if (isLoading) return <EmptyState title="Loading workspace" detail="Fetching workspace detail from the backend." />;
  if (isApiClientError(error) && (error.status === 404 || error.code === "NOT_FOUND")) {
    return <EmptyState title="Workspace not found" detail="The requested workspace id is not available from the backend." />;
  }
  if (error !== null) return <RetryState detail="Backend workspace detail could not be loaded." onRetry={onRetry} title="Workspace unavailable" />;
  if (workspace === undefined) return <EmptyState title="Workspace not found" detail="The backend did not return workspace detail." />;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={workspace.productName}
        title={workspace.name}
        detail={`${workspace.owner} owns this backend workspace for ${workspace.productId}.`}
        actions={<Badge tone="accent">backend workspace</Badge>}
      />
      <section className="metric-grid compact">
        <MetricCard label="Projects" value={String(workspace.projectCount)} detail="Workspace project streams" />
        <MetricCard label="Open tasks" value={String(workspace.openTasks)} detail="Ready through QA tasks" />
        <MetricCard label="Owner" value={workspace.owner} detail="Workspace accountable group" />
        <MetricCard label="Product" value={workspace.productName} detail={workspace.productId} />
      </section>
      <Card title="Workspace projects">
        <div className="list-stack">
          {workspace.projects.map((project) => (
            <Link key={project.id} to="/projects/$projectId" params={{ projectId: project.id }} className="project-row">
              <div>
                <strong>{project.key}</strong>
                <span>{project.name}</span>
              </div>
              <ProgressBar value={project.progress} />
              <Badge tone={statusTone(project.status)}>{project.status}</Badge>
              <span className="muted">{project.owner}</span>
            </Link>
          ))}
          {workspace.projects.length === 0 && <EmptyState title="No projects" detail="The backend returned no projects for this workspace." />}
        </div>
      </Card>
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
