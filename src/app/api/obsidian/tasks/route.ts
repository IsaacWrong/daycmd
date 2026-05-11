import { NextResponse } from "next/server";
import { getAllTasks } from "@/lib/obsidian";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tasks = await getAllTasks();
    return NextResponse.json({ tasks });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
