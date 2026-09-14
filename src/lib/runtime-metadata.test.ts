import { describe, expect, it } from "vitest";
import { mergeRuntimeMetadata, type RuntimeMetadata } from "@/lib/runtime-metadata";
import type { SourceMetadata } from "@/types/domain";

describe("runtime metadata", () => {
  it("exposes a newer successful retrieval without replacing snapshot identity", () => {
    const snapshot: SourceMetadata = {
      retrievedAt: "2026-09-12T13:39:12.414Z",
      sources: { spillsPrimary: { url: "source", status: "healthy", retrievedAt: "2026-09-12T13:39:12.414Z", latestObservation: "2026-09-02" } },
      spillMirrorAgreement: true,
    };
    const runtime: RuntimeMetadata = {
      ...snapshot,
      retrievedAt: "2026-09-14T03:35:00.000Z",
      snapshotCreatedAt: "2026-09-12T13:39:12.414Z",
      lastDataChangeAt: "2026-09-12T13:39:12.414Z",
      contentHash: "unchanged-hash",
      sources: { spillsPrimary: { ...snapshot.sources.spillsPrimary, retrievedAt: "2026-09-14T03:35:00.000Z" } },
    };
    const merged = mergeRuntimeMetadata(snapshot, runtime);
    expect(merged.retrievedAt).toBe("2026-09-14T03:35:00.000Z");
    expect(merged.sources.spillsPrimary.latestObservation).toBe("2026-09-02");
    expect(merged.snapshotCreatedAt).toBe("2026-09-12T13:39:12.414Z");
    expect(merged.contentHash).toBe("unchanged-hash");
  });
});
