import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import {
  discoverRecords,
  findGasFlares,
  findOilSpills,
  getOilSpillDetail,
  getSourceCoverage,
} from "@/lib/data-assistant";

export const runtime = "nodejs";
export const maxDuration = 30;

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const requestLimit = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_MINUTE = 12;

function isRateLimited(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const key = forwardedFor?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const existing = requestLimit.get(key);
  const entry =
    !existing || existing.resetAt < now
      ? { count: 0, resetAt: now + 60_000 }
      : existing;
  entry.count += 1;
  requestLimit.set(key, entry);
  return entry.count > MAX_REQUESTS_PER_MINUTE;
}

const instructions = `You are the SpillFlare Data Assistant.

Your scope is limited to the public NOSDRA oil-spill records and Nigeria Gas Flare Tracker data available through the supplied tools. Treat tool results as the only factual basis for claims about this product's data. Always use a relevant tool before answering a factual question, even if the user gave a record number.

Be precise and transparent:
- State the source, observation period and retrieval time when relevant.
- Never treat a missing quantity, missing flare row, or an unmatched location as zero.
- Do not compare or total different geographic levels (state, LGA, cluster and oil block) as if they were the same thing.
- Company flare data is historical only and ends in October 2020. Never call it current.
- Do not give health, legal, regulatory, causal, predictive or environmental-impact conclusions that are not contained in a source record.
- If the tools do not support an answer, say so plainly and suggest a source-backed question instead.
- Keep answers concise, use ordinary language, and name the source record IDs or data page that supports the answer.
- Do not narrate tool use or say that you will look something up. Call the relevant tool silently, then provide the completed answer after its result.

Do not claim to be trained on private data or to have live knowledge beyond the retrieved snapshot.`;

const tools = {
  findOilSpills: tool({
    description:
      "Find and summarise NOSDRA oil-spill records. Use for recent spills, spills by state/company/year/location, and supplied spill quantities.",
    inputSchema: z.object({
      query: z.string().max(120).optional().describe("Location, incident number, cause, or other source text. Leave empty for most recent records."),
      state: z.string().max(60).optional(),
      company: z.string().max(120).optional(),
      year: z.number().int().min(2000).max(2100).optional(),
      limit: z.number().int().min(1).max(15).optional(),
    }),
    execute: findOilSpills,
  }),
  getOilSpillDetail: tool({
    description:
      "Retrieve one complete NOSDRA spill record by its website record ID or its incident number.",
    inputSchema: z.object({
      idOrIncident: z.string().min(1).max(160),
    }),
    execute: async ({ idOrIncident }) => getOilSpillDetail(idOrIncident),
  }),
  findGasFlares: tool({
    description:
      "Find gas-flare tracker records for one geographic level. Use this for state, LGA, cluster, block, company, or onshore/offshore tracker questions. Month values use YYYY-MM.",
    inputSchema: z.object({
      area: z.enum([
        "state",
        "lga",
        "cluster",
        "block",
        "company",
        "onshore_offshore",
      ]),
      name: z.string().max(160).optional().describe("Name of the state, LGA, cluster, block, company, or onshore/offshore category."),
      startMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      endMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      limit: z.number().int().min(1).max(20).optional(),
    }),
    execute: findGasFlares,
  }),
  getSourceCoverage: tool({
    description:
      "Check the exact data-source health, retrieval time, row counts and latest observation coverage. Use for freshness, availability and limitation questions.",
    inputSchema: z.object({}),
    execute: getSourceCoverage,
  }),
  discoverRecords: tool({
    description:
      "Search the product's public records and detail pages by a name, place, company, block, cluster or incident number.",
    inputSchema: z.object({ query: z.string().min(1).max(120) }),
    execute: async ({ query }) => discoverRecords(query),
  }),
};

function validMessages(value: unknown): value is UIMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 14) return false;
  return value.every(
    (message) =>
      message &&
      typeof message === "object" &&
      "role" in message &&
      "parts" in message &&
      Array.isArray((message as UIMessage).parts),
  );
}

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      {
        error:
          "The data assistant is not configured yet. Add OPENROUTER_API_KEY to .env.local and restart the server.",
      },
      { status: 503 },
    );
  }
  if (isRateLimited(request)) {
    return Response.json(
      { error: "Please wait a moment before asking another question." },
      { status: 429 },
    );
  }

  let body: { messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid chat request." }, { status: 400 });
  }
  if (!validMessages(body.messages)) {
    return Response.json(
      { error: "A chat message is required." },
      { status: 400 },
    );
  }

  const messages = body.messages.slice(-12);
  const result = streamText({
    model: openrouter("openrouter/free"),
    instructions,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(4),
  });

  return result.toUIMessageStreamResponse();
}
