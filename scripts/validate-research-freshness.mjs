#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import {
  CliError,
  ContractError,
  assertObject,
  normalizeRepoPath,
  readJson,
  readUtf8,
  resolveContained,
  runCli,
  sha256File,
} from "./lib/validator-runtime.mjs";

const COMMAND = "validate-research-freshness";
const EXPECTED_PACKS = [
  "opencode-ollama-orchestrator-models-20260621",
  "opencode-qwen-small-model",
  "opencode-qwen-tool-wrapper-strategy-20260621",
  "opencode-small-model-helper-cli",
];
const DIGEST = /^[a-f0-9]{64}$/u;
const LINK = "[FRESHNESS.md](./FRESHNESS.md)";
const PRODUCTION_MANIFEST = "plan/history/research-pack-manifest.json";

function exactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new ContractError(`${label} fields must be exactly: ${wanted.join(", ")}`);
  }
}

function normalizedText(value, label, minimum) {
  if (typeof value !== "string" || /[\p{Cc}\p{Cf}]/u.test(value)) throw new CliError(`${label} must be printable text`);
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
  const substance = [...normalized.matchAll(/[\p{L}\p{N}]/gu)].length;
  if (normalized.length < minimum || substance < Math.min(6, minimum)) throw new ContractError(`${label} is empty, vacuous, or too short`);
  return normalized;
}

