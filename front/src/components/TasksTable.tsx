import { Link } from "@tanstack/react-router";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { agentRuns, projects } from "../mockData";
import type { Task } from "../types";
import { Badge } from "./Primitives";
import { statusTone } from "./status";

const columnHelper = createColumnHelper<Task>();

const columns = [
  columnHelper.accessor("number", {
    header: "Task",
    cell: (info) => (
      <Link to="/tasks/$taskId" params={{ taskId: info.row.original.id }}>
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor("title", {
    header: "Title",
    cell: (info) => <span>{info.getValue()}</span>,
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => <Badge tone={statusTone(info.getValue())}>{info.getValue()}</Badge>,
  }),
  columnHelper.accessor("priority", {
    header: "Priority",
    cell: (info) => <Badge>{info.getValue()}</Badge>,
  }),
  columnHelper.accessor("assignee", {
    header: "Assignee",
  }),
  columnHelper.display({
    id: "context",
    header: "Context",
    cell: (info) => {
      const task = info.row.original;
      const project = projects.find((item) => item.id === task.projectId);
      const run = agentRuns.find((item) => item.id === task.agentRunIds[0]);
      return (
        <span className="muted">
          {project?.key ?? "No project"} · {task.artifacts.length} artifacts ·{" "}
          {run?.status ?? "No run"}
        </span>
      );
    },
  }),
  columnHelper.accessor("updated", {
    header: "Updated",
  }),
];

export function TasksTable({ data }: { data: Task[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="table-wrap">
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
