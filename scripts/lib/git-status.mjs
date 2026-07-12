import { spawnSync } from "node:child_process";
import { CliError, ContractError, normalizeRepoPath } from "./validator-runtime.mjs";

function runGit(repo, args) {
  const result = spawnSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
  });
  if (result.error) {
    throw new ContractError(`git invocation failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const diagnostic = result.stderr.trim() || `exit ${result.status}`;
    throw new ContractError(`git ${args[0]} failed: ${diagnostic}`);
  }
  return result.stdout;
}

function runGitStatus(repo, args) {
  const result = spawnSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
  });
  if (result.error) {
    throw new ContractError(`git invocation failed: ${result.error.message}`);
  }
  return result;
}

function normalizeGitPath(value, label) {
  if (value.includes("\\")) {
    throw new ContractError(`${label} contains literal backslash: ${value}`);
  }
  return normalizeRepoPath(value, label);
}

function parseEntry(raw) {
  if (raw.length < 4 || raw[2] !== " ") {
    throw new ContractError(`malformed git status entry: ${JSON.stringify(raw)}`);
  }
  return {
    code: raw.slice(0, 2),
    path: normalizeGitPath(raw.slice(3), "git status path"),
  };
}

export function parseStatusFixture(text) {
  const entries = [];
  for (const line of text.split(/\r?\n/u)) {
    if (line.trim().length === 0 || line.startsWith("#")) continue;
    if (line.length < 4 || line[2] !== " ") {
      throw new CliError(`malformed status fixture entry: ${JSON.stringify(line)}`);
    }
    entries.push(parseEntry(line));
  }
  return entries;
}

export function readGitStatus(repo) {
  const output = runGit(repo, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const fields = output.split("\0");
  const entries = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (field.length === 0) continue;
    const entry = parseEntry(field);
    entries.push(entry);
    if (/[RC]/u.test(entry.code)) {
      index += 1;
      const original = fields[index];
      if (!original) throw new ContractError(`rename entry lacks original path: ${entry.path}`);
      entries.push({ code: entry.code, path: normalizeGitPath(original, "rename source") });
    }
  }
  return entries;
}

export function readHead(repo) {
  return runGit(repo, ["rev-parse", "HEAD"]).trim();
}

export function assertAncestorOfHead(repo, commit, label) {
  const result = runGitStatus(repo, ["merge-base", "--is-ancestor", commit, "HEAD"]);
  if (result.status === 0) return;
  if (result.status === 1) {
    throw new ContractError(`${label} is not an ancestor of HEAD: ${commit}`);
  }
  const diagnostic = result.stderr.trim() || `exit ${result.status}`;
  throw new ContractError(`git merge-base failed: ${diagnostic}`);
}
