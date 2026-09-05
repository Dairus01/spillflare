import type { SpillRow } from "@/types/domain";

const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const dateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function hasValidCalendarDate(year: number, month: number, day: number) {
  if (year < 1000 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseW3cDate(value?: string | null) {
  if (!value) return undefined;
  const match = value.match(dateOnlyPattern) ?? value.match(dateTimePattern);
  if (!match) return undefined;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!hasValidCalendarDate(year, month, day)) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : undefined;
}

export function trustedIncidentLastModified(
  spill: SpillRow,
  retrievedAt?: Date,
) {
  // Incident dates in the source are date-only fields. Reject permissive
  // JavaScript interpretations such as 2015-03-8 or slash-formatted dates.
  if (!dateOnlyPattern.test(spill.incidentdate ?? "")) return undefined;
  const incidentDate = parseW3cDate(spill.incidentdate);
  if (!incidentDate) return undefined;

  // A source incident cannot reliably modify a snapshot before it occurred.
  if (retrievedAt && incidentDate.getTime() > retrievedAt.getTime()) {
    return undefined;
  }

  // Preserve legitimate historical incidents, but reject extreme internal
  // contradictions. The current dataset's next-largest report gap is 10 years;
  // the offending 1902 record reports the event in 2024 (a 122-year gap).
  const reportDate = parseW3cDate(spill.reportdate);
  if (reportDate) {
    const incidentYear = incidentDate.getUTCFullYear();
    const reportYear = reportDate.getUTCFullYear();
    if (reportYear - incidentYear > 10 || incidentDate > reportDate) {
      return undefined;
    }
  }

  return incidentDate;
}
