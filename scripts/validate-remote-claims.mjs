#!/usr/bin/env node

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
} from "./lib/validator-runtime.mjs";

const COMMAND = "validate-remote-claims";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const SOURCE = "GET https://api.github.com/repos/WonderRabbit/Tomodachi/environments/prod";
const ENDPOINT = "repos/WonderRabbit/Tomodachi/environments/prod";
const PROD_PATHS = ["plan/tomodachi-env-cicd.md", "docs/ci-cd-options.md", "docs/environment-contract.md"];
const CLAIM_RULES = [
  {
    id: "RC-PROD-REVIEWER-20260703",
    field: ".protection_rules",
    signal: /(?:required\s+(?:reviewer|approver)|(?:requires?|has)\s+(?:(?:an?|no)\s+)?(?:reviewer|approver)|(?:current\s+)?(?:reviewer|approver)\s*(?::|is|=)\s*\S+|필수\s*(?:검토자|승인자)|(?:검토자|승인자)[^\n]*(?:표시|설정)|WonderRabbit[^\n]*(?:reviewer|승인))/iu,
    needsEnvironment: true,
  },
  {
    id: "RC-PROD-ADMIN-BYPASS-20260703",
    field: ".can_admins_bypass",
    signal: /(?:can_admins_bypass[^\n]*(?:true|false)|admin(?:istrator)?\s+bypass[^\n]*(?:is|=|on|off|꺼져|켜져))/iu,
    needsEnvironment: false,
  },
  {
    id: "RC-PROD-BRANCH-POLICY-20260703",
    field: ".deployment_branch_policy",
    signal: /(?:deployment_branch_policy[^\n]*(?:null|true|false)|environment\s+branch\s+policy[^\n]*(?:is|=|null|없))/iu,
    needsEnvironment: false,
  },
];
const NON_REMOTE_RULES = new Map([
  ["POLICY-PROD-APPROVAL-REQUIRED", ["policy", PROD_PATHS]],
  ["EXTERNAL-JANG-AGENT-PORTAL", ["external-reference", PROD_PATHS.slice(0, 2)]],
  ["GENERIC-CLOUD-OPERATING-GUIDANCE", ["generic-guidance", PROD_PATHS]],
]);

function canonicalPaths(values, label) {
  const paths = assertStringArray(values, label).map((value, index) => {
    const normalized = normalizeRepoPath(value, `${label}[${index}]`);
    if (normalized !== value) throw new ContractError(`${label}[${index}] must be canonical: ${value}`);
    return normalized;
  });
  if (new Set(paths).size !== paths.length) throw new ContractError(`${label} contains duplicate paths`);
  return paths;
}

