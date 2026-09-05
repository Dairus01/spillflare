import { describe, expect, it } from "vitest";
import {
  parseW3cDate,
  trustedIncidentLastModified,
} from "@/lib/sitemap-date";

describe("sitemap date validation", () => {
  it("preserves valid date-only and timezone-aware W3C values", () => {
    expect(parseW3cDate("2024-02-29")?.toISOString()).toBe(
      "2024-02-29T00:00:00.000Z",
    );
    expect(parseW3cDate("2026-09-05T19:18:23.124Z")?.toISOString()).toBe(
      "2026-09-05T19:18:23.124Z",
    );
    expect(parseW3cDate("2026-09-05T20:18:23+01:00")?.toISOString()).toBe(
      "2026-09-05T19:18:23.000Z",
    );
  });

  it.each([
    "2015-03-8",
    "03/08/2015",
    "2024-02-30",
    "2024-13-01",
    "2024-01-01T25:00:00Z",
    "not-a-date",
  ])("rejects malformed, ambiguous or impossible value %s", (value) => {
    expect(parseW3cDate(value)).toBeUndefined();
  });

  it("omits the Search Console offending record instead of inventing a fallback", () => {
    expect(
      trustedIncidentLastModified(
        {
          id: "314320",
          incidentdate: "1902-02-08",
          reportdate: "2024-02-12",
          incidentnumber: "NPSC/AG3/HSC/24/019",
        },
        new Date("2026-09-05T19:18:23.124Z"),
      ),
    ).toBeUndefined();
  });

  it("preserves a trustworthy historical incident date", () => {
    expect(
      trustedIncidentLastModified(
        { id: "5684", incidentdate: "1990-10-17" },
        new Date("2026-09-05T19:18:23.124Z"),
      )?.toISOString(),
    ).toBe("1990-10-17T00:00:00.000Z");
  });

  it("omits future incident dates", () => {
    expect(
      trustedIncidentLastModified(
        { id: "future", incidentdate: "2027-01-01" },
        new Date("2026-09-05T19:18:23.124Z"),
      ),
    ).toBeUndefined();
  });
});
