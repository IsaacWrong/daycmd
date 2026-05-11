import { NextResponse } from "next/server";
import { getSummary } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getSummary();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
