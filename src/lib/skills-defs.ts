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
      "Triage my entire inbox. First call get_inbox with query='in:inbox' and max=50 so you see EVERYTHING including Promotions/Social. State the total count. Also call gmail_list_labels ONCE up front so you know which categories I already use.\n\nEXECUTE these actions immediately (reversible):\n- Obvious spam/junk → gmail_trash.\n- Already actioned / pure FYI → gmail_archive.\n- Needs my reply → gmail_draft_reply with a tight 1-2 line draft.\n- For anything kept in inbox OR archived but worth categorizing → gmail_label_thread with the best-fitting EXISTING label from gmail_list_labels (match by name; do not invent labels). It's fine to add a label and archive in the same pass. Skip if no obvious fit — better to leave unlabeled than to mis-tag.\n\nDO NOT EXECUTE — propose only:\n- Newsletters / marketing / promotional → list them (sender, subject, gmail_get_message only if needed to judge). End with a numbered list of unsubscribe candidates and ask: 'Unsubscribe from these? Reply yes / all / specific numbers / no.' Wait for my answer.\n\nLeave anything truly important (needs me to decide) in inbox; note in summary.\n\nBatch tool calls — do many in one turn. End with: counts of executed actions (archive / trash / drafts / labels applied) + numbered unsubscribe candidates awaiting confirmation. Be ruthless on archive/trash. Be cautious on unsubscribe — I may want to keep some 'marketing' senders. Be cautious on labels — only apply when the fit is clear.",
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
    id: "stale",
    label: "Stale Tasks",
    description: "Surface overdue and stuck tasks",
    category: "Personal",
    model: "claude-sonnet-4-6",
    effort: "medium",
    maxTokens: 4000,
    prompt:
      "Call get_tasks. Filter to open tasks with: due date before today, OR start date more than 3 days past, OR no progress signal (no recent matching daily note activity). Group into 'Overdue', 'Started but stalled', 'Forgotten'. For each, propose: reschedule, downgrade priority, or abandon. Be terse — one line per task.",
  },
  {
    id: "reflect",
    label: "Daily Reflection",
    description: "Append journal prompts to today's daily note",
    category: "Personal",
    model: "claude-sonnet-4-6",
    effort: "low",
    maxTokens: 3000,
    prompt:
      "Append a 'Reflection' block to today's daily note Journal section. Use append_to_daily_note with section='Journal'. Format as:\n\n### Reflection · {time}\n\n**Moved:** (placeholder — Isaac fills)\n\n**Stuck:** (placeholder)\n\n**Learned:** (placeholder)\n\nDo NOT pull tools or fabricate content. Just append the structured prompt block. One write, done.",
  },
  {
    id: "capture",
    label: "Route Quick Capture",
    description: "Process #tagged lines in daily note Quick Capture into category raw/",
    category: "Personal",
    model: "claude-sonnet-4-6",
    effort: "low",
    maxTokens: 2000,
    prompt:
      "Call route_quick_capture once. Report back the count routed per category and any unrouted lines with reason. Don't add commentary.",
  },
  {
    id: "linkedin-post",
    label: "LinkedIn Post",
    description: "Draft a LinkedIn-native post from a seed idea or recent activity",
    category: "Personal",
    model: "claude-sonnet-4-6",
    effort: "medium",
    maxTokens: 4000,
    prompt:
      "Draft a LinkedIn post. I'll give you the seed in my next message (topic, link, takeaway, or 'use my recent activity').\n\nIf I say 'use my recent activity' or give nothing concrete: pull signal — recent daily notes (last 3 days), shipped GitHub commits, or a wiki page in Research/. Pick ONE concrete thing and lead with it. Don't generalize across many.\n\nVoice & structure:\n- LinkedIn-native, not blog-style. Short lines. Line breaks between thoughts (LinkedIn collapses paragraphs).\n- Hook = first line. Specific claim, contrarian take, or concrete number. No 'In today's world…' openers.\n- 120–220 words. Tighter is better.\n- One idea per post. No listicles unless the seed is genuinely list-shaped.\n- End with a question or low-friction CTA. No 'Thoughts?' alone — make it specific.\n- 0–3 hashtags max, at the end, only if they add reach. Skip otherwise.\n- No emojis unless I ask. No em-dash patterns ('— and') chained. No 'delve', 'tapestry', 'navigate the landscape', 'in an ever-evolving'. Plain working voice.\n- If I'm referencing my CEPA®, JWC Wealth, Palm Commissions, or Exit Edge Ai work — keep it grounded and avoid compliance landmines (no specific investment advice, no performance claims).\n\nOutput: the post body only, in a single code block so I can copy-paste. Below the block, one line: 'Variants?' and offer to do (a) shorter, (b) more contrarian, (c) story-driven. Wait for my reply.\n\nIf seed is unclear, ask ONE clarifying question before drafting. Don't draft 3 versions upfront — wait.",
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
