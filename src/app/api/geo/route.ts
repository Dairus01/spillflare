import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGeo } from "@/lib/data";
const schema=z.object({layer:z.enum(["states","lgas","blocks","clusters","onshore_offshore","locations","population","oilfields"]).default("states")});
export async function GET(request:NextRequest){const parsed=schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));if(!parsed.success)return NextResponse.json({error:"Invalid layer",details:parsed.error.flatten()},{status:400});return NextResponse.json(await getGeo(parsed.data.layer))}
