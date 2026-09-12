export type SpillRow = Record<string, string | null | undefined> & {
  id: string;
  status?: string;
  company?: string;
  incidentnumber?: string;
  incidentdate?: string;
  reportdate?: string;
  contaminant?: string;
  estimatedquantity?: string;
  quantityrecovered?: string;
  sitelocationname?: string;
  latitude?: string;
  longitude?: string;
  lga?: string;
  statesaffected?: string;
  cause?: string;
  attachments?: string;
};

export type FlareRow = { name: string; mscf: string | number | null; month: string | null; x?: string | number | null; y?: string | number | null };
export type GeoFeature = { type: "Feature"; id?: number | string; geometry: GeoJSON.Geometry; properties: Record<string, string | number | null> };
export type FeatureCollection = { type: "FeatureCollection"; features: GeoFeature[] };
export type SourceStatus = { url: string; status: "healthy" | "degraded"; retrievedAt: string; checkedAt?: string; sha256?: string; count?: number; latestObservation?: string | null; error?: string; servingLastSuccessfulSnapshot?: boolean };
export type SourceMetadata = { retrievedAt: string; sources: Record<string, SourceStatus>; spillMirrorAgreement: boolean };
export type MapPoint = { id: string; lat: number; lng: number; title: string; subtitle?: string; kind: "spill" | "flare"; href?: string };
