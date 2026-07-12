import { z } from "zod";
import type { ArchitectureArtifact } from "../types";
import { apiJson, ApiClientError } from "./http";

const artifactSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["ADR", "RFC", "API", "Diagram"]),
  title: z.string().min(1),
  status: z.enum(["Accepted", "Proposed", "Stale"]),
  sourcePath: z.string().min(1),
  owner: z.string().min(1),
  summary: z.string().min(1),
  linkedTaskIds: z.array(z.string().min(1)),
});

const artifactsPageSchema = z.object({
  items: z.array(artifactSchema),
  total: z.number().int().nonnegative(),
});

export async function requestArchitectureArtifacts(signal?: AbortSignal): Promise<readonly ArchitectureArtifact[]> {
  const payload = await apiJson("api/architecture", { signal });

  try {
    return artifactsPageSchema.parse(payload).items;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiClientError("Architecture response did not match the API contract.", {
        code: "INVALID_ARCHITECTURE_RESPONSE",
        status: null,
      });
    }

    throw error;
  }
}

export async function requestArchitectureArtifact(
  artifactId: string,
  signal?: AbortSignal,
): Promise<ArchitectureArtifact> {
  const payload = await apiJson(`api/architecture/adr/${encodeURIComponent(artifactId)}`, { signal });

  try {
    return artifactSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiClientError("Architecture detail response did not match the API contract.", {
        code: "INVALID_ARCHITECTURE_DETAIL_RESPONSE",
        status: null,
      });
    }

    throw error;
  }
}
