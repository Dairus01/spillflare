import type { SourceMetadata } from "@/types/domain";

export type RuntimeMetadata = SourceMetadata & {
  snapshotCreatedAt: string;
  lastDataChangeAt: string;
  contentHash: string;
};

// Large snapshots belong to immutable releases. This small file is rewritten
// after every successful source check so retrieval freshness can advance even
// when snapshot content is unchanged and the Node process is not reloaded.
export function mergeRuntimeMetadata(
  snapshot: SourceMetadata,
  runtime: RuntimeMetadata | null,
): SourceMetadata {
  if (!runtime?.retrievedAt || !runtime.sources) return snapshot;
  return {
    ...snapshot,
    ...runtime,
    sources: { ...snapshot.sources, ...runtime.sources },
  };
}
