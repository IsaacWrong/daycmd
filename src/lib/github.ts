import { Octokit } from "octokit";
import { env } from "./config";

export type GhItem = {
  id: number;
  title: string;
  number: number;
  repo: string;
  url: string;
  state: string;
  isDraft: boolean;
  updatedAt: string;
  author: string | null;
};

export type GhNotification = {
  id: string;
  title: string;
  type: string;
  repo: string;
  reason: string;
  url: string;
  updatedAt: string;
};

export type GhSummary = {
  authored: GhItem[];
  reviewRequested: GhItem[];
  assigned: GhItem[];
  notifications: GhNotification[];
  user: string | null;
};

let _client: Octokit | null = null;
function client(): Octokit | null {
  if (!env.GITHUB_TOKEN) return null;
  if (_client) return _client;
  _client = new Octokit({ auth: env.GITHUB_TOKEN });
  return _client;
}

type SearchItem = {
  id: number;
  title: string;
  number: number;
  html_url: string;
  state: string;
  draft?: boolean;
  updated_at: string;
  repository_url: string;
  user?: { login: string } | null;
};

function repoFromUrl(repoUrl: string): string {
  return repoUrl.replace("https://api.github.com/repos/", "");
}

function mapSearch(i: SearchItem): GhItem {
  return {
    id: i.id,
    title: i.title,
    number: i.number,
    repo: repoFromUrl(i.repository_url),
    url: i.html_url,
    state: i.state,
    isDraft: !!i.draft,
    updatedAt: i.updated_at,
    author: i.user?.login ?? null,
  };
}

async function search(gh: Octokit, q: string): Promise<GhItem[]> {
  const res = await gh.request("GET /search/issues", {
    q,
    per_page: 20,
    sort: "updated",
    order: "desc",
  });
  return (res.data.items as SearchItem[]).map(mapSearch);
}

export async function getSummary(): Promise<GhSummary | { error: string }> {
  const gh = client();
  if (!gh) return { error: "GITHUB_TOKEN not set" };

  const me = await gh.request("GET /user");
  const login = (me.data as { login: string }).login;

  const [authored, reviewRequested, assigned, notifsRes] = await Promise.all([
    search(gh, `is:open is:pr author:${login} archived:false`),
    search(gh, `is:open is:pr review-requested:${login} archived:false`),
    search(gh, `is:open assignee:${login} archived:false`),
    gh.request("GET /notifications", { per_page: 20, all: false }),
  ]);

  type RawNotif = {
    id: string;
    subject: { title: string; type: string; url: string | null };
    repository: { full_name: string };
    reason: string;
    updated_at: string;
  };

  const notifications: GhNotification[] = (notifsRes.data as RawNotif[]).map(
    (n) => ({
      id: n.id,
      title: n.subject.title,
      type: n.subject.type,
      repo: n.repository.full_name,
      reason: n.reason,
      url:
        n.subject.url
          ?.replace("api.github.com/repos", "github.com")
          .replace("/pulls/", "/pull/") ??
        `https://github.com/${n.repository.full_name}`,
      updatedAt: n.updated_at,
    }),
  );

  return { authored, reviewRequested, assigned, notifications, user: login };
}

export type RepoStats = {
  repo: string;
  lastCommit: { sha: string; message: string; url: string; date: string } | null;
  weeklyCommits: number;
  openPRs: number;
  error?: string;
};

function splitRepo(slug: string): { owner: string; repo: string } | null {
  const parts = slug.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], repo: parts[1] };
}

export async function getDailyCommitCounts(
  repoSlugs: string[],
  days = 14,
): Promise<number[]> {
  const counts = new Array(days).fill(0);
  const gh = client();
  if (!gh) return counts;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const startMs = start.getTime();

  // Authenticated user → pull their public + private push activity across ALL repos
  // (covers repos that aren't tracked in the vault Projects/ folder).
  let login: string | null = null;
  try {
    const me = await gh.request("GET /user");
    login = (me.data as { login: string }).login;
  } catch {}

  const seen = new Set<string>(); // dedupe by repo+sha
  function addCommit(dateIso: string) {
    const d = new Date(dateIso);
    d.setHours(0, 0, 0, 0);
    const idx = Math.floor((d.getTime() - startMs) / 86_400_000);
    if (idx >= 0 && idx < days) counts[idx] += 1;
  }

  // Discover all repos the user has pushed to in the window via the events
  // feed (covers repos not tracked in vault Projects/).
  const discovered = new Set<string>();
  if (login) {
    type Event = {
      type: string;
      created_at: string;
      repo: { name: string };
    };
    try {
      const evRes = await gh.request("GET /users/{username}/events", {
        username: login,
        per_page: 100,
      });
      for (const ev of evRes.data as Event[]) {
        if (ev.type !== "PushEvent") continue;
        if (new Date(ev.created_at).getTime() < startMs) continue;
        discovered.add(ev.repo.name);
      }
    } catch {}
  }

  // Merge with vault-tracked repos.
  const allRepos = Array.from(new Set([...repoSlugs, ...discovered]));

  const sinceIso = start.toISOString();
  type RawCommit = { sha: string; commit: { author: { date: string } | null } };
  const results = await Promise.allSettled(
    allRepos.map(async (slug) => {
      const parts = splitRepo(slug);
      if (!parts) return { slug, commits: [] as RawCommit[] };
      const res = await gh.request("GET /repos/{owner}/{repo}/commits", {
        owner: parts.owner,
        repo: parts.repo,
        since: sinceIso,
        per_page: 100,
        ...(login ? { author: login } : {}),
      });
      return { slug, commits: res.data as RawCommit[] };
    }),
  );
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const c of r.value.commits) {
      const date = c.commit.author?.date;
      if (!date) continue;
      const key = `${r.value.slug}/${c.sha}`;
      if (seen.has(key)) continue;
      seen.add(key);
      addCommit(date);
    }
  }
  return counts;
}

export async function getRepoStats(slug: string): Promise<RepoStats> {
  const empty: RepoStats = {
    repo: slug,
    lastCommit: null,
    weeklyCommits: 0,
    openPRs: 0,
  };
  const gh = client();
  if (!gh) return { ...empty, error: "GITHUB_TOKEN not set" };
  const parts = splitRepo(slug);
  if (!parts) return { ...empty, error: `invalid repo slug: ${slug}` };

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  type RawCommit = {
    sha: string;
    html_url: string;
    commit: { message: string; author: { date: string } | null };
  };
  type RawPull = { number: number };

  try {
    const [commitsRes, prsRes] = await Promise.all([
      gh.request("GET /repos/{owner}/{repo}/commits", {
        owner: parts.owner,
        repo: parts.repo,
        since,
        per_page: 100,
      }),
      gh.request("GET /repos/{owner}/{repo}/pulls", {
        owner: parts.owner,
        repo: parts.repo,
        state: "open",
        per_page: 100,
      }),
    ]);
    const commits = commitsRes.data as RawCommit[];
    const prs = prsRes.data as RawPull[];
    const last = commits[0];
    return {
      repo: slug,
      lastCommit: last
        ? {
            sha: last.sha.slice(0, 7),
            message: last.commit.message.split("\n")[0],
            url: last.html_url,
            date: last.commit.author?.date ?? "",
          }
        : null,
      weeklyCommits: commits.length,
      openPRs: prs.length,
    };
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : String(err) };
  }
}
