import { NextResponse } from "next/server";
import { getUsageSummary } from "@/lib/usage";
import { env } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ...getUsageSummary(),
    vaultConfigured: !!env.VAULT_PATH,
  });
}
