#!/usr/bin/env node
import { access } from "node:fs/promises";
import {
  CliError,
  ContractError,
  normalizeRepoPath,
  readUtf8,
  resolveContained,
  runCli,
} from "./lib/validator-runtime.mjs";

const precedence = [
  "current-tracked-source",
  "git-chronology",
  "plan-docs",
  "classified-historical-evidence",
];
const header = [
  "Source",
  "Classification",
  "Lifecycle",
  "Commit",
  "Last verified",
  "Successor",
  "Conflict",
  "Follow-up",
];
const classifications = new Set(["canonical", "superseded", "historical-evidence"]);
const lifecycles = new Set(["active", "completed", "pending", "mixed"]);
const legacyStatuses = new Set(["active", "completed", "superseded", "historical-evidence"]);
const identifierPattern = /^(?:none|[a-z0-9]+(?:-[a-z0-9]+)*)$/u;
const expectedRecords = new Map([
  ["plan/tomodachi-work-history-improvement.md", ["canonical", "completed", "-", "none"]],
  ["plan/tomodachi-env-cicd.md", ["canonical", "completed", "-", "none"]],
  ["plan/ui-ux-mvp-flow.md", ["canonical", "active", "-", "none"]],
  [".omo/boulder.json", ["historical-evidence", "completed", "-", "none"]],
  [".omo/plans/one-command-tomodachi-install-deploy.md", ["superseded", "pending", "plan/tomodachi-env-cicd.md", "all-unchecked-despite-implementation"]],
  [".omo/plans/tomodachi-env-cicd.md", ["historical-evidence", "completed", "-", "none"]],
  [".omo/plans/tomodachi-work-history-improvement.md", ["historical-evidence", "completed", "-", "none"]],
  [".omo/ulw-loop/019ee8d0-1873-7141-aed5-6920ce8ce695", ["historical-evidence", "completed", "-", "none"]],
  [".omo/ulw-loop/019ef9e6-3db3-7e73-ac4e-e803b001bbe4", ["historical-evidence", "mixed", "-", "g001-review-blocked-g002-complete-no-aggregate"]],
  [".omo/ulw-loop/tomodachi-db-init-20260621", ["superseded", "pending", ".omo/ulw-loop/tomodachi-db-init-single-20260621", "seven-pending-plan-created-duplicated-by-completed-run"]],
  [".omo/ulw-loop/tomodachi-db-init-single-20260621", ["historical-evidence", "completed", "-", "none"]],
  [".omo/ulw-loop/tomodachi-integration-docs-20260621", ["historical-evidence", "completed", "-", "none"]],
  [".omo/ulw-loop/tomodachi-work-history-implementation-20260712", ["historical-evidence", "completed", "-", "none"]],
]);

function parseArguments(argv) {
  let file;
  let phase = "complete";
  let phaseSeen = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--phase") {
      if (phaseSeen) throw new CliError("duplicate flag: --phase");
      const value = argv[index + 1];
      if (value !== "precedence" && value !== "complete") {
        throw new CliError("--phase requires precedence or complete");
      }
      phase = value;
      phaseSeen = true;
      index += 1;
    } else if (token.startsWith("-")) {
      throw new CliError(`unknown flag: ${token}`);
    } else if (file === undefined) {
      file = token;
    } else {
      throw new CliError(`unexpected argument: ${token}`);
    }
  }
  if (file === undefined) {
    throw new CliError("usage: validate-history-index.mjs <file> [--phase precedence|complete]");
  }
  return { file, phase };
}

function markdownCells(line) {
  if (!line.startsWith("|") || !line.endsWith("|")) return undefined;
  return line.slice(1, -1).split("|").map((cell) => cell.trim());
}

function parseTable(markdown) {
  let observedHeader;
  const rows = [];
  for (const [offset, line] of markdown.split(/\r?\n/u).entries()) {
    const cells = markdownCells(line);
    if (cells === undefined || cells.every((cell) => /^:?-+:?$/u.test(cell))) continue;
    if (cells[0]?.toLowerCase() === "source") {
      observedHeader = cells;
    } else if (observedHeader !== undefined) {
      rows.push({ cells, line: offset + 1 });
    }
  }
  if (observedHeader === undefined || rows.length === 0) {
    throw new ContractError("history index has no lifecycle rows");
  }
  return { observedHeader, rows };
}

