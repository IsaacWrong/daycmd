export type SkillDef = {
  id: string;
  label: string;
  description: string;
  prompt: string;
  category?: string;
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
};

export const SKILLS: SkillDef[] = [
  {
    id: "brief",
    label: "Morning Brief",
    description: "Pull calendar, tasks, inbox, GitHub into a tight summary for today",
    category: "Personal",
    model: "claude-sonnet-4-6",
    effort: "medium",
    maxTokens: 4000,
    prompt:
      "Give me a morning brief. Pull today's calendar, open tasks (focus on overdue + today), unread inbox highlights, and any GitHub items needing review. Format as a tight markdown summary I can scan in 30 seconds. Lead with the most time-sensitive thing.",
  },
  {
    id: "triage",
    label: "Triage Inbox",
    description: "Classify recent emails and propose actions",
    category: "Personal",
    model: "claude-sonnet-4-6",
    effort: "medium",
    maxTokens: 8000,
    prompt:
      "Triage my entire inbox. First call get_inbox with query='in:inbox' and max=50 so you see EVERYTHING including Promotions/Social. State the total count.\n\nEXECUTE these actions immediately (reversible):\n- Obvious spam/junk → gmail_trash.\n- Already actioned / pure FYI → gmail_archive.\n- Needs my reply → gmail_draft_reply with a tight 1-2 line draft.\n\nDO NOT EXECUTE — propose only:\n- Newsletters / marketing / promotional → list them (sender, subject, gmail_get_message only if needed to judge). End with a numbered list of unsubscribe candidates and ask: 'Unsubscribe from these? Reply yes / all / specific numbers / no.' Wait for my answer.\n\nLeave anything truly important (needs me to decide) in inbox; note in summary.\n\nBatch tool calls — do many in one turn. End with: counts of executed actions + numbered unsubscribe candidates awaiting confirmation. Be ruthless on archive/trash. Be cautious on unsubscribe — I may want to keep some 'marketing' senders.",
  },
  {
    id: "plan",
    label: "Plan Today",
    description: "Build a realistic day plan from calendar + tasks",
    category: "Personal",
    model: "claude-sonnet-4-6",
    effort: "medium",
    maxTokens: 4000,
    prompt:
      "Build me a realistic day plan. Check today's calendar for fixed blocks, then fit my open tasks (prioritize overdue + high priority) into the gaps. Be honest about how much I can actually do — better to nail 3 things than half-do 8. Output as a markdown timeline.",
  },
  {
    id: "research",
    label: "Research Topic",
    description: "Web-search a topic, summarize, save to Research/",
    category: "Research",
    model: "claude-opus-4-7",
    effort: "xhigh",
    maxTokens: 16000,
    prompt:
      "I'll give you a topic in my next message. Process:\n\n1. FIRST call kb_query('Research'). If the wiki has a page on this topic, read it and extend rather than start fresh.\n2. If wiki is empty or doesn't cover it: max 3 web_search queries (refine, don't shotgun) and web_fetch only the 3-5 strongest sources. STOP after 5 authoritative sources. Prefer 2024-2026 .gov / SEC / FINRA / authoritative trade press.\n3. Produce a tight markdown summary: lead with bottom line, then sections with key claims, where sources conflict, open questions. Cite every claim with [Title](url) inline.\n4. Then call kb_write_output to save the polished summary to Research/output/, AND kb_ingest the same content to raw/ for compile.\n\nDon't keep digging once you have enough. Don't write placeholders. Wait for the topic.",
  },
  {
    id: "weekly",
    label: "Weekly Review",
    description: "Summarize past 7 days from daily notes",
    category: "Personal",
    model: "claude-opus-4-7",
    effort: "high",
    maxTokens: 8000,
    prompt:
      "Do a weekly review. Read the past 7 daily notes and pull out: wins, blockers, recurring themes, anything I started but didn't finish. Keep it under 200 words. Be specific — quote things from the notes when useful.",
  },
];