function parseArguments(argv) {
  if (argv[0] !== "--inventory" || argv[2] !== "--paths") {
    throw new CliError("usage: validate-remote-claims.mjs --inventory <json> --paths <path...> [--as-of YYYY-MM-DD]");
  }
  const inventory = argv[1];
  if (inventory === undefined) throw new CliError("--inventory requires a value");
  const normalizedInventory = canonicalPaths([inventory], "inventory argument")[0];
  const paths = [];
  let index = 3;
  while (index < argv.length && !argv[index].startsWith("--")) {
    paths.push(argv[index]);
    index += 1;
  }
  const options = new Map();
  while (index < argv.length) {
    const flag = argv[index];
    if (flag !== "--as-of") throw new CliError(`unknown flag: ${flag}`);
    if (options.has(flag)) throw new CliError(`duplicate flag: ${flag}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new CliError(`${flag} requires a value`);
    options.set(flag, value);
    index += 2;
  }
  if (options.has("--as-of") && !normalizedInventory.startsWith("scripts/fixtures/remote-claims/")) {
    throw new ContractError("--as-of is restricted to checked-in remote-claims fixtures");
  }
  return {
    asOf: options.get("--as-of") ?? currentKstDate(),
    inventory: normalizedInventory,
    paths: canonicalPaths(paths, "CLI paths"),
  };
}

function isCalendarDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function currentKstDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function parseClaim(value, index) {
  const claim = assertObject(value, `remoteClaims[${index}]`);
  for (const field of ["id", "classification", "subject", "observedAt", "expiresAt", "source"]) {
    if (typeof claim[field] !== "string" || claim[field].length === 0) throw new CliError(`remoteClaims[${index}].${field} must be a non-empty string`);
  }
  const rule = CLAIM_RULES.find((candidate) => candidate.id === claim.id);
  if (rule === undefined || claim.classification !== "remote-observation") throw new ContractError(`${claim.id}: unknown claim ID or classification`);
  if (!isCalendarDate(claim.observedAt) || !isCalendarDate(claim.expiresAt)) throw new CliError(`${claim.id}: dates must use valid YYYY-MM-DD values`);
  if (claim.source !== SOURCE) throw new ContractError(`${claim.id}: source must be ${SOURCE}`);
  const method = assertObject(claim.verificationMethod, `${claim.id}.verificationMethod`);
  const argv = assertStringArray(method.argv, `${claim.id}.verificationMethod.argv`);
  if (argv.some((token) => /[\u0000-\u001f\u007f><|;&`$]/u.test(token) || /^--method=/iu.test(token))) {
    throw new ContractError(`${claim.id}: verification argv contains control, shell, redirection, or joined method syntax`);
  }
  const expected = ["gh", "api", "--method", "GET", ENDPOINT, "--jq", rule.field];
  if (argv.length !== expected.length || argv.some((token, offset) => token !== expected[offset])) {
    throw new ContractError(`${claim.id}: verification argv must be ${JSON.stringify(expected)}`);
  }
  return { ...claim, documents: canonicalPaths(claim.documents, `${claim.id}.documents`) };
}

function parseInventory(value) {
  const inventory = assertObject(value, "inventory");
  if (inventory.schemaVersion !== 1 || inventory.repository !== "WonderRabbit/Tomodachi") throw new CliError("inventory schemaVersion/repository is malformed");
  if (!isCalendarDate(inventory.validationDate)) throw new CliError("inventory.validationDate must be a valid YYYY-MM-DD value");
  if (!Array.isArray(inventory.remoteClaims) || !Array.isArray(inventory.nonRemoteClaims) || !Array.isArray(inventory.localFacts)) {
    throw new CliError("inventory claim collections must be arrays");
  }
  const claims = inventory.remoteClaims.map(parseClaim);
  const nonRemoteClaims = inventory.nonRemoteClaims.map((value, index) => {
    const claim = assertObject(value, `nonRemoteClaims[${index}]`);
    const rule = NON_REMOTE_RULES.get(claim.id);
    if (rule === undefined || claim.classification !== rule[0] || typeof claim.statement !== "string" || claim.statement.trim().length < 20) {
      throw new ContractError(`nonRemoteClaims[${index}] has an unexpected ID or classification`);
    }
    return { ...claim, documents: canonicalPaths(claim.documents, `${claim.id}.documents`) };
  });
  if (typeof inventory.remoteMutationPolicy !== "string" || !/read-only/iu.test(inventory.remoteMutationPolicy)) throw new ContractError("remoteMutationPolicy must require read-only rechecks");
  return {
    claims,
    localFacts: inventory.localFacts,
    nonRemoteClaims,
    paths: canonicalPaths(inventory.paths, "inventory.paths"),
    validationDate: inventory.validationDate,
  };
}

function assertExactIds(values, expected, label) {
  const ids = values.map((value) => value.id);
  if (new Set(ids).size !== ids.length) throw new ContractError(`${label} contains duplicate IDs`);
  const actual = [...ids].sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((id, index) => id !== wanted[index])) throw new ContractError(`${label} IDs must be ${wanted.join(", ")}`);
}

function assertSameSet(expected, actual, label) {
  const left = [...expected].sort();
  const right = [...actual].sort();
  if (left.length !== right.length || left.some((value, index) => value !== right[index])) throw new ContractError(`${label} differs; expected=${JSON.stringify(left)} actual=${JSON.stringify(right)}`);
}

