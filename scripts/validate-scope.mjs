#!/usr/bin/env node
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { parseStatusFixture, readGitStatus, readHead } from "./lib/git-status.mjs";
import {
  assertObject,
  assertStringArray,
  CliError,
  ContractError,
  normalizeRepoPath,
  readJson,
  readUtf8,
  resolveContained,
  runCli,
  sha256File,
} from "./lib/validator-runtime.mjs";

const flagNames = new Set(["--repo", "--baseline", "--allowlist", "--agents-authorization", "--protected-omo-manifest", "--status-fixture"]);
const requiredMutableOmoPrefixes = [".omo/evidence/tomodachi-work-history-improvement/", ".omo/ulw-loop/tomodachi-work-history-implementation-20260712/"];
const requiredMutableOmoPaths = [".omo/boulder.json", ".omo/plans/tomodachi-work-history-improvement.md"];
const hardForbiddenPrefixes = ["backend/src/", "front/src/", "db/", ".github/workflows/", "deploy/"];
const hardAgentRunImplementation = /(?:^|\/)(?:agent[-_]?run|AgentRun)[^/]*\.(?:kt|sql|ts|tsx)$/u;
const agentsAuthorizationPath = "plan/history/agents-authorizations.md";

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flagNames.has(flag)) throw new CliError(`unknown flag: ${flag}`);
    if (values.has(flag)) throw new CliError(`duplicate flag: ${flag}`);
    if (value === undefined || value.startsWith("--")) throw new CliError(`${flag} requires a value`);
    values.set(flag, value);
  }
  for (const required of ["--baseline", "--allowlist"]) {
    if (!values.has(required)) throw new CliError(`missing required flag: ${required}`);
  }
  return {
    repo: path.resolve(values.get("--repo") ?? "."),
    baseline: values.get("--baseline"),
    allowlist: values.get("--allowlist"),
    agentsAuthorization: values.get("--agents-authorization"),
    protectedManifest: values.get("--protected-omo-manifest"),
    statusFixture: values.get("--status-fixture"),
  };
}

function parseHashRecords(value, label) {
  if (!Array.isArray(value)) throw new CliError(`${label} must be an array`);
  return value.map((item, index) => {
    const record = assertObject(item, `${label}[${index}]`);
    if (typeof record.path !== "string" || !/^[0-9a-f]{64}$/u.test(record.sha256)) {
      throw new CliError(`${label}[${index}] requires path and SHA-256`);
    }
    return { path: normalizeRepoPath(record.path, `${label}[${index}].path`), sha256: record.sha256 };
  });
}

function parseBaseline(value) {
  const baseline = assertObject(value, "baseline");
  if (baseline.schemaVersion !== 1 || !/^[0-9a-f]{40}$/u.test(baseline.head)) {
    throw new CliError("baseline requires schemaVersion 1 and a full HEAD SHA-1");
  }
  const manifest = assertObject(baseline.protectedOmoManifest, "baseline.protectedOmoManifest");
  if (
    typeof manifest.path !== "string" ||
    !/^[0-9a-f]{64}$/u.test(manifest.sha256) ||
    !Number.isInteger(manifest.entries) ||
    manifest.entries < 1
  ) {
    throw new CliError("baseline.protectedOmoManifest requires path, SHA-256, and positive entries");
  }
  const mutableOmoPrefixes = assertStringArray(value.mutableOmoPrefixes, "baseline.mutableOmoPrefixes").map((item) => {
    const prefix = normalizeRepoPath(item, "baseline.mutableOmoPrefixes entry");
    if (prefix !== item || !prefix.startsWith(".omo/") || !prefix.endsWith("/")) {
      throw new CliError(`mutable .omo prefix is not canonical: ${item}`);
    }
    return prefix;
  });
  if (
    mutableOmoPrefixes.length !== requiredMutableOmoPrefixes.length ||
    new Set(mutableOmoPrefixes).size !== requiredMutableOmoPrefixes.length ||
    requiredMutableOmoPrefixes.some((prefix) => !mutableOmoPrefixes.includes(prefix))
  ) {
    throw new ContractError(`mutable .omo prefixes must be exactly: ${requiredMutableOmoPrefixes.join(", ")}`);
  }
  const mutableOmoPaths = assertStringArray(value.mutableOmoPaths, "baseline.mutableOmoPaths").map((item) => {
    const repoPath = normalizeRepoPath(item, "baseline.mutableOmoPaths entry");
    if (repoPath !== item || !repoPath.startsWith(".omo/") || repoPath.endsWith("/")) {
      throw new CliError(`mutable .omo path is not canonical: ${item}`);
    }
    return repoPath;
  });
  if (
    mutableOmoPaths.length !== requiredMutableOmoPaths.length ||
    new Set(mutableOmoPaths).size !== requiredMutableOmoPaths.length ||
    requiredMutableOmoPaths.some((repoPath) => !mutableOmoPaths.includes(repoPath))
  ) {
    throw new ContractError(`mutable .omo paths must be exactly: ${requiredMutableOmoPaths.join(", ")}`);
  }
  return {
    head: baseline.head,
    untrackedInputs: parseHashRecords(baseline.untrackedInputs, "baseline.untrackedInputs"),
    protectedAgents: parseHashRecords(baseline.protectedAgents, "baseline.protectedAgents"),
    manifest: { path: normalizeRepoPath(manifest.path), sha256: manifest.sha256, entries: manifest.entries },
    mutableOmoPrefixes,
    mutableOmoPaths,
  };
}

