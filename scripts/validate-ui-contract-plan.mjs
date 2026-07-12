#!/usr/bin/env node

import { readdir } from "node:fs/promises";
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

const COMMAND = "validate-ui-contract-plan";
const DEFAULT_MATRIX = "plan/history/ui-contract-matrix.json";
const USAGE = "node scripts/validate-ui-contract-plan.mjs --plan <md> --routes <tsx> --controllers <dir> [--matrix <json>]";
const STATUS = new Set(["current", "planned"]);
const HTTP_METHOD = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function parseArgs(argv) {
  const allowed = new Set(["--plan", "--matrix", "--routes", "--controllers"]);
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(flag) || typeof value !== "string" || value.startsWith("--")) {
      throw new CliError(`usage: ${USAGE}`);
    }
    if (result[flag] !== undefined) throw new CliError(`duplicate argument: ${flag}`);
    result[flag] = normalizeRepoPath(value, flag);
  }
  for (const flag of ["--plan", "--routes", "--controllers"]) {
    if (result[flag] === undefined) throw new CliError(`missing required argument: ${flag}`);
  }
  result["--matrix"] ??= DEFAULT_MATRIX;
  return result;
}

function parseRecord(value, label, key, extraFields = []) {
  const record = assertObject(value, label);
  const fields = [key, "status", "owner", "sourcePath", "acceptanceTest", ...extraFields];
  for (const field of fields) {
    if (typeof record[field] !== "string" || record[field].trim().length === 0) {
      throw new CliError(`${label}.${field} must be a non-empty string`);
    }
  }
  if (!STATUS.has(record.status)) throw new CliError(`${label}.status must be current or planned`);
  const pathProblem = canonicalPathProblem(record[key]);
  if (pathProblem !== null) throw new CliError(`${label}.${key} is noncanonical: ${pathProblem}`);
  if (extraFields.includes("method") && !HTTP_METHOD.has(record.method)) {
    throw new CliError(`${label}.method is unsupported: ${record.method}`);
  }
  return record;
}

function canonicalPathProblem(value) {
  if (!value.startsWith("/")) return "must start with /";
  if (value === "/") return null;
  if (value.endsWith("/")) return "trailing slash is forbidden";
  if (value.includes("\\")) return "backslash is forbidden";
  if (/%(?:2f|5c|2e)/i.test(value)) return "encoded separator or traversal is forbidden";
  if (value.includes("?") || value.includes("#")) return "query and fragment are forbidden";
  const segments = value.slice(1).split("/");
  if (segments.some((segment) => segment.length === 0)) return "repeated slash is forbidden";
  if (segments.some((segment) => segment === "." || segment === "..")) return "dot segment is forbidden";
  return null;
}

function parsePin(value, label) {
  const pin = assertObject(value, label);
  if (typeof pin.path !== "string" || typeof pin.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(pin.sha256)) {
    throw new CliError(`${label} must contain path and lowercase sha256`);
  }
  return { path: normalizeRepoPath(pin.path, `${label}.path`), sha256: pin.sha256 };
}

function parseMatrix(value) {
  const matrix = assertObject(value, "matrix");
  if (matrix.schemaVersion !== 1) throw new CliError("matrix.schemaVersion must be 1");
  if (!Array.isArray(matrix.routes) || !Array.isArray(matrix.apiClaims) || !Array.isArray(matrix.controllerSources)) {
    throw new CliError("matrix routes, apiClaims, and controllerSources must be arrays");
  }
  const plan = parsePin(matrix.plan, "matrix.plan");
  const planRecord = assertObject(matrix.plan, "matrix.plan");
  if (typeof planRecord.sourceCommit !== "string" || !/^[a-f0-9]{40}$/.test(planRecord.sourceCommit)) {
    throw new CliError("matrix.plan.sourceCommit must be a full Git commit");
  }
  return {
    plan,
    routeSource: parsePin(matrix.routeSource, "matrix.routeSource"),
    controllerSources: matrix.controllerSources.map((item, index) => parsePin(item, `matrix.controllerSources[${index}]`)),
    routes: matrix.routes.map((item, index) => parseRecord(item, `matrix.routes[${index}]`, "route")),
    apiClaims: matrix.apiClaims.map((item, index) => parseRecord(item, `matrix.apiClaims[${index}]`, "path", ["method"])),
  };
}

