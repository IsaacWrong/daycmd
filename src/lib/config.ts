import { z } from "zod";

const Env = z.object({
  // Empty when not configured — the setup wizard at /setup writes it. Library
  // code that reads from the vault should check truthiness and surface a
  // helpful error instead of crashing at module load.
  VAULT_PATH: z.string().optional().default(""),
  GITHUB_TOKEN: z.string().optional().default(""),
  DISCORD_BOT_TOKEN: z.string().optional().default(""),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REDIRECT_URI: z
    .string()
    .optional()
    .default("http://localhost:3000/api/auth/google/callback"),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  POSTHOG_API_KEY: z.string().optional().default(""),
  POSTHOG_BASE_URL: z.string().optional().default("https://us.posthog.com"),
});

export const env = Env.parse(process.env);