function parseAllowlist(value) {
  const allowlist = assertObject(value, "allowlist");
  if (allowlist.schemaVersion !== 1) throw new CliError("allowlist.schemaVersion must be 1");
  return {
    paths: new Set(assertStringArray(allowlist.allowedPaths, "allowlist.allowedPaths").map((item) => normalizeRepoPath(item))),
    prefixes: assertStringArray(allowlist.allowedPrefixes, "allowlist.allowedPrefixes").map((item) => {
      const prefix = normalizeRepoPath(item);
      if (!prefix.endsWith("/")) throw new CliError(`allowlist prefix must end with /: ${item}`);
      return prefix;
    }),
  };
}

async function verifyHashes(repo, records, label) {
  for (const record of records) {
    const file = resolveContained(repo, record.path, label);
    let actual;
    try {
      actual = await sha256File(file);
    } catch (error) {
      if (error instanceof Error) throw new ContractError(`${label} missing: ${record.path}`);
      throw error;
    }
    if (actual !== record.sha256) throw new ContractError(`${label} changed: ${record.path}`);
  }
}

function parseManifest(text, mutable) {
  const records = new Map();
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (line.length === 0) continue;
    const fields = line.split("\t");
    if (fields.length !== 3 || !/^\d+$/u.test(fields[1]) || !/^[0-9a-f]{64}$/u.test(fields[2])) {
      throw new CliError(`protected .omo manifest malformed at line ${index + 1}`);
    }
    const file = normalizeRepoPath(fields[0], `manifest line ${index + 1}`);
    if (
      !file.startsWith(".omo/") ||
      mutable.paths.includes(file) ||
      mutable.prefixes.some((prefix) => file.startsWith(prefix)) ||
      records.has(file)
    ) {
      throw new CliError(`protected .omo manifest has invalid path at line ${index + 1}: ${file}`);
    }
    records.set(file, { size: Number(fields[1]), sha256: fields[2] });
  }
  return records;
}

async function walkFiles(root, mutable, relative = "") {
  const directory = path.join(root, relative);
  const names = (await readdir(directory)).sort((left, right) => left.localeCompare(right, "en"));
  const files = [];
  for (const name of names) {
    const child = path.posix.join(relative.replaceAll(path.sep, "/"), name);
    const repoPath = `.omo/${child}`;
    if (mutable.paths.includes(repoPath) || mutable.prefixes.some((prefix) => repoPath.startsWith(prefix))) continue;
    const absolute = path.join(root, child);
    const metadata = await lstat(absolute);
    if (metadata.isDirectory()) files.push(...await walkFiles(root, mutable, child));
    else if (metadata.isFile()) files.push({ path: repoPath, size: metadata.size, absolute });
    else throw new ContractError(`protected .omo contains unsupported entry: .omo/${child}`);
  }
  return files;
}

