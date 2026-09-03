import { NextResponse } from "next/server";
import { findSpill } from "@/lib/data";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const row=await findSpill(id);return row?NextResponse.json({data:row}):NextResponse.json({error:"Oil spill record not found"},{status:404})}
