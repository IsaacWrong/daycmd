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

// Reject \r, \n, \0 to prevent env-line injection — a value like
// "sk-real\nGOOGLE_REDIRECT_URI=http://evil.com/cb" would otherwise write a
// second line and hijack OAuth on next restart.
const envValue = z
  .string()
  .refine((v) => !/[\r\n\0]/.test(v), {
    message: "must not contain newline or NUL characters",
  });

const Body = z.object({
  VAULT_PATH: envValue.optional(),
  ANTHROPIC_API_KEY: envValue.optional(),
  GITHUB_TOKEN: envValue.optional(),
  GOOGLE_CLIENT_ID: envValue.optional(),
  GOOGLE_CLIENT_SECRET: envValue.optional(),
  GOOGLE_REDIRECT_URI: envValue.optional(),
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
