#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  CliError,
  ContractError,
  assertObject,
  assertStringArray,
  normalizeRepoPath,
  readJson,
  readUtf8,
  resolveContained,
  runCli,
  sha256File,
} from "./lib/validator-runtime.mjs";

const COMMAND = "validate-guidance";
const VALUE_FLAGS = new Set(["--input", "--inventory", "--proposal-dir"]);
const BOOLEAN_FLAGS = new Set(["--proposal-only"]);
const CANONICAL_PROPOSAL_DIR = "plan/history/proposals";
const EXPECTED_AREAS = [
  ".github/workflows",
  "backend",
  "db",
  "deploy",
  "docs",
  "front",
  "plan",
  "research",
  "scripts",
];
const EXPECTED_GUIDANCE = new Map([
  ["AGENTS.md", "plan/history/proposals/AGENTS.md"],
  ["backend/AGENTS.md", "plan/history/proposals/backend-AGENTS.md"],
  ["front/AGENTS.md", "plan/history/proposals/front-AGENTS.md"],
  ["research/AGENTS.md", "plan/history/proposals/research-AGENTS.md"],
]);
const STALE_CLAIMS = [
  /(?:\.github\/workflows|workflow|워크플로)[^\n]{0,30}(?:없|존재하지 않)/iu,
  /(?:CI|배포)[^\n]{0,30}(?:로컬 명령으로만|local commands? only)/iu,
];