function validateInventory(inventory, options) {
  assertExactIds(inventory.claims, CLAIM_RULES.map((rule) => rule.id), "remoteClaims");
  assertExactIds(inventory.nonRemoteClaims, [...NON_REMOTE_RULES.keys()], "nonRemoteClaims");
  assertSameSet(inventory.paths, options.paths, "validated paths");
  if (options.inventory === "plan/history/remote-claims.json") assertSameSet(PROD_PATHS, inventory.paths, "production inventory paths");
  if (!isCalendarDate(options.asOf) || inventory.validationDate !== options.asOf) throw new ContractError(`inventory.validationDate must equal validation date ${options.asOf}`);
  for (const claim of inventory.claims) {
    if (claim.observedAt > options.asOf || claim.expiresAt < options.asOf) throw new ContractError(`${claim.id}: observation is stale for validation date ${options.asOf}`);
  }
  const usedPaths = new Set([...inventory.claims, ...inventory.nonRemoteClaims].flatMap((claim) => claim.documents));
  assertSameSet(inventory.paths, usedPaths, "inventory path coverage");
  for (const claim of inventory.nonRemoteClaims) {
    const expectedDocuments = claim.id === "EXTERNAL-JANG-AGENT-PORTAL" ? (options.inventory === "plan/history/remote-claims.json" ? NON_REMOTE_RULES.get(claim.id)[1] : inventory.paths.filter((path) => !/environment/iu.test(path))) : inventory.paths;
    assertSameSet(expectedDocuments, claim.documents, `${claim.id}.documents`);
  }
  const localFact = inventory.localFacts.length === 1 ? assertObject(inventory.localFacts[0], "localFacts[0]") : undefined;
  if (localFact?.id !== "LOCAL-PROD-DISPATCH-GUARD" || localFact.classification !== "source-controlled-local-fact" || localFact.source !== ".github/workflows/deploy-prod.yml:38-53" || typeof localFact.statement !== "string" || localFact.statement.trim().length < 20) {
    throw new ContractError("localFacts must contain exactly the canonical production dispatch guard citation");
  }
  assertSameSet(inventory.paths, canonicalPaths(localFact.documents, "LOCAL-PROD-DISPATCH-GUARD.documents"), "LOCAL-PROD-DISPATCH-GUARD.documents");
}

function validateLines(path, text, claims) {
  const observedIds = new Set();
  let occurrences = 0;
  for (const [offset, line] of text.split(/\r?\n/u).entries()) {
    const normalized = line.normalize("NFKC");
    const claimHint = /(?:github|environment|reviewer|approver|can_admins_bypass|deployment_branch_policy|RC-PROD)/iu.test(normalized.replace(/\p{Cf}/gu, ""));
    if (claimHint && /(?:[\p{Cc}\p{Cf}]|%[0-9a-f]{2})/iu.test(normalized)) throw new ContractError(`${path}:${offset + 1}: claim-bearing text contains control, format, or percent-encoded characters`);
    const markers = [...normalized.matchAll(/\[(RC-[A-Z0-9-]+)\]/gu)].map((match) => match[1]);
    if (new Set(markers).size !== markers.length) throw new ContractError(`${path}:${offset + 1}: duplicate remote claim marker`);
    const matched = CLAIM_RULES.filter((rule) => rule.signal.test(normalized));
    for (const marker of markers) {
      if (!CLAIM_RULES.some((rule) => rule.id === marker)) throw new ContractError(`${path}:${offset + 1}: uninventoried marker ${marker}`);
      if (!matched.some((rule) => rule.id === marker)) throw new ContractError(`${path}:${offset + 1}: unused remote claim marker ${marker}`);
    }
    const historical = /(?:\d{4}-\d{2}-\d{2}\s+관측|observed\s+(?:on|as of)|as of\s+\d{4}-\d{2}-\d{2})/iu.test(normalized);
    const policy = /(?:should|must|shall|requirement|해야|금지|유지한다|정책|완료 조건)/iu.test(normalized);
    const present = /(?:currently|current|now|\bis\b|\bare\b|\bhas\b|requires?|현재|지금|설정되어 있다|표시된다|없다)/iu.test(normalized);
    for (const rule of matched) {
      if (!markers.includes(rule.id)) {
        if (rule.needsEnvironment && !/github\s+environment/iu.test(normalized)) continue;
        if (present && !historical && !policy) throw new ContractError(`${path}:${offset + 1}: present-tense remote assertion lacks ${rule.id}`);
        continue;
      }
      const claim = claims.find((item) => item.id === rule.id);
      if (claim === undefined || !normalized.includes(`${claim.observedAt} 관측`)) throw new ContractError(`${path}:${offset + 1}: ${rule.id} must be date-bound to ${claim?.observedAt ?? "its observedAt"} 관측`);
      observedIds.add(rule.id);
      occurrences += 1;
    }
  }
  return { observedIds, occurrences };
}

