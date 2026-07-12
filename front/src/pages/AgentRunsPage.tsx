import { Link, useParams } from "@tanstack/react-router";
import { FileDiff, ShieldAlert } from "lucide-react";
import { agentRuns, projects, tasks } from "../mockData";
import { Badge, Card, EmptyState, PageHeader } from "../components/Primitives";
import { statusTone } from "../components/status";

export function AgentRunsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Agent"
        title="Agent runs"
        detail="Backend-normalized OpenCode execution history for review and task evidence."
      />
      <Card title="Run history">
        <div className="table-wrap">
          <table className="responsive-table">
            <thead>
              <tr>
                <th>Run</th>
                <th>Agent</th>
                <th>Linked task</th>
                <th>Changed files</th>
                <th>Evidence</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {agentRuns.map((run) => {
                const task = tasks.find((item) => item.id === run.taskId);
                return (
                  <tr key={run.id}>
                    <td data-label="Run">
                      <Link to="/agent-runs/$runId" params={{ runId: run.id }}>{run.id}</Link>
                    </td>
                    <td data-label="Agent">{run.provider} · {run.model}</td>
                    <td data-label="Linked task">{task?.number ?? "No task"}</td>
                    <td data-label="Changed files">{run.changedFiles.length}</td>
                    <td data-label="Evidence">{run.evidenceCount}</td>
                    <td data-label="Review"><Badge tone={statusTone(run.status)}>{run.status}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function AgentRunDetailPage() {
  const { runId } = useParams({ from: "/agent-runs/$runId" });
  const run = agentRuns.find((item) => item.id === runId);

  if (run === undefined) {
    return <EmptyState title="Run not found" detail="The agent run route could not be resolved." />;
  }

  const task = tasks.find((item) => item.id === run.taskId);
  const project = task === undefined ? undefined : projects.find((item) => item.id === task.projectId);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={`${run.provider} · ${run.agentName}`}
        title={run.id}
        detail={`${run.model} · ${run.started} · ${run.duration}`}
        actions={<Badge tone={statusTone(run.status)}>{run.status}</Badge>}
      />
      <section className="dashboard-grid">
        <Card title="Run summary">
          <p>{run.summary}</p>
          <div className="summary-pills">
            <Badge>{project?.key ?? "No project"}</Badge>
            <Badge>{task?.number ?? "No task"}</Badge>
            {run.requiresReview && <Badge tone="warning">review required</Badge>}
          </div>
        </Card>
        <Card title="Evidence and unresolved">
          <div className="coverage-grid narrow">
            <div><ShieldAlert size={18} /><strong>{run.unresolvedCount}</strong><span>unresolved</span></div>
            <div><FileDiff size={18} /><strong>{run.evidenceCount}</strong><span>evidence items</span></div>
          </div>
        </Card>
      </section>
      <Card title="Changed files">
        <div className="list-stack">
          {run.changedFiles.map((filePath) => (
            <div key={filePath} className="file-row">
              <FileDiff size={16} />
              <span>{filePath}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Timeline">
        <div className="timeline">
          <div><strong>Started</strong><span>{run.started}</span></div>
          <div><strong>Task context loaded</strong><span>{task?.number ?? "No task"}</span></div>
          <div><strong>Evidence attached</strong><span>{run.evidenceCount} items</span></div>
          <div><strong>Finished</strong><span>{run.duration}</span></div>
        </div>
      </Card>
    </div>
  );
}
