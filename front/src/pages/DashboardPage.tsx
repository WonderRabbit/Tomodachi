import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, GitPullRequest, ListChecks } from "lucide-react";
import { agentRuns, artifacts, projects, tasks } from "../mockData";
import { Badge, Card, MetricCard, PageHeader, ProgressBar } from "../components/Primitives";
import { statusTone } from "../components/status";

export function DashboardPage() {
  const activeProjects = projects.filter((project) => project.status !== "Blocked");
  const blockedTasks = tasks.filter((task) => task.status === "Blocked");
  const reviewRuns = agentRuns.filter((run) => run.requiresReview);
  const acceptedArtifacts = artifacts.filter((artifact) => artifact.status === "Accepted");

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Dashboard"
        title="Tomodachi operations"
        detail="Product, project, task, architecture, and agent review state in one working surface."
        actions={<Badge tone="accent">Range: 7d</Badge>}
      />

      <section className="metric-grid">
        <Link to="/projects" className="metric-link">
          <MetricCard
            label="Active Projects"
            value={String(activeProjects.length)}
            detail="Lifecycle streams moving this week"
            trend="+1"
          />
        </Link>
        <Link to="/tasks" className="metric-link">
          <MetricCard
            label="Tasks In Flight"
            value={String(tasks.filter((task) => task.status !== "Done").length)}
            detail="Ready, active, review, and QA tasks"
          />
        </Link>
        <Link to="/tasks" className="metric-link">
          <MetricCard
            label="Blocked Tasks"
            value={String(blockedTasks.length)}
            detail={blockedTasks[0]?.title ?? "No blockers"}
          />
        </Link>
        <Link to="/agent-runs" className="metric-link">
          <MetricCard
            label="Agent Review Queue"
            value={String(reviewRuns.length)}
            detail="Runs with unresolved evidence"
            trend="needs review"
          />
        </Link>
      </section>

      <section className="dashboard-grid">
        <Card title="Workstream overview">
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
                <span className="muted">{project.blockers} blockers</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card title="Review required">
          <div className="list-stack">
            {reviewRuns.map((run) => (
              <Link
                key={run.id}
                to="/agent-runs/$runId"
                params={{ runId: run.id }}
                className="review-row"
              >
                <AlertTriangle size={17} />
                <div>
                  <strong>{run.id}</strong>
                  <span>{run.unresolvedCount} unresolved · {run.model}</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <Card title="Architecture coverage">
        <div className="coverage-grid">
          <div>
            <CheckCircle2 size={18} />
            <strong>{acceptedArtifacts.length} accepted artifacts</strong>
            <span>ADR and diagram records linked to execution tasks.</span>
          </div>
          <div>
            <GitPullRequest size={18} />
            <strong>{artifacts.filter((artifact) => artifact.status === "Stale").length} stale warnings</strong>
            <span>Warnings should route to artifact detail and linked tasks.</span>
          </div>
          <div>
            <ListChecks size={18} />
            <strong>{tasks.filter((task) => task.artifacts.length > 0).length} linked tasks</strong>
            <span>Task detail carries architecture and agent context together.</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
