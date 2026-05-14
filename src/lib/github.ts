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
  recentCommits: number;
  windowDays: number;
  openPRs: number;
  dailyTrend: number[];
  error?: string;
};

function splitRepo(slug: string): { owner: string; repo: string } | null {
  const parts = slug.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], repo: parts[1] };
}

let _login: string | null = null;
let _loginAt = 0;
export async function getLogin(): Promise<string | null> {
  const gh = client();
  if (!gh) return null;
  if (_login && Date.now() - _loginAt < 10 * 60_000) return _login;
  try {
    const res = await gh.request("GET /user");
    _login = (res.data as { login: string }).login;
    _loginAt = Date.now();
  } catch {
    _login = null;
  }
  return _login;
}

let _ownedRepos: string[] | null = null;
let _ownedReposAt = 0;
async function listOwnedRepos(gh: Octokit): Promise<string[]> {
  if (_ownedRepos && Date.now() - _ownedReposAt < 5 * 60_000) return _ownedRepos;
  try {
    const res = await gh.request("GET /user/repos", {
      per_page: 100,
      sort: "pushed",
      affiliation: "owner,collaborator",
    });
    _ownedRepos = (res.data as { full_name: string }[]).map((r) => r.full_name);
    _ownedReposAt = Date.now();
  } catch {
    _ownedRepos = [];
  }
  return _ownedRepos;
}

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

let _eventTrend: Map<string, number[]> | null = null;
let _eventTrendAt = 0;
let _eventTrendDays = 0;

type RawBranch = { name: string };
type RawCommitWithDate = {
  sha: string;
  commit: { author: { date: string } | null; committer: { date: string } | null };
};

async function fetchAllBranchCommits(
  gh: Octokit,
  slug: string,
  sinceIso: string,
): Promise<{ sha: string; date: string }[]> {
  const parts = splitRepo(slug);
  if (!parts) return [];

  let branches: RawBranch[] = [];
  try {
    const res = await gh.request("GET /repos/{owner}/{repo}/branches", {
      owner: parts.owner,
      repo: parts.repo,
      per_page: 50,
    });
    branches = (res.data as RawBranch[]) ?? [];
  } catch {
    return [];
  }
  if (branches.length === 0) return [];

  const seen = new Map<string, string>();
  const results = await Promise.allSettled(
    branches.map((b) =>
      gh.request("GET /repos/{owner}/{repo}/commits", {
        owner: parts.owner,
        repo: parts.repo,
        sha: b.name,
        since: sinceIso,
        per_page: 100,
      }),
    ),
  );
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const c of (r.value.data as RawCommitWithDate[]) ?? []) {
      if (seen.has(c.sha)) continue;
      const date = c.commit.author?.date ?? c.commit.committer?.date;
      if (!date) continue;
      seen.set(c.sha, date);
    }
  }
  return Array.from(seen, ([sha, date]) => ({ sha, date }));
}

export async function getUserDailyCommitsByRepo(
  days = 14,
): Promise<Map<string, number[]>> {
  const now = Date.now();
  if (
    _eventTrend &&
    _eventTrendDays === days &&
    now - _eventTrendAt < 60_000
  ) {
    return _eventTrend;
  }
  const gh = client();
  const result = new Map<string, number[]>();
  if (!gh) return result;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMs = today.getTime() - (days - 1) * 86_400_000;
  const sinceIso = new Date(startMs).toISOString();

  const owned = await listOwnedRepos(gh);
  const settled = await Promise.allSettled(
    owned.map(async (slug) => ({
      slug,
      commits: await fetchAllBranchCommits(gh, slug, sinceIso),
    })),
  );

  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    const trend = new Array(days).fill(0);
    let any = false;
    for (const c of r.value.commits) {
      const d = new Date(c.date);
      d.setHours(0, 0, 0, 0);
      const idx = Math.floor((d.getTime() - startMs) / 86_400_000);
      if (idx < 0 || idx >= days) continue;
      trend[idx] += 1;
      any = true;
    }
    if (any) result.set(r.value.slug, trend);
  }

  _eventTrend = result;
  _eventTrendAt = now;
  _eventTrendDays = days;
  return result;
}

export async function findRepoForName(name: string): Promise<string | null> {
  const gh = client();
  if (!gh) return null;
  const target = normName(name);
  if (!target) return null;
  const repos = await listOwnedRepos(gh);
  for (const r of repos) {
    const repoName = r.split("/")[1] ?? "";
    if (normName(repoName) === target) return r;
  }
  return null;
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

export async function getRepoStats(
  slug: string,
  opts: { days?: number; author?: string } = {},
): Promise<RepoStats> {
  const days = opts.days ?? 30;
  const empty: RepoStats = {
    repo: slug,
    lastCommit: null,
    recentCommits: 0,
    windowDays: days,
    openPRs: 0,
    dailyTrend: new Array(Math.min(days, 14)).fill(0),
  };
  const gh = client();
  if (!gh) return { ...empty, error: "GITHUB_TOKEN not set" };
  const parts = splitRepo(slug);
  if (!parts) return { ...empty, error: `invalid repo slug: ${slug}` };

  // Anchor `since` to start-of-day so commits earlier on day-N still count.
  const sinceDate = new Date();
  sinceDate.setHours(0, 0, 0, 0);
  sinceDate.setDate(sinceDate.getDate() - days);
  const since = sinceDate.toISOString();

  const author = opts.author;

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
        ...(author ? { author } : {}),
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

    const trendDays = Math.min(days, 14);
    const dailyTrend = new Array(trendDays).fill(0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startMs = today.getTime() - (trendDays - 1) * 86_400_000;
    for (const c of commits) {
      const dateStr = c.commit.author?.date;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      const idx = Math.floor((d.getTime() - startMs) / 86_400_000);
      if (idx >= 0 && idx < trendDays) dailyTrend[idx] += 1;
    }

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
      recentCommits: commits.length,
      windowDays: days,
      openPRs: prs.length,
      dailyTrend,
    };
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : String(err) };
  }
}
