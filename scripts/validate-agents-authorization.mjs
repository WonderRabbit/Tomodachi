#!/usr/bin/env node

import {
  CliError,
  ContractError,
  assertObject,
  readJson,
  readUtf8,
  resolveContained,
  runCli,
  sha256File,
} from "./lib/validator-runtime.mjs";

const COMMAND = "validate-agents-authorization";
const VALUE_FLAGS = new Set(["--receipt", "--baseline"]);
const BOOLEAN_FLAGS = new Set(["--expect-no-authorized-writes"]);
const HEADER = ["path", "baseline_sha256", "authorization_status", "approver", "proposal_path", "permitted_scope"];
const PROTECTED_PATHS = ["AGENTS.md", "backend/AGENTS.md", "front/AGENTS.md", "research/AGENTS.md"];

function parseArgs(argv) {
  const values = new Map();
  const booleans = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (VALUE_FLAGS.has(flag)) {
      if (values.has(flag)) {
        throw new CliError(`duplicate flag: ${flag}`);
      }
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new CliError(`missing value for ${flag}`);
      }
      values.set(flag, value);
      index += 1;
      continue;
    }
    if (BOOLEAN_FLAGS.has(flag)) {
      if (booleans.has(flag)) {
        throw new CliError(`duplicate flag: ${flag}`);
      }
      booleans.add(flag);
      continue;
    }
    throw new CliError(`unknown flag: ${flag}`);
  }
  const receipt = values.get("--receipt");
  const baseline = values.get("--baseline");
  if (receipt === undefined || baseline === undefined || !booleans.has("--expect-no-authorized-writes")) {
    throw new CliError("--receipt, --baseline, and --expect-no-authorized-writes are required");
  }
  return { baseline, receipt };
}

function parseBaseline(value) {
  const baseline = assertObject(value, "baseline");
  if (!Array.isArray(baseline.protectedAgents) || baseline.protectedAgents.length !== 4) {
    throw new CliError("baseline protectedAgents must contain four entries");
  }
  const parsed = baseline.protectedAgents.map((entry, index) => {
    const item = assertObject(entry, `protectedAgents[${index}]`);
    if (typeof item.path !== "string" || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(item.sha256)) {
      throw new CliError(`protectedAgents[${index}] is malformed`);
    }
    return { path: item.path, sha256: item.sha256 };
  });
  const uniquePaths = new Set(parsed.map((entry) => entry.path));
  if (
    uniquePaths.size !== PROTECTED_PATHS.length ||
    parsed.length !== PROTECTED_PATHS.length ||
    PROTECTED_PATHS.some((protectedPath) => !uniquePaths.has(protectedPath))
  ) {
    throw new ContractError("baseline protectedAgents must contain the exact unique protected path set");
  }
  return parsed;
}

function parseTable(text) {
  const lines = text.split(/\r?\n/u);
  const headerIndex = lines.findIndex((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()).join("|") === HEADER.join("|"));
  if (headerIndex < 0 || !/^\|(?:\s*:?-{3,}:?\s*\|){6}$/u.test(lines[headerIndex + 1] ?? "")) {
    throw new CliError("authorization receipt table header is malformed");
  }
  const rows = lines.slice(headerIndex + 2, headerIndex + 6).map((line) => {
    if (!line.startsWith("|")) {
      throw new CliError("authorization receipt must contain four consecutive rows");
    }
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== HEADER.length || cells.some((cell) => cell.length === 0)) {
      throw new CliError("authorization receipt row is malformed");
    }
    return Object.fromEntries(HEADER.map((name, index) => [name, cells[index]]));
  });
  const unexpectedRow = lines
    .slice(headerIndex + 6)
    .find((line) => /^\s*\|.*\|\s*$/u.test(line) || /^\s*(?:authorization_status|approver|proposal_path)\s*:/u.test(line));
  if (unexpectedRow !== undefined) {
    throw new ContractError("authorization receipt contains a row after the canonical four-row table");
  }
  return rows;
}

await runCli(COMMAND, async () => {
  const repoRoot = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  const baseline = parseBaseline(await readJson(resolveContained(repoRoot, args.baseline, "baseline"), "baseline"));
  const receiptText = await readUtf8(resolveContained(repoRoot, args.receipt, "receipt"), "receipt");
  const rows = parseTable(receiptText);
  const rowsByPath = new Map(rows.map((row) => [row.path, row]));
  if (rowsByPath.size !== rows.length) {
    throw new ContractError("authorization receipt contains duplicate paths");
  }
  if (
    rowsByPath.size !== PROTECTED_PATHS.length ||
    PROTECTED_PATHS.some((protectedPath) => !rowsByPath.has(protectedPath))
  ) {
    throw new ContractError("authorization receipt must contain the exact protected path set");
  }
  for (const expected of baseline) {
    const row = rowsByPath.get(expected.path);
    if (row === undefined) {
      throw new ContractError(`authorization receipt is missing ${expected.path}`);
    }
    if (row.baseline_sha256 !== expected.sha256) {
      throw new ContractError(`baseline hash mismatch in receipt: ${expected.path}`);
    }
    if (row.authorization_status !== "pending" || row.approver !== "null") {
      throw new ContractError(`unauthorized AGENTS write state: ${expected.path}`);
    }
    const expectedProposal = `plan/history/proposals/${expected.path.replaceAll("/", "-")}`;
    if (row.proposal_path !== expectedProposal || row.permitted_scope.length < 10) {
      throw new ContractError(`proposal scope is invalid: ${expected.path}`);
    }
    const actualHash = await sha256File(resolveContained(repoRoot, expected.path, "protected AGENTS path"));
    if (actualHash !== expected.sha256) {
      throw new ContractError(`protected AGENTS content changed without authorization: ${expected.path}`);
    }
  }
  return { authorizedWrites: 0, pending: 4, protectedOriginals: 4 };
});
