import { NextResponse } from "next/server";
import { getMetadata } from "@/lib/data";
export async function GET(){const metadata=await getMetadata();return NextResponse.json({data:metadata},{headers:{"Cache-Control":"no-store"}})}
