import { createHash } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export class CliError extends Error {
  constructor(message) {
    super(message);
    this.name = "CliError";
  }
}

export class ContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "ContractError";
  }
}

export function normalizeRepoPath(value, label = "path") {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    throw new CliError(`${label} must be a non-empty path`);
  }
  const candidate = value.replaceAll("\\", "/").replace(/^\.\//, "");
  const normalized = path.posix.normalize(candidate);
  if (path.posix.isAbsolute(normalized) || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new CliError(`${label} must stay within the repository: ${value}`);
  }
  return normalized;
}

export function resolveContained(root, value, label = "path") {
  const segments = typeof value === "string" ? value.split("/") : [];
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0") ||
    value.includes("\\") ||
    path.isAbsolute(value) ||
    segments.includes("..")
  ) {
    throw new CliError(`${label} must be a contained repository-relative path`);
  }
  let resolvedRoot;
  try {
    resolvedRoot = realpathSync(path.resolve(root));
  } catch {
    throw new CliError(`${label} repository root is not accessible`);
  }
  const resolved = path.resolve(resolvedRoot, value);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new CliError(`${label} escapes repository root: ${value}`);
  }
  let current = resolvedRoot;
  const parts = relative === "" ? [] : relative.split(path.sep);
  try {
    for (const [index, part] of parts.entries()) {
      current = path.join(current, part);
      const metadata = lstatSync(current);
      if (metadata.isSymbolicLink()) throw new CliError(`${label} must not contain symbolic links`);
      if (index < parts.length - 1 && !metadata.isDirectory()) {
        throw new CliError(`${label} parent must be a directory`);
      }
    }
    const canonical = realpathSync(resolved);
    const canonicalRelative = path.relative(resolvedRoot, canonical);
    if (canonicalRelative === ".." || canonicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(canonicalRelative)) {
      throw new CliError(`${label} resolves outside repository`);
    }
    return canonical;
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(`${label} is not an accessible repository entry`);
  }
}

function regularFilePath(file, label) {
  const absolute = path.resolve(file);
  const cwd = realpathSync(process.cwd());
  const root = absolute === cwd || absolute.startsWith(`${cwd}${path.sep}`) ? cwd : path.parse(absolute).root;
  const relative = path.relative(root, absolute);
  let current = root;
  try {
    for (const part of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, part);
      if (lstatSync(current).isSymbolicLink()) throw new CliError(`${label} must not contain symbolic links`);
    }
    const canonical = realpathSync(absolute);
    const metadata = lstatSync(canonical);
    if (!metadata.isFile()) throw new CliError(`${label} must be a regular file`);
    return canonical;
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(`${label} is not an accessible regular file`);
  }
}

export async function readUtf8(file, label = "file") {
  try {
    return await readFile(regularFilePath(file, label), "utf8");
  } catch (error) {
    if (error instanceof CliError) throw error;
    if (error instanceof Error) {
      throw new CliError(`${label} is not readable`);
    }
    throw error;
  }
}

export async function readJson(file, label = "JSON file") {
  const text = await readUtf8(file, label);
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new CliError(`${label} is malformed: ${file}: ${error.message}`);
    }
    throw error;
  }
}

export async function sha256File(file) {
  const contents = await readFile(regularFilePath(file, "hash input"));
  return createHash("sha256").update(contents).digest("hex");
}

export function assertObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CliError(`${label} must be a JSON object`);
  }
  return value;
}

export function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new CliError(`${label} must be an array of strings`);
  }
  return value;
}

export async function runCli(command, operation) {
  try {
    const details = await operation();
    process.stdout.write(`${JSON.stringify({ command, ok: true, ...details })}\n`);
  } catch (error) {
    const known = error instanceof CliError || error instanceof ContractError;
    const message = error instanceof Error ? error.message : String(error);
    const exitCode = error instanceof ContractError ? 1 : 2;
    process.stderr.write(`${command}: ${known ? message : `unexpected failure: ${message}`}\n`);
    process.stdout.write(`${JSON.stringify({ command, ok: false, exitCode })}\n`);
    process.exitCode = exitCode;
  }
}
