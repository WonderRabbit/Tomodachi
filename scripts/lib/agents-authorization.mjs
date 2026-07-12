import { ContractError, normalizeRepoPath, readUtf8, resolveContained } from "./validator-runtime.mjs";

export function parseApprovedAgents(text) {
  const approved = new Set();
  const lines = text.split(/\r?\n/u);
  for (const line of lines) {
    if (!line.startsWith("|") || line.includes("path | baseline_sha256")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 6) continue;
    const [repoPath, , status, approver] = cells;
    if (status === "approved" && /^user-\d{4}-\d{2}-\d{2}$/u.test(approver)) {
      approved.add(normalizeRepoPath(repoPath, "approved AGENTS path"));
    }
  }
  return approved;
}

export async function verifyApprovedAgents(repo, paths) {
  for (const repoPath of paths) {
    const contents = await readUtf8(resolveContained(repo, repoPath, "approved AGENTS path"), "approved AGENTS path");
    if (!contents.includes("적용 승인") || /proposal-only|초안/u.test(contents)) {
      throw new ContractError(`approved AGENTS content is not applied guidance: ${repoPath}`);
    }
  }
}
