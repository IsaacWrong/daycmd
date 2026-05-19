import { NextResponse } from "next/server";
import { getContacts } from "@/lib/contacts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "1";
    const contacts = await getContacts(refresh);
    return NextResponse.json({ contacts });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
