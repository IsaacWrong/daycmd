import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getEnvStatus,
  updateEnvFile,
  validateVaultPath,
  type EnvKey,
} from "@/lib/env-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  VAULT_PATH: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
});

export async function GET() {
  return NextResponse.json(await getEnvStatus());
}

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const updates = parsed.data as Partial<Record<EnvKey, string>>;
  if (updates.VAULT_PATH !== undefined && updates.VAULT_PATH !== "") {
    const check = await validateVaultPath(updates.VAULT_PATH);
    if (!check.ok) {
      return NextResponse.json(
        { error: `VAULT_PATH invalid: ${check.reason}` },
        { status: 400 },
      );
    }
  }
  try {
    await updateEnvFile(updates);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    status: await getEnvStatus(),
    restartRequired: true,
  });
}