function validateCommitAndDate(commit, lastVerified, line) {
  if (!/^(?:[0-9a-f]{40}|working-tree)$/u.test(commit)) {
    throw new ContractError(`line ${line}: commit must be a full lowercase SHA or working-tree`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(lastVerified)) {
    throw new ContractError(`line ${line}: missing or invalid last-verified`);
  }
}

function validateLegacyRow(row) {
  if (row.cells.length !== 5) throw new ContractError(`line ${row.line}: expected five legacy columns`);
  const [sourceRaw, status, commit, lastVerified, successorRaw] = row.cells;
  const source = normalizeRepoPath(sourceRaw, `line ${row.line} source`);
  validateCommitAndDate(commit, lastVerified, row.line);
  if (!legacyStatuses.has(status)) throw new ContractError(`line ${row.line}: invalid status: ${status}`);
  if (status === "superseded") {
    const successor = normalizeRepoPath(successorRaw, `line ${row.line} successor`);
    if (successor === source) throw new ContractError(`line ${row.line}: successor cannot reference itself`);
  } else if (successorRaw !== "-") {
    throw new ContractError(`line ${row.line}: successor must be - unless superseded`);
  }
  return source;
}

function validateCompleteRow(row) {
  if (row.cells.length !== header.length) throw new ContractError(`line ${row.line}: expected eight columns`);
  const [sourceRaw, classification, lifecycle, commit, lastVerified, successorRaw, conflict, followUp] = row.cells;
  const source = normalizeRepoPath(sourceRaw, `line ${row.line} source`);
  validateCommitAndDate(commit, lastVerified, row.line);
  if (!classifications.has(classification)) {
    throw new ContractError(`line ${row.line}: invalid classification: ${classification}`);
  }
  if (!lifecycles.has(lifecycle)) throw new ContractError(`line ${row.line}: invalid lifecycle: ${lifecycle}`);
  if (!identifierPattern.test(conflict)) throw new ContractError(`line ${row.line}: malformed conflict identifier`);
  if (!identifierPattern.test(followUp) || followUp === "none") {
    throw new ContractError(`line ${row.line}: malformed or empty follow-up identifier`);
  }
  if (classification === "canonical" && !source.startsWith("plan/")) {
    throw new ContractError(`line ${row.line}: canonical source must be under plan/`);
  }
  if (classification === "historical-evidence" && !source.startsWith(".omo/")) {
    throw new ContractError(`line ${row.line}: historical-evidence source must be under .omo/`);
  }
  let successor = "-";
  if (classification === "superseded") {
    successor = normalizeRepoPath(successorRaw, `line ${row.line} successor`);
    if (successor === source) throw new ContractError(`line ${row.line}: successor cannot reference itself`);
  } else if (successorRaw !== "-") {
    throw new ContractError(`line ${row.line}: successor must be - unless superseded`);
  }
  return { source, classification, lifecycle, successor, conflict };
}

function validatePrecedence(markdown) {
  const observed = [...markdown.matchAll(/^\d+\. `([^`]+)`$/gmu)].map((match) => match[1]);
  if (observed.length !== precedence.length || observed.some((value, index) => value !== precedence[index])) {
    throw new ContractError(`evidence precedence must be: ${precedence.join(" > ")}`);
  }
}

async function validateComplete(table) {
  if (table.observedHeader.some((cell, index) => cell !== header[index]) || table.observedHeader.length !== header.length) {
    throw new ContractError(`complete phase requires header: ${header.join(" | ")}`);
  }
  const records = table.rows.map(validateCompleteRow);
  const sources = records.map((record) => record.source);
  if (new Set(sources).size !== sources.length) throw new ContractError("history index contains duplicate sources");
  const indexedSources = new Set(sources);
  for (const record of records) {
    if (record.classification === "superseded" && !indexedSources.has(record.successor)) {
      throw new ContractError(`bad successor for ${record.source}: ${record.successor} is not indexed`);
    }
    if (record.source.startsWith(".omo/ulw-loop/")) {
      for (const companion of ["goals.json", "ledger.jsonl"]) {
        try {
          await access(`${record.source}/${companion}`);
        } catch {
          throw new ContractError(`nonexistent ULW companion: ${record.source}/${companion}`);
        }
      }
    }
    const expected = expectedRecords.get(record.source);
    if (expected !== undefined) {
      const observed = [record.classification, record.lifecycle, record.successor, record.conflict];
      if (observed.some((value, index) => value !== expected[index])) {
        throw new ContractError(`lifecycle semantics mismatch for ${record.source}`);
      }
    }
  }
  const missing = [...expectedRecords.keys()].filter((source) => !indexedSources.has(source));
  const unexpected = sources.filter((source) => !expectedRecords.has(source));
  if (missing.length > 0) throw new ContractError(`missing required source: ${missing.join(", ")}`);
  if (unexpected.length > 0) throw new ContractError(`unexpected source: ${unexpected.join(", ")}`);
  return records.length;
}

await runCli("validate-history-index", async () => {
  const options = parseArguments(process.argv.slice(2));
  const historyFile = resolveContained(process.cwd(), options.file, "history index");
  const markdown = await readUtf8(historyFile, "history index");
  const table = parseTable(markdown);
  validatePrecedence(markdown);
  if (options.phase === "complete") {
    if (table.observedHeader.length === 5) {
      table.rows.map(validateLegacyRow);
      throw new ContractError(`complete phase requires header: ${header.join(" | ")}`);
    }
    const rows = await validateComplete(table);
    return { file: options.file, phase: options.phase, rows };
  }
  const sources = table.observedHeader.length === 5
    ? table.rows.map(validateLegacyRow)
    : table.rows.map(validateCompleteRow).map((record) => record.source);
  if (new Set(sources).size !== sources.length) throw new ContractError("history index contains duplicate sources");
  return { file: options.file, phase: options.phase, rows: sources.length };
});
