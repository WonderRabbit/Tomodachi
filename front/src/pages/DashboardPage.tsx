import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, GitPullRequest, ListChecks } from "lucide-react";
import { requestDashboardSummary } from "../api/dashboardClient";
import { isApiClientError } from "../api/http";
import { Badge, Card, EmptyState, MetricCard, PageHeader, ProgressBar } from "../components/Primitives";
import { statusTone } from "../components/status";
import type { DashboardArchitectureSummary, DashboardProjectSummary, DashboardReviewRun, DashboardSummary } from "../types";
import { useUnauthorizedRedirect } from "./authRedirect";

export function DashboardPage() {
  const navigate = useNavigate();
  const dashboardQuery = useQuery({
    queryFn: ({ signal }) => requestDashboardSummary(signal),
    queryKey: ["dashboard-summary"],
    retry: false,
  });

  useUnauthorizedRedirect(dashboardQuery.error, navigate);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Dashboard"
        title="Tomodachi operations"
        detail="Product, project, task, architecture, and agent review state in one working surface."
        actions={<Badge tone="accent">backend summary</Badge>}
      />

      <DashboardContent
        error={dashboardQuery.error}
        isLoading={dashboardQuery.isLoading}
        onRetry={() => {
          void dashboardQuery.refetch();
        }}
        summary={dashboardQuery.data}
      />
    </div>
  );
}

function DashboardContent({
  error,
  isLoading,
  onRetry,
  summary,
}: {
  readonly error: Error | null;
  readonly isLoading: boolean;
  readonly onRetry: () => void;
  readonly summary: DashboardSummary | undefined;
}) {
  const panel = panelFallback(error, isLoading, summary, onRetry);

  return (
    <>
      <DashboardMetrics panel={panel} summary={summary} />
      <section className="dashboard-grid">
        <WorkstreamOverview panel={panel} projects={summary?.projects} />
        <ReviewRequired panel={panel} runs={summary?.reviewRuns} />
      </section>
      <ArchitectureCoverage architecture={summary?.architecture} panel={panel} />
    </>
  );
}

