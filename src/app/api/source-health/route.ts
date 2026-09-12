import { NextResponse } from "next/server";
import { getMetadata, getRefreshStatus } from "@/lib/data";
export async function GET(){const [metadata, refresh]=await Promise.all([getMetadata(),getRefreshStatus()]);return NextResponse.json({data:metadata,refresh},{headers:{"Cache-Control":"no-store"}})}
