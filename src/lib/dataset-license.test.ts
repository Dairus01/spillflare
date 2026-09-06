import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { metadata as dataLicenseMetadata } from "@/app/data-license/page";
import { dataLicenseUrl, datasetLicense } from "@/lib/site";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.(?:ts|tsx)$/.test(entry.name)
        ? [path]
        : [];
  });
}

describe("Dataset licensing", () => {
  it("uses the exact public reuse-policy URL", () => {
    expect(dataLicenseUrl).toBe("https://spillflare.com.ng/data-license");
    expect(datasetLicense).toEqual({ license: dataLicenseUrl });
  });

  it("applies the shared license value to every Dataset generator", () => {
    const appDirectory = join(process.cwd(), "src", "app");
    const emitters = sourceFiles(appDirectory)
      .map((path) => ({
        path,
        source: readFileSync(path, "utf8"),
      }))
      .filter(({ source }) => source.includes('"@type": "Dataset"'));

    expect(
      emitters
        .map(({ path }) => relative(appDirectory, path).replaceAll("\\", "/"))
        .sort(),
    ).toEqual([
      "gas-flares/clusters/[name]/page.tsx",
      "oil-blocks/[name]/page.tsx",
      "oil-spills/page.tsx",
      "page.tsx",
      "places/states/[slug]/page.tsx",
    ]);

    for (const { source } of emitters) {
      const datasets = source.match(/"@type": "Dataset"/g)?.length ?? 0;
      const licenses = source.match(/\.\.\.datasetLicense/g)?.length ?? 0;
      expect(licenses).toBe(datasets);
      expect(source).toContain("datasetLicense");
    }
  });

  it("publishes indexable metadata with a self-referencing canonical", () => {
    expect(dataLicenseMetadata.title).toBe("Data License and Reuse");
    expect(dataLicenseMetadata.alternates).toEqual({ canonical: "/data-license" });
    expect(dataLicenseMetadata.robots).toBeUndefined();
  });
});