type PanelFallback = {
  readonly detail: string;
  readonly retry: (() => void) | null;
  readonly title: string;
} | null;
function panelFallback(
  error: Error | null,
  isLoading: boolean,
  summary: DashboardSummary | undefined,
  onRetry: () => void,
): PanelFallback {
  if (isLoading) {
    return { detail: "Fetching backend-owned dashboard summary.", retry: null, title: "Loading dashboard" };
  }

  if (isApiClientError(error) && error.status === 403) {
    return { detail: "Your current role cannot read dashboard summaries.", retry: null, title: "Forbidden" };
  }

  if (error !== null) {
    return { detail: "Backend dashboard summary could not be loaded.", retry: onRetry, title: "Dashboard unavailable" };
  }

  if (summary === undefined) {
    return { detail: "The backend did not return dashboard aggregates.", retry: null, title: "No dashboard data" };
  }

  return null;
}
function DashboardMetrics({
  panel,
  summary,
}: {
  readonly panel: PanelFallback;
  readonly summary: DashboardSummary | undefined;
}) {
  const fallbackDetail = panel?.detail ?? "Dashboard data unavailable.";

  return (
    <section className="metric-grid">
      <Link to="/projects" className="metric-link">
        <MetricCard
          label="Active Projects"
          value={summary === undefined ? "—" : String(summary.activeProjects)}
          detail={summary === undefined ? fallbackDetail : "Lifecycle streams moving this week"}
        />
      </Link>
      <Link to="/tasks" className="metric-link">
        <MetricCard
          label="Tasks In Flight"
          value={summary === undefined ? "—" : String(summary.tasksInFlight)}
          detail={summary === undefined ? fallbackDetail : "Ready, active, review, and QA tasks"}
        />
      </Link>
      <Link to="/tasks" className="metric-link">
        <MetricCard
          label="Blocked Tasks"
          value={summary === undefined ? "—" : String(summary.blockedTasks)}
          detail={summary === undefined ? fallbackDetail : summary.blockedTaskTitle ?? "No blockers"}
        />
      </Link>
      <Link to="/agent-runs" className="metric-link">
        <MetricCard
          label="Agent Review Queue"
          value={summary === undefined ? "—" : String(summary.agentReviewQueue)}
          detail={summary === undefined ? fallbackDetail : "Runs with unresolved evidence"}
        />
      </Link>
    </section>
  );
}
function WorkstreamOverview({
  panel,
  projects,
}: {
  readonly panel: PanelFallback;
  readonly projects: readonly DashboardProjectSummary[] | undefined;
}) {
  return (
    <Card title="Workstream overview">
      <div className="list-stack">
        {panel !== null && <PanelFallbackState panel={panel} />}
        {panel === null && projects?.map((project) => (
          <Link key={project.id} to="/projects/$projectId" params={{ projectId: project.id }} className="project-row">
            <div>
              <strong>{project.key}</strong>
              <span>{project.name}</span>
            </div>
            <ProgressBar value={project.progress} />
            <Badge tone={statusTone(project.status)}>{project.status}</Badge>
            <span className="muted">{project.blockers} blockers</span>
          </Link>
        ))}
        {panel === null && projects?.length === 0 && (
          <EmptyState title="No projects" detail="The backend returned no project summaries." />
        )}
      </div>
    </Card>
  );
}
function ReviewRequired({
  panel,
  runs,
}: {
  readonly panel: PanelFallback;
  readonly runs: readonly DashboardReviewRun[] | undefined;
}) {
  return (
    <Card title="Review required">
      <div className="list-stack">
        {panel !== null && <PanelFallbackState panel={panel} />}
        {panel === null && runs?.map((run) => (
          <Link key={run.id} to="/agent-runs/$runId" params={{ runId: run.id }} className="review-row">
            <AlertTriangle size={17} />
            <div>
              <strong>{run.id}</strong>
              <span>{run.unresolvedCount} unresolved · {run.model}</span>
            </div>
          </Link>
        ))}
        {panel === null && runs?.length === 0 && (
          <EmptyState title="No review queue" detail="No agent runs currently require review." />
        )}
      </div>
    </Card>
  );
}
function ArchitectureCoverage({
  architecture,
  panel,
}: {
  readonly architecture: DashboardArchitectureSummary | undefined;
  readonly panel: PanelFallback;
}) {
  if (panel !== null) {
    return (
      <Card title="Architecture coverage">
        <PanelFallbackState panel={panel} />
      </Card>
    );
  }

  if (architecture === undefined) {
    return (
      <Card title="Architecture coverage">
        <EmptyState title="No architecture data" detail="The backend returned no architecture aggregate." />
      </Card>
    );
  }

  return (
    <Card title="Architecture coverage">
      <div className="coverage-grid">
        <div>
          <CheckCircle2 size={18} />
          <strong>{architecture.acceptedArtifacts} accepted artifacts</strong>
          <span>ADR and diagram records linked to execution tasks.</span>
        </div>
        <div>
          <GitPullRequest size={18} />
          <strong>{architecture.staleArtifacts} stale warnings</strong>
          <span>Warnings should route to artifact detail and linked tasks.</span>
        </div>
        <div>
          <ListChecks size={18} />
          <strong>{architecture.linkedTasks} linked tasks</strong>
          <span>Task detail carries architecture and agent context together.</span>
        </div>
      </div>
    </Card>
  );
}
function PanelFallbackState({ panel }: { readonly panel: NonNullable<PanelFallback> }) {
  return (
    <div className="empty-state">
      <strong>{panel.title}</strong>
      <span>{panel.detail}</span>
      {panel.retry !== null && <button className="button" type="button" onClick={panel.retry}>Retry</button>}
    </div>
  );
}
