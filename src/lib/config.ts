import { z } from "zod";

const Env = z.object({
  VAULT_PATH: z.string().min(1, "VAULT_PATH required"),
  GITHUB_TOKEN: z.string().optional().default(""),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REDIRECT_URI: z
    .string()
    .optional()
    .default("http://localhost:3000/api/auth/google/callback"),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
});

export const env = Env.parse(process.env);
