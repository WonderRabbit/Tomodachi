import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { requestProjects } from "../api/projectsClient";
import { isApiClientError } from "../api/http";
import { Badge, Card, EmptyState, PageHeader, ProgressBar } from "../components/Primitives";
import { statusTone } from "../components/status";
import type { ProjectSummary } from "../types";
import { useUnauthorizedRedirect } from "./authRedirect";

export function ProjectsPage() {
  const navigate = useNavigate();
  const projectsQuery = useQuery({
    queryFn: ({ signal }) => requestProjects(signal),
    queryKey: ["projects"],
    retry: false,
  });

  useUnauthorizedRedirect(projectsQuery.error, navigate);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Lifecycle"
        title="Projects"
        detail="Backend-owned project health, ownership, and delivery progress."
      />
      <ProjectsContent
        error={projectsQuery.error}
        isLoading={projectsQuery.isLoading}
        onRetry={() => {
          void projectsQuery.refetch();
        }}
        projects={projectsQuery.data ?? []}
      />
    </div>
  );
}

function ProjectsContent({
  error,
  isLoading,
  onRetry,
  projects,
}: {
  readonly error: Error | null;
  readonly isLoading: boolean;
  readonly onRetry: () => void;
  readonly projects: readonly ProjectSummary[];
}) {
  if (isLoading) {
    return <EmptyState title="Loading projects" detail="Fetching project summaries from the backend." />;
  }

  if (isApiClientError(error) && error.status === 403) {
    return <EmptyState title="Forbidden" detail="Your current role cannot read project summaries." />;
  }

  if (error !== null) {
    return (
      <div className="empty-state">
        <strong>Projects unavailable</strong>
        <span>Backend project summaries could not be loaded.</span>
        <button className="button" type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (projects.length === 0) {
    return <EmptyState title="No projects" detail="The backend returned an empty project list." />;
  }

  const blockedCount = projects.filter((item) => item.status === "Blocked").length;
  const averageProgress = Math.round(projects.reduce((sum, item) => sum + item.progress, 0) / projects.length);

  return (
    <>
      <section className="metric-grid compact">
        <Card><strong>{projects.length}</strong><span>tracked projects</span></Card>
        <Card><strong>{blockedCount}</strong><span>blocked</span></Card>
        <Card><strong>{averageProgress}%</strong><span>average progress</span></Card>
        <Card><strong>API</strong><span>backend source</span></Card>
      </section>
      <Card title="Project list">
        <div className="list-stack">
          {projects.map((project) => (
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
        </div>
      </Card>
    </>
  );
}
