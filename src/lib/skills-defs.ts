export type SkillDef = {
  id: string;
  label: string;
  description: string;
  prompt: string;
  category?: string;
};

export const SKILLS: SkillDef[] = [
  {
    id: "brief",
    label: "Morning Brief",
    description: "Pull calendar, tasks, inbox, GitHub into a tight summary for today",
    category: "Personal",
    prompt:
      "Give me a morning brief. Pull today's calendar, open tasks (focus on overdue + today), unread inbox highlights, and any GitHub items needing review. Format as a tight markdown summary I can scan in 30 seconds. Lead with the most time-sensitive thing.",
  },
  {
    id: "triage",
    label: "Triage Inbox",
    description: "Classify recent emails and propose actions",
    category: "Personal",
    prompt:
      "Triage my entire inbox. First call get_inbox with query='in:inbox' and max=50 so you see EVERYTHING including Promotions/Social. State the total count. Then for each email suggest one of: archive, respond now (draft a 1-2 line reply via gmail_draft_reply), respond later (note in daily note), or trash (obvious junk). Execute the safe actions (archive, trash for clear spam, drafts for replies) — don't just propose. Be ruthless, most emails don't need a response.",
  },
  {
    id: "plan",
    label: "Plan Today",
    description: "Build a realistic day plan from calendar + tasks",
    category: "Personal",
    prompt:
      "Build me a realistic day plan. Check today's calendar for fixed blocks, then fit my open tasks (prioritize overdue + high priority) into the gaps. Be honest about how much I can actually do — better to nail 3 things than half-do 8. Output as a markdown timeline.",
  },
  {
    id: "weekly",
    label: "Weekly Review",
    description: "Summarize past 7 days from daily notes",
    category: "Personal",
    prompt:
      "Do a weekly review. Read the past 7 daily notes and pull out: wins, blockers, recurring themes, anything I started but didn't finish. Keep it under 200 words. Be specific — quote things from the notes when useful.",
  },
];