function validateWorkflow(text) {
  const lines = text.split(/\r?\n/u);
  const dispatch = lines.some((line, index) => line.trim() === "on:" && lines.slice(index + 1).find((next) => next.trim().length > 0)?.trim() === "workflow_dispatch:");
  if (!dispatch) throw new ContractError("local workflow must declare workflow_dispatch under on");
  const blocks = lines.flatMap((line, index) => {
    const match = /^(\s*)run:\s*\|\s*$/u.exec(line);
    if (match === null) return [];
    const body = [];
    for (const next of lines.slice(index + 1)) {
      if (next.trim().length > 0 && next.length - next.trimStart().length <= match[1].length) break;
      if (next.trim().length > 0 && !next.trimStart().startsWith("#")) body.push(next.trim());
    }
    return [body];
  });
  const guarded = blocks.some((body) => {
    const caseAt = body.indexOf('case "$GITHUB_REF" in');
    const refAt = body.indexOf("refs/heads/main|refs/tags/v*) ;;");
    const defaultAt = body.indexOf("*)");
    const esacAt = body.indexOf("esac");
    const confirmAt = body.indexOf('if [ "$CONFIRM_PROD" != "deploy-prod" ]; then');
    const fiAt = body.indexOf("fi", confirmAt + 1);
    return caseAt >= 0 && caseAt < refAt && refAt < defaultAt && defaultAt < esacAt && body.slice(defaultAt, esacAt).includes("exit 1") && confirmAt > esacAt && fiAt > confirmAt && body.slice(confirmAt, fiAt).includes("exit 1");
  });
  if (!guarded) throw new ContractError("local workflow lacks executable ref and confirm guard structure");
}

await runCli(COMMAND, async () => {
  const repoRoot = process.cwd();
  const options = parseArguments(process.argv.slice(2));
  const inventory = parseInventory(await readJson(resolveContained(repoRoot, options.inventory, "inventory"), "inventory"));
  validateInventory(inventory, options);
  const observedByPath = new Map();
  let occurrences = 0;
  for (const path of options.paths) {
    const result = validateLines(path, await readUtf8(resolveContained(repoRoot, path, "validated path"), "validated path"), inventory.claims);
    observedByPath.set(path, result.observedIds);
    occurrences += result.occurrences;
  }
  for (const claim of inventory.claims) {
    const actualDocuments = [...observedByPath].filter(([, ids]) => ids.has(claim.id)).map(([path]) => path);
    assertSameSet(claim.documents, actualDocuments, `${claim.id}.documents`);
  }
  validateWorkflow(await readUtf8(resolveContained(repoRoot, ".github/workflows/deploy-prod.yml", "workflow"), "workflow"));
  return { asOf: options.asOf, inventory: options.inventory, localFacts: 1, nonRemoteClassifications: inventory.nonRemoteClaims.length, occurrences, paths: options.paths.length, remoteClaims: inventory.claims.length };
});
