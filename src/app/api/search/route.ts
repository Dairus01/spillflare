import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchAll } from "@/lib/data";
const schema=z.object({q:z.string().trim().min(2).max(100),limit:z.coerce.number().int().min(1).max(50).default(30)});
export async function GET(request:NextRequest){const parsed=schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));if(!parsed.success)return NextResponse.json({error:"Enter at least two characters.",details:parsed.error.flatten()},{status:400});return NextResponse.json({data:await searchAll(parsed.data.q,parsed.data.limit)})}
