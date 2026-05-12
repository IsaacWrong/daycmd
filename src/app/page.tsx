import { format } from "date-fns";
import Link from "next/link";
import { TasksCard } from "@/components/TasksCard";
import { DailyNoteCard } from "@/components/DailyNoteCard";
import { GitHubCard } from "@/components/GitHubCard";
import { GmailCard } from "@/components/GmailCard";
import { CalendarCard } from "@/components/CalendarCard";
import { AgentPanel } from "@/components/AgentPanel";
import { AutomationsCard } from "@/components/AutomationsCard";
import { KnowledgeCard } from "@/components/KnowledgeCard";
import { NowNext } from "@/components/NowNext";
import { ErrorsCard } from "@/components/ErrorsCard";
import { WeatherBadge } from "@/components/WeatherBadge";
import { SkillsPanel } from "@/components/SkillsPanel";

export default function Home() {
  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <main className="flex-1 px-8 py-10 max-w-[1600px] mx-auto w-full">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">AI OS</h1>
        <div className="flex items-center gap-4">
          <WeatherBadge />
          <span className="text-sm text-zinc-400">{today}</span>
          <Link href="/settings" className="text-xs text-zinc-500 hover:text-zinc-300">
            Settings
          </Link>
        </div>
      </header>

      <NowNext />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <AgentPanel />
        <SkillsPanel />
        <KnowledgeCard />
        <AutomationsCard />
        <CalendarCard />
        <GmailCard />
        <TasksCard />
        <DailyNoteCard />
        <GitHubCard />
        <ErrorsCard />
      </div>
    </main>
  );
}
