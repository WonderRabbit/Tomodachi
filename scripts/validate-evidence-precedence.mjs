#!/usr/bin/env node
import { access, lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";

const COMMAND = "validate-evidence-precedence";
const HEADER = ["source", "classification", "lifecycle", "commit", "last verified", "successor", "conflict", "follow-up"];
const PROMOTION = /(?:\.omo\b[^;|]{0,100}(?:(?:\b(?:as|be|become|becomes|is|promote|promotes|serve|serves|treat|treats|use|uses)\b|승격|사용|취급)[^;|]{0,40}\b(?:canonical|current|source[- ]of[- ]truth|authoritative|현행|정본|기준)\b|\b(?:canonical|current|source[- ]of[- ]truth|authoritative|현행|정본|기준)\b[^;|]{0,40}(?:\b(?:as|be|become|becomes|is|promote|promotes|serve|serves|treat|treats|use|uses)\b|승격|사용|취급))|\b(?:canonical|current|source[- ]of[- ]truth|authoritative|현행|정본|기준)\b[^;|]{0,40}(?:\b(?:as|be|become|becomes|is|promote|promotes|serve|serves|treat|treats|use|uses)\b|승격|사용|취급)[^;|]{0,100}\.omo\b)/iu;
const NEGATED_PROMOTIONS = [
  /\.omo\b[^;|—]{0,120}\b(?:historical|superseded|evidence)\b[^;|—]{0,40},?\s*(?:and\s+)?not\s+(?:a\s+|the\s+)?(?:canonical|current|source[- ]of[- ]truth|authoritative)\s+(?:guidance|source|contract|instruction)\b/iu,
  /\.omo\b[^,;|—]{0,60}\b(?:is|are|be|become|serve|treat|use)\s+(?:not|never)\s+(?:as\s+)?(?:a\s+|the\s+)?(?:canonical|current|source[- ]of[- ]truth|authoritative)\b/iu,
  /\.omo\b[^,;|—]{0,60}\b(?:can|do|does|must|should)\s+not\s+(?:be|become|promote|serve|treat|use)\s+(?:as\s+)?(?:a\s+|the\s+)?(?:canonical|current|source[- ]of[- ]truth|authoritative)\b/iu,
  /\.omo\b[^,;|—]{0,60}\b(?:cannot|can't)\s+(?:be\s+)?(?:a\s+|the\s+)?(?:canonical|current|source[- ]of[- ]truth|authoritative)\b/iu,
  /\b(?:canonical|current|source[- ]of[- ]truth|authoritative)\b[^,;|—]{0,30}\b(?:is|are)\s+(?:not|never)\s+\.omo\b/iu,
  /\b(?:do|does|must|should)\s+not\s+(?:promote|serve|treat|use)\s+\.omo\b[^,;|—]{0,30}\b(?:as\s+)?(?:a\s+|the\s+)?(?:canonical|current|source[- ]of[- ]truth|authoritative)\b/iu,
  /\.omo\b[^,;.!?|—]{0,80}(?:canonical|current|source[- ]of[- ]truth|authoritative|현행|정본|기준)[^,;.!?|—]{0,30}(?:승격|사용|취급)(?:하지\s*(?:않|말)|하거나[^,;.!?|—]{0,60}(?:다시\s+)?쓰지\s*않)/iu,
];
const NEGATION = /(?:do not|does not|must not|never|cannot|can't|not (?:a |the )?|금지|아니|않|못|대체하면 안|승격하지)/iu;
const EVIDENCE_MARKER = /(?:histor(?:y|ical)|evidence|local|dated|snapshot|proof|provenance|immutable|original|ignored local state|이력|증거|과거|로컬|원본|불변|오래된)/iu;
const CONCRETE_REFERENCE = /\.omo(?:\/[A-Za-z0-9._-]+)+(?:[:#][A-Za-z0-9._-]+(?:-[A-Za-z0-9._-]+)?)?/gu;
const IMMUTABLE_EVIDENCE_ROOT = ".omo/evidence";

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

class ContractError extends Error {
  constructor(violations) {
    super(violations.join("\n"));
    this.name = "ContractError";
  }
}

function parseArgs(argv) {
  const values = new Map();
  const flags = new Set(["--plans", "--history-index", "--forbid-unclassified-current-source", "--forbid-current-source"]);
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (typeof flag !== "string" || !flags.has(flag)) throw new UsageError(`unknown argument: ${flag ?? "<missing>"}`);
    if (values.has(flag)) throw new UsageError(`duplicate argument: ${flag}`);
    if (typeof value !== "string" || value.startsWith("--")) throw new UsageError(`missing value for ${flag}`);
    values.set(flag, value);
  }
  const plans = values.get("--plans");
  if (plans === undefined) throw new UsageError("missing required argument: --plans");
  const strict = values.get("--forbid-unclassified-current-source");
  const compatible = values.get("--forbid-current-source");
  if ((strict === undefined) === (compatible === undefined)) {
    throw new UsageError("provide exactly one forbid mode");
  }
  return {
    plans,
    historyIndex: values.get("--history-index") ?? "plan/history/index.md",
    evidenceRoot: strict ?? compatible,
  };
}

function lexicalRepoPath(value, label) {
  if (value.length === 0 || value.includes("\0") || value.includes("\\")) {
    throw new UsageError(`${label} must be a non-empty POSIX path without backslashes`);
  }
  const normalized = path.posix.normalize(value.replace(/^\.\//u, ""));
  if (path.posix.isAbsolute(normalized) || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new UsageError(`${label} must stay within the repository: ${value}`);
  }
  return normalized;
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function prerequisite(repoRoot, value, label, expectedType) {
  const repoPath = lexicalRepoPath(value, label);
  const absolute = path.resolve(repoRoot, repoPath);
  if (!isContained(repoRoot, absolute)) throw new UsageError(`${label} escapes repository root: ${value}`);
  let canonical;
  try {
    await access(absolute);
    canonical = await realpath(absolute);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new UsageError(`${label} is not readable: ${value}: ${detail}`);
  }
  if (!isContained(repoRoot, canonical)) throw new UsageError(`${label} resolves outside repository: ${value}`);
  const stats = await lstat(absolute);
  const validType = expectedType === "directory" ? stats.isDirectory() : stats.isFile();
  if (!validType) throw new UsageError(`${label} must be a ${expectedType}: ${value}`);
  return { absolute, repoPath };
}

async function markdownFiles(directory, repoRoot) {
  const files = [];
  const visit = async (current) => {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const candidate = path.join(current, entry.name);
      const canonical = await realpath(candidate);
      if (!isContained(repoRoot, canonical)) throw new UsageError(`plan entry resolves outside repository: ${candidate}`);
      if (entry.isSymbolicLink()) throw new UsageError(`plan traversal does not allow symbolic links: ${candidate}`);
      if (entry.isDirectory()) await visit(candidate);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(candidate);
    }
  };
  await visit(directory);
  return files;
}

function cells(line) {
  return line.trim().slice(1, -1).split("|").map((cell) => cell.trim().replace(/^`|`$/gu, ""));
}

function parseIndex(contents) {
  const lines = contents.split(/\r?\n/u);
  const headerIndex = lines.findIndex((line) => line.trim().startsWith("|") && cells(line).map((cell) => cell.toLowerCase()).join("|") === HEADER.join("|"));
  if (headerIndex < 0) throw new UsageError(`history index must contain the eight-column lifecycle table: ${HEADER.join(" | ")}`);
  const divider = lines[headerIndex + 1];
  if (divider === undefined || cells(divider).length !== HEADER.length || cells(divider).some((cell) => !/^:?-{3,}:?$/u.test(cell))) {
    throw new UsageError("history index lifecycle table has a malformed divider");
  }
  const classifications = new Map();
  for (let index = headerIndex + 2; index < lines.length && lines[index]?.trim().startsWith("|"); index += 1) {
    const row = cells(lines[index]);
    if (row.length !== HEADER.length || row.some((cell) => cell.length === 0)) throw new UsageError(`history index row ${index + 1} is malformed`);
    const source = lexicalRepoPath(row[0], `history index row ${index + 1} source`);
    if (classifications.has(source)) throw new UsageError(`history index repeats source: ${source}`);
    classifications.set(source, { classification: row[1].toLowerCase(), lifecycle: row[2].toLowerCase() });
  }
  return classifications;
}

function normalizedReference(reference) {
  return reference.replace(/[:#][A-Za-z0-9._-]+(?:-[A-Za-z0-9._-]+)?$/u, "");
}

function isHistoricalEvidence(record) {
  if (record === undefined) return false;
  const statuses = [record.classification, record.lifecycle];
  return !statuses.includes("canonical") && statuses.some((status) => status === "historical-evidence" || status === "superseded");
}

function classifiedReference(reference, classifications) {
  let candidate = reference;
  while (candidate.startsWith(".omo/")) {
    const record = classifications.get(candidate);
    if (record !== undefined) return record;
    candidate = path.posix.dirname(candidate);
  }
  return undefined;
}

function validateLine(line, location, classifications) {
  const violations = [];
  const promotes = line
    .split(/[;|]|[.!?](?=\s|$)/u)
    .some((clause) => PROMOTION.test(clause) && !NEGATED_PROMOTIONS.some((pattern) => pattern.test(clause)));
  if (promotes) violations.push(`${location}: .omo cannot be promoted as canonical/current/source-of-truth`);
  const references = [...line.matchAll(CONCRETE_REFERENCE)].map((match) => normalizedReference(match[0]));
  for (const reference of references) {
    if (reference === IMMUTABLE_EVIDENCE_ROOT || reference.startsWith(`${IMMUTABLE_EVIDENCE_ROOT}/`)) continue;
    const record = classifiedReference(reference, classifications);
    if (!isHistoricalEvidence(record)) violations.push(`${location}: unclassified .omo reference: ${reference}`);
  }
  const generic = line.includes(".omo") && references.length === 0;
  if (generic && !promotes && !NEGATION.test(line) && !EVIDENCE_MARKER.test(line)) {
    violations.push(`${location}: generic .omo policy lacks an explicit evidence/history marker`);
  }
  return violations;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = await realpath(process.cwd());
  const plans = await prerequisite(repoRoot, options.plans, "--plans", "directory");
  const historyIndex = await prerequisite(repoRoot, options.historyIndex, "--history-index", "file");
  await prerequisite(repoRoot, options.evidenceRoot, "forbid source", "directory");
  const classifications = parseIndex(await readFile(historyIndex.absolute, "utf8"));
  const files = await markdownFiles(plans.absolute, repoRoot);
  const violations = [...classifications.entries()]
    .filter(([source, record]) => source.startsWith(".omo/") && !isHistoricalEvidence(record))
    .map(([source]) => `history index: .omo source must be historical-evidence or superseded: ${source}`);
  for (const file of files) {
    const relative = path.relative(repoRoot, file).split(path.sep).join("/");
    const lines = (await readFile(file, "utf8")).split(/\r?\n/u);
    lines.forEach((line, index) => violations.push(...validateLine(line, `${relative}:${index + 1}`, classifications)));
  }
  violations.sort((left, right) => left.localeCompare(right, "en"));
  if (violations.length > 0) throw new ContractError(violations);
  const indexedEvidence = [...classifications.entries()]
    .filter(([, record]) => isHistoricalEvidence(record))
    .map(([source]) => source)
    .sort((left, right) => left.localeCompare(right, "en"));
  process.stdout.write(`${JSON.stringify({ command: COMMAND, ok: true, files: files.length, indexedEvidence })}\n`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const exitCode = error instanceof ContractError ? 1 : 2;
  process.stderr.write(`${COMMAND}: ${message}\n`);
  process.stdout.write(`${JSON.stringify({ command: COMMAND, ok: false, exitCode })}\n`);
  process.exitCode = exitCode;
}