function parseArgs(argv) {
  const values = new Map();
  const booleans = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (BOOLEAN_FLAGS.has(flag)) {
      if (booleans.has(flag)) {
        throw new CliError(`duplicate flag: ${flag}`);
      }
      booleans.add(flag);
      continue;
    }
    if (!VALUE_FLAGS.has(flag)) {
      throw new CliError(`unknown flag: ${flag}`);
    }
    if (values.has(flag)) {
      throw new CliError(`duplicate flag: ${flag}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new CliError(`missing value for ${flag}`);
    }
    values.set(flag, value);
    index += 1;
  }
  const inventory = values.get("--inventory");
  const input = values.get("--input");
  const explicitProposalDir = values.get("--proposal-dir");
  const proposalOnly = booleans.has("--proposal-only");
  const modeCount = [input !== undefined, explicitProposalDir !== undefined, proposalOnly].filter(Boolean).length;
  if (modeCount !== 1) {
    throw new CliError("exactly one of --input, --proposal-dir, or --proposal-only is required");
  }
  if ((explicitProposalDir !== undefined || proposalOnly) && inventory === undefined) {
    throw new CliError("--inventory is required for proposal validation");
  }
  return { input, inventory, proposalDir: proposalOnly ? CANONICAL_PROPOSAL_DIR : explicitProposalDir, proposalOnly };
}

function gitLines(repoRoot, args) {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean)
      .sort();
  } catch (error) {
    if (error instanceof Error) {
      throw new CliError(`git command failed: ${error.message}`);
    }
    throw error;
  }
}

function assertAncestorOfHead(repoRoot, commit, label) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { cwd: repoRoot, encoding: "utf8" });
  } catch (error) {
    if (error instanceof Error) {
      throw new ContractError(`${label} is not an ancestor of HEAD: ${commit}`);
    }
    throw error;
  }
}

function parseInventory(value) {
  const inventory = assertObject(value, "inventory");
  if (inventory.schemaVersion !== 1 || typeof inventory.head !== "string") {
    throw new CliError("inventory schemaVersion/head is malformed");
  }
  const protectedGuidance = inventory.protectedGuidance;
  if (!Array.isArray(protectedGuidance) || protectedGuidance.length !== 4) {
    throw new CliError("inventory protectedGuidance must contain four entries");
  }
  const parsedGuidance = protectedGuidance.map((entry, index) => {
    const item = assertObject(entry, `protectedGuidance[${index}]`);
    if (
      typeof item.path !== "string" ||
      typeof item.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(item.sha256) ||
      (item.baselineSha256 !== undefined && (typeof item.baselineSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(item.baselineSha256))) ||
      typeof item.proposal !== "string"
    ) {
      throw new CliError(`protectedGuidance[${index}] is malformed`);
    }
    return { baselineSha256: item.baselineSha256, path: item.path, proposal: item.proposal, sha256: item.sha256 };
  });
  const trackedAreas = assertStringArray(inventory.trackedAreas, "trackedAreas");
  const trackedFiles = assertObject(inventory.trackedFiles, "trackedFiles");
  const parsed = {
    head: inventory.head,
    protectedGuidance: parsedGuidance,
    trackedAreas,
    trackedFiles: {
      deploy: assertStringArray(trackedFiles.deploy, "trackedFiles.deploy"),
      docs: assertStringArray(trackedFiles.docs, "trackedFiles.docs"),
      scripts: assertStringArray(trackedFiles.scripts, "trackedFiles.scripts"),
      workflows: assertStringArray(trackedFiles.workflows, "trackedFiles.workflows"),
    },
  };
  const guidanceByPath = new Map(parsed.protectedGuidance.map((entry) => [entry.path, entry]));
  if (guidanceByPath.size !== EXPECTED_GUIDANCE.size || parsed.protectedGuidance.length !== EXPECTED_GUIDANCE.size) {
    throw new ContractError("protectedGuidance must contain the exact unique protected path set");
  }
  for (const [protectedPath, proposal] of EXPECTED_GUIDANCE) {
    if (guidanceByPath.get(protectedPath)?.proposal !== proposal) {
      throw new ContractError(`protectedGuidance proposal mapping is invalid: ${protectedPath}`);
    }
  }
  const uniqueAreas = new Set(parsed.trackedAreas);
  if (
    uniqueAreas.size !== EXPECTED_AREAS.length ||
    parsed.trackedAreas.length !== EXPECTED_AREAS.length ||
    EXPECTED_AREAS.some((area) => !uniqueAreas.has(area))
  ) {
    throw new ContractError("trackedAreas must contain the exact unique topology set");
  }
  return parsed;
}

function assertSameFiles(label, expected, actual) {
  const left = [...expected].sort();
  if (left.length !== actual.length || left.some((item, index) => item !== actual[index])) {
    throw new ContractError(`${label} inventory is stale; expected=${JSON.stringify(actual)} actual=${JSON.stringify(left)}`);
  }
}

async function validateInventory(repoRoot, inventory) {
  assertAncestorOfHead(repoRoot, inventory.head, "inventory head");
  for (const [label, prefix] of [
    ["workflows", ".github/workflows"],
    ["deploy", "deploy"],
    ["docs", "docs"],
    ["scripts", "scripts"],
  ]) {
    assertSameFiles(label, inventory.trackedFiles[label], gitLines(repoRoot, ["ls-files", "--", prefix]));
  }
  for (const entry of inventory.protectedGuidance) {
    const actual = await sha256File(resolveContained(repoRoot, entry.path, "protected guidance path"));
    if (actual !== entry.sha256) {
      throw new ContractError(`protected guidance changed without inventory update: ${entry.path}`);
    }
  }
}

function rejectStaleClaims(text, label) {
  if (STALE_CLAIMS.some((pattern) => pattern.test(text))) {
    throw new ContractError(`stale workflow claim detected in ${label}`);
  }
}

function assertProposalContract(text, entry) {
  rejectStaleClaims(text, entry.proposal);
  if (!/[가-힣]/u.test(text)) {
    throw new ContractError(`proposal must contain Korean guidance: ${entry.proposal}`);
  }
  for (const marker of ["0a07266d53b83cd07017ec912c616eecbcc3d693", entry.baselineSha256 ?? entry.sha256, "proposal-only"]) {
    if (!text.includes(marker)) {
      throw new ContractError(`proposal is missing marker ${marker}: ${entry.proposal}`);
    }
  }
  const scopedMarkers = {
    "AGENTS.md": [".github/workflows", "deploy/", "docs/", "scripts/", "direct database access", "panel 단위 fallback"],
    "backend/AGENTS.md": ["TaskTransitionService", "application.yml", "db/init.sql", "repository direct-read"],
    "front/AGENTS.md": ["backendIntegrationEnabled", "dataSource", "panel fallback", "agent tool을 직접 호출하지 않는다"],
    "research/AGENTS.md": ["observed_at", "output digest", "stable fact가 아니다", "실행 지시가 아니라"],
  };
  for (const marker of scopedMarkers[entry.path] ?? []) {
    if (!text.includes(marker)) {
      throw new ContractError(`proposal is missing scoped guidance ${marker}: ${entry.proposal}`);
    }
  }
}

await runCli(COMMAND, async () => {
  const repoRoot = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  if (args.input !== undefined) {
    if (args.inventory !== undefined) {
      const inventory = parseInventory(await readJson(resolveContained(repoRoot, args.inventory, "inventory"), "inventory"));
      await validateInventory(repoRoot, inventory);
    }
    const text = await readUtf8(resolveContained(repoRoot, args.input, "input"), "input");
    rejectStaleClaims(text, args.input);
    return { mode: "input", validated: [args.input] };
  }
  const inventory = parseInventory(await readJson(resolveContained(repoRoot, args.inventory, "inventory"), "inventory"));
  await validateInventory(repoRoot, inventory);
  const proposalDirPath = normalizeRepoPath(args.proposalDir, "proposal directory");
  if (proposalDirPath !== CANONICAL_PROPOSAL_DIR) {
    throw new ContractError(`proposal directory must be ${CANONICAL_PROPOSAL_DIR}: ${proposalDirPath}`);
  }
  const proposalDir = resolveContained(repoRoot, proposalDirPath, "proposal directory");
  for (const entry of inventory.protectedGuidance) {
    const proposalFile = resolveContained(repoRoot, entry.proposal, "proposal");
    if (path.dirname(proposalFile) !== proposalDir) {
      throw new ContractError(`proposal is outside the canonical proposal directory: ${entry.proposal}`);
    }
    const text = await readUtf8(proposalFile, "proposal");
    assertProposalContract(text, entry);
  }
  return { mode: args.proposalOnly ? "proposal-only" : "proposal-dir", protectedOriginals: 4, validatedProposals: 4 };
});
