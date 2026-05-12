import { format } from "date-fns";
import { TasksCard } from "@/components/TasksCard";
import { DailyNoteCard } from "@/components/DailyNoteCard";
import { GitHubCard } from "@/components/GitHubCard";
import { GmailCard } from "@/components/GmailCard";
import { CalendarCard } from "@/components/CalendarCard";
import { AgentPanel } from "@/components/AgentPanel";
import { AutomationsCard } from "@/components/AutomationsCard";
import { KnowledgeCard } from "@/components/KnowledgeCard";

export default function Home() {
  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <main className="flex-1 px-8 py-10 max-w-[1600px] mx-auto w-full">
      <header className="mb-10 flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">AI OS</h1>
        <span className="text-sm text-zinc-400">{today}</span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <AgentPanel />
        <KnowledgeCard />
        <AutomationsCard />
        <CalendarCard />
        <GmailCard />
        <TasksCard />
        <DailyNoteCard />
        <GitHubCard />
      </div>
    </main>
  );
}