async function verifyManifest(repo, supplied, expected) {
  const relative = normalizeRepoPath(supplied, "protected manifest");
  if (relative !== expected.path) throw new ContractError(`protected manifest path mismatch: ${relative}`);
  const absolute = resolveContained(repo, relative, "protected manifest");
  if (await sha256File(absolute) !== expected.sha256) throw new ContractError(`protected manifest changed: ${relative}`);
  const manifest = parseManifest(await readUtf8(absolute, "protected manifest"), expected.mutable);
  if (manifest.size !== expected.entries) {
    throw new ContractError(`protected manifest entry count mismatch: expected ${expected.entries}, found ${manifest.size}`);
  }
  const actualFiles = await walkFiles(path.join(repo, ".omo"), expected.mutable);
  if (manifest.size !== actualFiles.length) {
    throw new ContractError(`protected .omo file count mismatch: expected ${manifest.size}, found ${actualFiles.length}`);
  }
  for (const file of actualFiles) {
    const expectedFile = manifest.get(file.path);
    if (expectedFile === undefined) throw new ContractError(`protected .omo added: ${file.path}`);
    if (expectedFile.size !== file.size || expectedFile.sha256 !== await sha256File(file.absolute)) {
      throw new ContractError(`protected .omo changed: ${file.path}`);
    }
  }
}

function verifyStatus(entries, baselinePaths, allowlist) {
  const rejected = [];
  for (const entry of entries) {
    const hardForbidden = hardForbiddenPrefixes.some((prefix) => entry.path.startsWith(prefix)) || hardAgentRunImplementation.test(entry.path);
    const allowed = baselinePaths.has(entry.path)
      || allowlist.paths.has(entry.path)
      || allowlist.prefixes.some((prefix) => entry.path.startsWith(prefix));
    if (hardForbidden || !allowed) rejected.push(`${entry.code} ${entry.path}`);
  }
  if (rejected.length > 0) throw new ContractError(`forbidden worktree path(s): ${rejected.sort().join(", ")}`);
}

await runCli("validate-scope", async () => {
  const options = parseArguments(process.argv.slice(2));
  const baseline = parseBaseline(await readJson(resolveContained(options.repo, options.baseline, "baseline"), "baseline"));
  const allowlist = parseAllowlist(await readJson(resolveContained(options.repo, options.allowlist, "allowlist"), "allowlist"));
  for (const prefix of baseline.mutableOmoPrefixes) {
    resolveContained(options.repo, prefix.slice(0, -1), "mutable .omo prefix");
    if (!allowlist.prefixes.includes(prefix)) throw new ContractError(`mutable .omo prefix is not allowlisted: ${prefix}`);
  }
  for (const repoPath of baseline.mutableOmoPaths) {
    resolveContained(options.repo, repoPath, "mutable .omo path");
    if (!allowlist.paths.has(repoPath)) throw new ContractError(`mutable .omo path is not allowlisted: ${repoPath}`);
  }
  const head = readHead(options.repo);
  if (head !== baseline.head) throw new ContractError(`HEAD mismatch: expected ${baseline.head}, found ${head}`);
  await verifyHashes(options.repo, baseline.untrackedInputs, "pre-existing input");
  await verifyHashes(options.repo, baseline.protectedAgents, "protected AGENTS.md");
  if (options.agentsAuthorization !== undefined) {
    const receipt = normalizeRepoPath(options.agentsAuthorization, "agents authorization");
    if (receipt !== agentsAuthorizationPath) {
      throw new ContractError(`agents authorization path mismatch: ${receipt}`);
    }
    const contents = await readUtf8(resolveContained(options.repo, receipt, "agents authorization"), "agents authorization");
    if (contents.trim().length === 0) throw new ContractError(`agents authorization is empty: ${receipt}`);
  }
  if (options.protectedManifest !== undefined) {
    await verifyManifest(options.repo, options.protectedManifest, {
      ...baseline.manifest,
      mutable: { paths: baseline.mutableOmoPaths, prefixes: baseline.mutableOmoPrefixes },
    });
  }
  const entries = options.statusFixture === undefined
    ? readGitStatus(options.repo)
    : parseStatusFixture(await readUtf8(resolveContained(options.repo, options.statusFixture, "status fixture"), "status fixture"));
  verifyStatus(entries, new Set(baseline.untrackedInputs.map((record) => record.path)), allowlist);
  return {
    agentsAuthorization: options.agentsAuthorization !== undefined,
    checkedPaths: entries.length,
    head,
    protectedOmo: options.protectedManifest !== undefined,
  };
});