function rejectDuplicates(values, label) {
  const sorted = [...values].sort();
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index] === sorted[index - 1]) throw new CliError(`${label} contains duplicate: ${sorted[index]}`);
  }
}

function parseRoutes(source) {
  const callCount = [...source.matchAll(/\bcreateRoute\s*\(/g)].length;
  const routes = [];
  const blocks = [...source.matchAll(/\bcreateRoute\s*\(\s*\{([\s\S]*?)\}\s*\);/g)];
  if (blocks.length !== callCount) throw new ContractError("unsupported createRoute syntax in route source");
  for (const block of blocks) {
    const paths = [...block[1].matchAll(/\bpath\s*:\s*(["'])(\/[^"']*)\1\s*,?/g)];
    if (paths.length !== 1) throw new ContractError("each createRoute call must contain exactly one static path string");
    const route = paths[0][2];
    const problem = canonicalPathProblem(route);
    if (problem !== null) throw new ContractError(`noncanonical route source path ${route}: ${problem}`);
    routes.push(route);
  }
  rejectDuplicates(routes, "route source");
  return routes.sort();
}

function joinApiPath(prefix, suffix) {
  const prefixProblem = canonicalPathProblem(prefix);
  if (prefixProblem !== null) throw new ContractError(`noncanonical controller prefix ${prefix}: ${prefixProblem}`);
  if (suffix.length > 0) {
    const suffixProblem = canonicalPathProblem(suffix);
    if (suffixProblem !== null) throw new ContractError(`noncanonical controller mapping ${suffix}: ${suffixProblem}`);
  }
  return prefix === "/" ? suffix || "/" : `${prefix}${suffix}`;
}

function parseController(source, sourcePath) {
  if (!/@RestController\b/.test(source)) throw new ContractError(`${sourcePath} is not a RestController`);
  const prefixes = [...source.matchAll(/@RequestMapping\(\s*"([^"]+)"\s*\)/g)];
  if (prefixes.length !== 1) throw new ContractError(`${sourcePath} must have one static class RequestMapping`);
  const annotationLines = source.split("\n").map((line) => line.trim())
    .filter((line) => /^@(Get|Post|Put|Patch|Delete)Mapping\b/.test(line));
  return annotationLines.map((line) => {
    const mapping = line.match(/^@(Get|Post|Put|Patch|Delete)Mapping(?:\(\s*"([^"]*)"\s*\))?$/);
    if (mapping === null) throw new ContractError(`unsupported method mapping syntax in ${sourcePath}: ${line}`);
    return { method: mapping[1].toUpperCase(), path: joinApiPath(prefixes[0][1], mapping[2] ?? ""), sourcePath };
  });
}

async function parseControllers(root, directory) {
  const absolute = resolveContained(root, directory, "--controllers");
  const names = (await readdir(absolute)).filter((name) => name.endsWith("Controller.kt")).sort();
  if (names.length === 0) throw new ContractError("controller directory contains no *Controller.kt files");
  const sources = [];
  const endpoints = [];
  for (const name of names) {
    const sourcePath = path.posix.join(directory, name);
    sources.push(sourcePath);
    endpoints.push(...parseController(await readUtf8(resolveContained(root, sourcePath), sourcePath), sourcePath));
  }
  rejectDuplicates(endpoints.map((entry) => `${entry.method} ${entry.path}`), "controller endpoints");
  return { sources, endpoints };
}

function sameSet(actual, expected, label) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    throw new ContractError(`${label} mismatch: actual=${JSON.stringify(left)} expected=${JSON.stringify(right)}`);
  }
}

function validatePlanRows(plan, matrix) {
  if (!plan.includes("<!-- ui-contract-plan: v1 -->")) throw new ContractError("plan lacks ui-contract-plan: v1 marker");
  const routeRows = [...plan.matchAll(/^\| (Current|Planned) \| `((?:\/)[^` ]*)` \|/gm)]
    .map((match) => `${match[1].toLowerCase()} ${match[2]}`);
  sameSet(routeRows, matrix.routes.map((entry) => `${entry.status} ${entry.route}`), "plan route classifications");
  const apiRows = [...plan.matchAll(/^\| (Current|Planned) \| `([A-Z]+) (\/api\/[^`]*)` \|/gm)]
    .map((match) => `${match[1].toLowerCase()} ${match[2]} ${match[3]}`);
  sameSet(apiRows, matrix.apiClaims.map((entry) => `${entry.status} ${entry.method} ${entry.path}`), "plan API classifications");
}

async function validatePinnedPlan(root, matrix) {
  const digest = await sha256File(resolveContained(root, matrix.plan.path));
  if (digest !== matrix.plan.sha256) throw new ContractError(`stale plan pin: ${matrix.plan.path}`);
}

async function validatePins(root, args, matrix, controllerPaths) {
  if (args["--routes"] !== matrix.routeSource.path) throw new ContractError("route source path differs from pinned matrix source");
  const routeDigest = await sha256File(resolveContained(root, args["--routes"]));
  if (routeDigest !== matrix.routeSource.sha256) throw new ContractError(`stale route source pin: ${args["--routes"]}`);
  sameSet(controllerPaths, matrix.controllerSources.map((pin) => pin.path), "controller source pins");
  for (const pin of matrix.controllerSources) {
    const digest = await sha256File(resolveContained(root, pin.path));
    if (digest !== pin.sha256) throw new ContractError(`stale controller source pin: ${pin.path}`);
  }
}

async function main() {
  const root = process.cwd();
  if (process.argv.length === 3 && process.argv[2] === "--help") return { usage: USAGE };
  const args = parseArgs(process.argv.slice(2));
  const matrix = parseMatrix(await readJson(resolveContained(root, args["--matrix"]), "matrix"));
  rejectDuplicates(matrix.routes.map((entry) => entry.route), "matrix routes");
  rejectDuplicates(matrix.apiClaims.map((entry) => `${entry.method} ${entry.path}`), "matrix API claims");
  await validatePinnedPlan(root, matrix);
  const plan = await readUtf8(resolveContained(root, args["--plan"]), "plan");
  validatePlanRows(plan, matrix);
  if (args["--plan"] !== matrix.plan.path) throw new ContractError(`--plan must match pinned matrix plan: ${matrix.plan.path}`);
  const currentRoutes = matrix.routes.filter((entry) => entry.status === "current").map((entry) => entry.route);
  const plannedRoutes = matrix.routes.filter((entry) => entry.status === "planned").map((entry) => entry.route);
  const wrongRouteSources = matrix.routes.filter((entry) => entry.status === "current" && entry.sourcePath !== matrix.routeSource.path);
  if (wrongRouteSources.length > 0) throw new ContractError(`current route has wrong sourcePath: ${wrongRouteSources[0].route}`);
  const sourceRoutes = parseRoutes(await readUtf8(resolveContained(root, args["--routes"]), "routes"));
  sameSet(sourceRoutes, currentRoutes, "current routes");
  const plannedInSource = plannedRoutes.filter((route) => sourceRoutes.includes(route));
  if (plannedInSource.length > 0) throw new ContractError(`planned routes already exist in source: ${JSON.stringify(plannedInSource.sort())}`);
  const controllers = await parseControllers(root, args["--controllers"]);
  await validatePins(root, args, matrix, controllers.sources);
  const endpointSources = new Map(controllers.endpoints.map((entry) => [`${entry.method} ${entry.path}`, entry.sourcePath]));
  for (const claim of matrix.apiClaims) {
    const key = `${claim.method} ${claim.path}`;
    const sourcePath = endpointSources.get(key);
    const exists = sourcePath !== undefined;
    if (claim.status === "current" && !exists) throw new ContractError(`current API claim is absent: ${claim.method} ${claim.path}`);
    if (claim.status === "current" && claim.sourcePath !== sourcePath) throw new ContractError(`current API claim has wrong sourcePath: ${key}`);
    if (claim.status === "planned" && exists) throw new ContractError(`planned API claim already exists: ${claim.method} ${claim.path}`);
  }
  return { routes: matrix.routes.length, apiClaims: matrix.apiClaims.length, controllerEndpoints: controllers.endpoints.length };
}

await runCli(COMMAND, main);
