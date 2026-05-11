import { NextResponse } from "next/server";
import { SKILLS } from "@/lib/skills-defs";

export async function GET() {
  return NextResponse.json({ skills: SKILLS });
}
