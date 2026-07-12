import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { FileDiff, ShieldAlert } from "lucide-react";
import { requestAgentRun, requestAgentRuns } from "../api/agentRunsClient";
import { isApiClientError } from "../api/http";
import { requestTaskContext, requestTasks } from "../api/tasksClient";
import { Badge, Card, EmptyState, PageHeader } from "../components/Primitives";
import { statusTone } from "../components/status";
import type { AgentRunSummary, TaskContext, TaskSummary } from "../types";
import { useUnauthorizedRedirect } from "./authRedirect";

export function AgentRunsPage() {
  const navigate = useNavigate();
  const runsQuery = useQuery({ queryFn: ({ signal }) => requestAgentRuns(signal), queryKey: ["agent-runs"], retry: false });
  const tasksQuery = useQuery({ queryFn: ({ signal }) => requestTasks(signal), queryKey: ["tasks", "agent-runs"], retry: false });
  useUnauthorizedRedirect(runsQuery.error, navigate);

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Agent" title="Agent runs" detail="Backend-normalized OpenCode execution history for review and task evidence." />
      <Card title="Run history">
        <AgentRunsTable
          error={runsQuery.error}
          isLoading={runsQuery.isLoading}
          onRetry={() => void runsQuery.refetch()}
          runs={runsQuery.data ?? []}
          taskError={tasksQuery.error}
          tasks={tasksQuery.data ?? []}
        />
      </Card>
    </div>
  );
}

function AgentRunsTable({
  error,
  isLoading,
  onRetry,
  runs,
  taskError,
  tasks,
}: {
  readonly error: Error | null;
  readonly isLoading: boolean;
  readonly onRetry: () => void;
  readonly runs: readonly AgentRunSummary[];
  readonly taskError: Error | null;
  readonly tasks: readonly TaskSummary[];
}) {
  if (isLoading) return <EmptyState title="Loading agent runs" detail="Fetching backend agent run history." />;
  if (isApiClientError(error) && error.status === 403) return <EmptyState title="Forbidden" detail="Your current role cannot read agent runs." />;
  if (error !== null) return <RetryState detail="Backend agent runs could not be loaded." onRetry={onRetry} title="Agent runs unavailable" />;
  if (runs.length === 0) return <EmptyState title="No agent runs" detail="The backend returned no agent run history." />;

  return (
    <div className="table-wrap">
      {taskError !== null && <p className="muted">Task labels are unavailable; showing backend task ids.</p>}
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
          {runs.map((run) => {
            const task = tasks.find((item) => item.id === run.taskId);
            return (
              <tr key={run.id}>
                <td data-label="Run"><Link to="/agent-runs/$runId" params={{ runId: run.id }}>{run.id}</Link></td>
                <td data-label="Agent">{run.provider} · {run.model}</td>
                <td data-label="Linked task">{task?.number ?? run.taskId}</td>
                <td data-label="Changed files">{run.changedFiles.length}</td>
                <td data-label="Evidence">{run.evidenceCount}</td>
                <td data-label="Review"><Badge tone={statusTone(run.status)}>{run.status}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AgentRunDetailPage() {
  const navigate = useNavigate();
  const { runId } = useParams({ from: "/agent-runs/$runId" });
  const runQuery = useQuery({ queryFn: ({ signal }) => requestAgentRun(runId, signal), queryKey: ["agent-run", runId], retry: false });
  const taskContextQuery = useQuery({
    enabled: runQuery.data !== undefined,
    queryFn: ({ signal }) => requestTaskContext(runQuery.data?.taskId ?? "", signal),
    queryKey: ["task-context", runQuery.data?.taskId],
    retry: false,
  });
  useUnauthorizedRedirect(runQuery.error, navigate);

  if (runQuery.isLoading) return <EmptyState title="Loading run" detail="Fetching backend agent run detail." />;
  if (isApiClientError(runQuery.error) && (runQuery.error.status === 404 || runQuery.error.code === "NOT_FOUND")) {
    return <EmptyState title="Run not found" detail="The requested agent run is not available from the backend." />;
  }
  if (runQuery.error !== null) {
    return <RetryState detail="Backend agent run detail could not be loaded." onRetry={() => void runQuery.refetch()} title="Run unavailable" />;
  }
  if (runQuery.data === undefined) return <EmptyState title="Run not found" detail="The backend did not return agent run detail." />;

  return <AgentRunDetail context={taskContextQuery.data} contextError={taskContextQuery.error} run={runQuery.data} />;
}

function AgentRunDetail({
  context,
  contextError,
  run,
}: {
  readonly context: TaskContext | undefined;
  readonly contextError: Error | null;
  readonly run: AgentRunSummary;
}) {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={`${run.provider} · ${run.agentName}`}
        title={run.id}
        detail={`${run.model} · backend normalized run`}
        actions={<Badge tone={statusTone(run.status)}>{run.status}</Badge>}
      />
      <section className="dashboard-grid">
        <Card title="Run summary">
          <p>{run.changedFiles.length} changed files, {run.evidenceCount} evidence items, and {run.unresolvedCount} unresolved items were imported from backend agent metadata.</p>
          <div className="summary-pills">
            <Badge>{context?.project.key ?? "Project loading"}</Badge>
            <Badge>{context?.task.number ?? run.taskId}</Badge>
            {run.requiresReview && <Badge tone="warning">review required</Badge>}
          </div>
          {contextError !== null && <p className="muted">Task context unavailable; showing run-owned backend fields.</p>}
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
          <div><strong>Backend run loaded</strong><span>{run.provider}</span></div>
          <div><strong>Task context loaded</strong><span>{context?.task.number ?? run.taskId}</span></div>
          <div><strong>Evidence attached</strong><span>{run.evidenceCount} items</span></div>
          <div><strong>Review state</strong><span>{run.status}</span></div>
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