function decodedEquivalents(value) {
  let decoded = value;
  for (let pass = 0; pass < 2; pass += 1) {
    decoded = decoded
      .replace(/&#(\d+);/gu, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 10)))
      .replace(/&#x([0-9a-f]+);/giu, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 16)))
      .replace(/%([0-9a-f]{2})/giu, (_, digits) => String.fromCharCode(Number.parseInt(digits, 16)));
  }
  return decoded.normalize("NFKC");
}

function freshnessLinkCount(readme, packId) {
  const markdown = [...readme.matchAll(/\[[^\]\r\n]*\]\(([^\)\r\n]*)\)/gu)].map((match) => match[1]);
  const html = [...readme.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']*)["'][^>]*>/giu)].map((match) => match[1]);
  return [...markdown, ...html].filter((destination) => {
    const decoded = decodedEquivalents(destination);
    if (/[\p{Cc}\p{Cf}]/u.test(decoded)) throw new ContractError(`${packId}: link destination contains encoded control characters`);
    const target = decoded.split(/[?#]/u)[0].replaceAll("\\", "/");
    return path.posix.basename(target).toLocaleLowerCase("en-US") === "freshness.md";
  }).length;
}

function canonicalPath(value, label) {
  if (typeof value !== "string" || value.includes("\\")) throw new CliError(`${label} must be a POSIX repository path`);
  const normalized = normalizeRepoPath(value, label);
  if (normalized !== value) throw new ContractError(`${label} must be canonical: ${value}`);
  return normalized;
}

function instant(value, label) {
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/u.exec(value) : null;
  if (match === null) {
    throw new CliError(`${label} must be an ISO-8601 instant with an explicit offset`);
  }
  const [year, month, day] = match.slice(1).map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
    throw new CliError(`${label} contains an invalid calendar date`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new CliError(`${label} is not a valid instant`);
  return milliseconds;
}

function stringList(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new CliError(`${label} must be a non-empty array`);
  const normalized = value.map((item, index) => normalizedText(item, `${label}[${index}]`, 4));
  if (new Set(normalized).size !== normalized.length) throw new ContractError(`${label} contains duplicate normalized values`);
  return normalized;
}

function parseArguments(argv) {
  if (argv[0] !== "--manifest" || typeof argv[1] !== "string") {
    throw new CliError("usage: validate-research-freshness.mjs --manifest <json> [--as-of <ISO-8601 instant>]");
  }
  const manifest = canonicalPath(argv[1], "--manifest");
  if (manifest !== PRODUCTION_MANIFEST && !manifest.startsWith("scripts/fixtures/research/")) {
    throw new ContractError(`--manifest must be ${PRODUCTION_MANIFEST} or a checked-in research fixture`);
  }
  if (argv.length === 2) return { asOf: Date.now(), manifest };
  if (argv.length !== 4 || argv[2] !== "--as-of" || typeof argv[3] !== "string") throw new CliError("unknown, duplicate, or incomplete argument");
  if (!manifest.startsWith("scripts/fixtures/research/")) throw new ContractError("--as-of is restricted to checked-in research fixtures");
  return { asOf: instant(argv[3], "--as-of"), manifest };
}

async function containedEntry(repoRoot, repoPath, kind) {
  const canonicalRoot = await realpath(repoRoot);
  const absolute = resolveContained(canonicalRoot, repoPath, repoPath);
  let current = canonicalRoot;
  for (const component of repoPath.split("/")) {
    current = path.join(current, component);
    if ((await lstat(current)).isSymbolicLink()) throw new ContractError(`${repoPath} has a symbolic-link component`);
  }
  const stats = await lstat(absolute);
  if ((kind === "file" && !stats.isFile()) || (kind === "directory" && !stats.isDirectory())) {
    throw new ContractError(`${repoPath} must be a regular ${kind}`);
  }
  const canonicalEntry = await realpath(absolute);
  if (canonicalEntry !== path.join(canonicalRoot, ...repoPath.split("/"))) throw new ContractError(`${repoPath} does not resolve to its canonical repository path`);
  return absolute;
}

function parseProbe(value) {
  const probe = assertObject(value, "localToolProbe");
  exactKeys(probe, ["command", "observedAt", "output", "outputSha256"], "localToolProbe");
  if (probe.command !== "sg --version" || typeof probe.output !== "string" || !/^ast-grep (?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(probe.output) || !DIGEST.test(probe.outputSha256)) {
    throw new ContractError("localToolProbe must store the inert sg --version output and a SHA-256 digest");
  }
  const expected = createHash("sha256").update(`${probe.output}\n`).digest("hex");
  if (probe.outputSha256 !== expected) throw new ContractError("localToolProbe output digest does not match stored output");
  return { milliseconds: instant(probe.observedAt, "localToolProbe.observedAt"), observedAt: probe.observedAt };
}

function parsePack(value, index) {
  const pack = assertObject(value, `packs[${index}]`);
  exactKeys(pack, ["id", "path", "readme", "freshnessFile", "observedAt"], `packs[${index}]`);
  for (const field of ["id", "path", "readme", "freshnessFile", "observedAt"]) {
    if (typeof pack[field] !== "string" || pack[field].length === 0) throw new CliError(`packs[${index}].${field} must be a non-empty string`);
  }
  const packPath = canonicalPath(pack.path, `packs[${index}].path`);
  const expectedPath = `research/${pack.id}`;
  if (packPath !== expectedPath || pack.readme !== `${expectedPath}/README.md` || pack.freshnessFile !== `${expectedPath}/FRESHNESS.md`) {
    throw new ContractError(`${pack.id}: path, README, and FRESHNESS paths must match the canonical pack layout`);
  }
  return { ...pack, observedMilliseconds: instant(pack.observedAt, `${pack.id}.observedAt`) };
}

function parseManifest(value) {
  const manifest = assertObject(value, "manifest");
  exactKeys(manifest, ["schemaVersion", "validationTimeZone", "localToolProbe", "packs"], "manifest");
  if (manifest.schemaVersion !== 1 || manifest.validationTimeZone !== "Asia/Seoul" || !Array.isArray(manifest.packs)) {
    throw new CliError("manifest schemaVersion, validationTimeZone, or packs is malformed");
  }
  const packs = manifest.packs.map(parsePack);
  const ids = packs.map((pack) => pack.id);
  if (new Set(ids).size !== ids.length) throw new ContractError("manifest contains duplicate pack IDs");
  const actual = [...ids].sort();
  const expected = [...EXPECTED_PACKS].sort();
  if (actual.length !== expected.length || actual.some((id, index) => id !== expected[index])) {
    throw new ContractError(`manifest pack IDs must be exactly: ${expected.join(", ")}`);
  }
  const probe = parseProbe(manifest.localToolProbe);
  if (new Set(packs.map((pack) => pack.observedAt)).size !== 1 || packs[0]?.observedAt !== probe.observedAt) {
    throw new ContractError("localToolProbe and every pack must share the exact same observedAt");
  }
  return { packs, probeObservedAt: probe.milliseconds };
}

function parseFreshnessJson(text, label) {
  const matches = [...text.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/gu)];
  if (matches.length !== 1 || typeof matches[0]?.[1] !== "string") throw new ContractError(`${label} must contain exactly one JSON metadata block`);
  try {
    return assertObject(JSON.parse(matches[0][1]), label);
  } catch (error) {
    if (error instanceof SyntaxError) throw new CliError(`${label} contains malformed JSON: ${error.message}`);
    throw error;
  }
}

function validateClassification(value, packId) {
  const classification = assertObject(value, `${packId}.classification`);
  exactKeys(classification, ["volatile", "stable"], `${packId}.classification`);
  const volatile = stringList(classification.volatile, `${packId}.classification.volatile`);
  const stable = stringList(classification.stable, `${packId}.classification.stable`);
  if (volatile.some((item) => stable.includes(item))) throw new ContractError(`${packId}: volatile and stable classifications overlap`);
}

function validatePromotion(metadata, packId) {
  if (metadata.promotionStatus !== "not-promoted" || !Array.isArray(metadata.promotionChecklist) || metadata.promotionChecklist.length < 5) {
    throw new ContractError(`${packId}: promotion must remain not-promoted with at least five checklist items`);
  }
  for (const [index, value] of metadata.promotionChecklist.entries()) {
    const item = assertObject(value, `${packId}.promotionChecklist[${index}]`);
    exactKeys(item, ["item", "complete"], `${packId}.promotionChecklist[${index}]`);
    if (item.complete !== false) {
      throw new ContractError(`${packId}: promotion checklist items must be substantive and incomplete`);
    }
  }
  const checklist = metadata.promotionChecklist.map((item, index) => normalizedText(item.item, `${packId}.promotionChecklist[${index}].item`, 10));
  if (new Set(checklist).size !== checklist.length) throw new ContractError(`${packId}: promotion checklist contains normalized duplicates`);
  const methods = assertObject(metadata.refreshMethods, `${packId}.refreshMethods`);
  exactKeys(methods, ["best", "secondBest"], `${packId}.refreshMethods`);
  const best = normalizedText(methods.best, `${packId}.refreshMethods.best`, 30);
  const secondBest = normalizedText(methods.secondBest, `${packId}.refreshMethods.secondBest`, 30);
  if (typeof metadata.staleBehavior !== "string" || !metadata.staleBehavior.includes("historical-only") || best === secondBest) {
    throw new ContractError(`${packId}: stale behavior and best/second-best refresh methods are required`);
  }
}

async function validatePack(repoRoot, pack, asOf) {
  await containedEntry(repoRoot, pack.path, "directory");
  const readmeFile = await containedEntry(repoRoot, pack.readme, "file");
  const freshnessFile = await containedEntry(repoRoot, pack.freshnessFile, "file");
  const readme = await readUtf8(readmeFile, `${pack.id}.readme`);
  const canonicalLinks = readme.split(LINK).length - 1;
  const statuses = [...decodedEquivalents(readme).matchAll(/not-promoted/giu)];
  if (canonicalLinks !== 1 || freshnessLinkCount(readme, pack.id) !== 1 || statuses.length !== 1 || !readme.includes("승격 상태: `not-promoted`")) throw new ContractError(`${pack.id}: README must contain one literal canonical freshness link and status declaration with no encoded or HTML equivalents`);
  const metadata = parseFreshnessJson(await readUtf8(freshnessFile, `${pack.id}.freshnessFile`), `${pack.id}.FRESHNESS`);
  exactKeys(metadata, ["schemaVersion", "packId", "observedAt", "sourceOrProbe", "freshnessWindowDays", "expiresAt", "classification", "promotionStatus", "promotionChecklist", "staleBehavior", "refreshMethods"], `${pack.id}.FRESHNESS`);
  if (metadata.schemaVersion !== 1 || metadata.packId !== pack.id || metadata.observedAt !== pack.observedAt) throw new ContractError(`${pack.id}: metadata identity or observedAt differs from manifest`);
  const observedAt = instant(metadata.observedAt, `${pack.id}.observedAt`);
  const expiresAt = instant(metadata.expiresAt, `${pack.id}.expiresAt`);
  if (!Number.isInteger(metadata.freshnessWindowDays) || metadata.freshnessWindowDays < 1 || metadata.freshnessWindowDays > 365) throw new CliError(`${pack.id}: freshnessWindowDays must be an integer from 1 to 365`);
  if (expiresAt !== observedAt + metadata.freshnessWindowDays * 86_400_000) throw new ContractError(`${pack.id}: expiresAt must equal observedAt plus freshnessWindowDays`);
  if (observedAt > asOf) throw new ContractError(`${pack.id}: observation is in the future`);
  if (expiresAt < asOf) throw new ContractError(`${pack.id}: metadata is stale`);
  const source = assertObject(metadata.sourceOrProbe, `${pack.id}.sourceOrProbe`);
  exactKeys(source, ["kind", "target", "outputSha256"], `${pack.id}.sourceOrProbe`);
  if (source.kind !== "local-file" || source.target !== pack.readme || !DIGEST.test(source.outputSha256)) throw new ContractError(`${pack.id}: local source path or digest is malformed`);
  if (await sha256File(readmeFile) !== source.outputSha256) throw new ContractError(`${pack.id}: local source digest is stale`);
  validateClassification(metadata.classification, pack.id);
  validatePromotion(metadata, pack.id);
  return { expiresAt: metadata.expiresAt, id: pack.id, promotionStatus: metadata.promotionStatus };
}

await runCli(COMMAND, async () => {
  const options = parseArguments(process.argv.slice(2));
  const repoRoot = process.cwd();
  const manifestFile = await containedEntry(repoRoot, options.manifest, "file");
  const manifest = parseManifest(await readJson(manifestFile, "research pack manifest"));
  if (manifest.probeObservedAt > options.asOf) throw new ContractError("localToolProbe observation is in the future");
  const records = [];
  for (const pack of manifest.packs) records.push(await validatePack(repoRoot, pack, options.asOf));
  records.sort((left, right) => left.id.localeCompare(right.id, "en"));
  return { packCount: records.length, records };
});
