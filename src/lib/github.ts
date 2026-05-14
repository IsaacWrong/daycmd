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
let _rateWarned = 0;
function client(): Octokit | null {
  if (!env.GITHUB_TOKEN) return null;
  if (_client) return _client;
  _client = new Octokit({
    auth: env.GITHUB_TOKEN,
    throttle: {
      onRateLimit: (retryAfter: number, options: { method: string; url: string }) => {
        const now = Date.now();
        if (now - _rateWarned > 30_000) {
          _rateWarned = now;
          console.warn(
            `[github] rate limited on ${options.method} ${options.url}; retryAfter=${retryAfter}s — not retrying`,
          );
        }
        return false;
      },
      onSecondaryRateLimit: (
        _retryAfter: number,
        options: { method: string; url: string },
      ) => {
        console.warn(`[github] secondary rate limit on ${options.method} ${options.url}`);
        return false;
      },
    },
  });
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
let _loginInflight: Promise<string | null> | null = null;
const LOGIN_TTL_MS = 60 * 60_000;
export async function getLogin(): Promise<string | null> {
  if (_login && Date.now() - _loginAt < LOGIN_TTL_MS) return _login;
  if (_loginInflight) return _loginInflight;
  const gh = client();
  if (!gh) return null;
  _loginInflight = (async () => {
    try {
      const res = await gh.request("GET /user");
      _login = (res.data as { login: string }).login;
      _loginAt = Date.now();
    } catch {
      _login = null;
    }
    return _login;
  })().finally(() => {
    _loginInflight = null;
  });
  return _loginInflight;
}

type OwnedRepo = { full_name: string; pushed_at: string | null };
let _ownedRepos: OwnedRepo[] | null = null;
let _ownedReposAt = 0;
let _ownedReposInflight: Promise<OwnedRepo[]> | null = null;
const OWNED_REPOS_TTL_MS = 30 * 60_000;
async function listOwnedReposFull(gh: Octokit): Promise<OwnedRepo[]> {
  if (_ownedRepos && Date.now() - _ownedReposAt < OWNED_REPOS_TTL_MS) return _ownedRepos;
  if (_ownedReposInflight) return _ownedReposInflight;
  _ownedReposInflight = (async () => {
    try {
      const res = await gh.request("GET /user/repos", {
        per_page: 100,
        sort: "pushed",
        affiliation: "owner,collaborator",
      });
      _ownedRepos = (res.data as OwnedRepo[]).map((r) => ({
        full_name: r.full_name,
        pushed_at: r.pushed_at,
      }));
      _ownedReposAt = Date.now();
    } catch {
      _ownedRepos = [];
    }
    return _ownedRepos;
  })().finally(() => {
    _ownedReposInflight = null;
  });
  return _ownedReposInflight;
}

async function listOwnedRepos(gh: Octokit): Promise<string[]> {
  const repos = await listOwnedReposFull(gh);
  return repos.map((r) => r.full_name);
}

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

let _eventTrend: Map<string, number[]> | null = null;
let _eventTrendAt = 0;
let _eventTrendDays = 0;
let _eventTrendInflight: Promise<Map<string, number[]>> | null = null;
const EVENT_TREND_TTL_MS = 10 * 60_000;

type RepoCommit = { sha: string; date: string; slug: string };

type RawBranch = { name: string };
type RawCommitWithDate = {
  sha: string;
  commit: { author: { date: string } | null; committer: { date: string } | null };
};

async function fetchRepoBranchCommits(
  gh: Octokit,
  slug: string,
  sinceIso: string,
): Promise<RepoCommit[]> {
  const parts = splitRepo(slug);
  if (!parts) return [];

  let branches: RawBranch[] = [];
  try {
    const res = await gh.request("GET /repos/{owner}/{repo}/branches", {
      owner: parts.owner,
      repo: parts.repo,
      per_page: 30,
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
      const date = c.commit.committer?.date ?? c.commit.author?.date;
      if (!date) continue;
      seen.set(c.sha, date);
    }
  }
  return Array.from(seen, ([sha, date]) => ({ sha, date, slug }));
}

export async function getUserDailyCommitsByRepo(
  days = 14,
): Promise<Map<string, number[]>> {
  const now = Date.now();
  if (
    _eventTrend &&
    _eventTrendDays === days &&
    now - _eventTrendAt < EVENT_TREND_TTL_MS
  ) {
    return _eventTrend;
  }
  if (_eventTrendInflight) return _eventTrendInflight;

  const gh = client();
  if (!gh) return new Map();

  _eventTrendInflight = (async () => {
    const result = new Map<string, number[]>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startMs = today.getTime() - (days - 1) * 86_400_000;
    const sinceIso = new Date(startMs).toISOString();

    const repos = await listOwnedReposFull(gh);
    // Only fan out to repos pushed-to within the window (plus a small buffer).
    const cutoff = startMs - 86_400_000;
    const active = repos.filter((r) => {
      if (!r.pushed_at) return false;
      return new Date(r.pushed_at).getTime() >= cutoff;
    });

    const settled = await Promise.allSettled(
      active.map((r) => fetchRepoBranchCommits(gh, r.full_name, sinceIso)),
    );

    let anySuccess = false;
    for (const s of settled) {
      if (s.status !== "fulfilled") continue;
      anySuccess = true;
      for (const c of s.value) {
        const day = new Date(c.date);
        day.setHours(0, 0, 0, 0);
        const idx = Math.floor((day.getTime() - startMs) / 86_400_000);
        if (idx < 0 || idx >= days) continue;
        let trend = result.get(c.slug);
        if (!trend) {
          trend = new Array(days).fill(0);
          result.set(c.slug, trend);
        }
        trend[idx] += 1;
      }
    }

    if (!anySuccess) return _eventTrend ?? result;

    _eventTrend = result;
    _eventTrendAt = Date.now();
    _eventTrendDays = days;
    return result;
  })().finally(() => {
    _eventTrendInflight = null;
  });

  return _eventTrendInflight;
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
  _repoSlugs: string[],
  days = 14,
): Promise<number[]> {
  const counts = new Array(days).fill(0);
  const byRepo = await getUserDailyCommitsByRepo(days);
  for (const trend of byRepo.values()) {
    for (let i = 0; i < days; i++) counts[i] += trend[i] ?? 0;
  }
  return counts;
}

const REPO_STATS_TTL_MS = 10 * 60_000;
const _repoStatsCache = new Map<string, { ts: number; data: RepoStats }>();
const _repoStatsInflight = new Map<string, Promise<RepoStats>>();

export async function getRepoStats(
  slug: string,
  opts: { days?: number; author?: string } = {},
): Promise<RepoStats> {
  const days = opts.days ?? 30;
  const cacheKey = `${slug}|${days}|${opts.author ?? ""}`;
  const cached = _repoStatsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < REPO_STATS_TTL_MS) return cached.data;
  const inflight = _repoStatsInflight.get(cacheKey);
  if (inflight) return inflight;

  const promise = _getRepoStatsImpl(slug, days, opts.author).then((data) => {
    if (!data.error) _repoStatsCache.set(cacheKey, { ts: Date.now(), data });
    return data;
  }).finally(() => {
    _repoStatsInflight.delete(cacheKey);
  });
  _repoStatsInflight.set(cacheKey, promise);
  return promise;
}

async function _getRepoStatsImpl(
  slug: string,
  days: number,
  author: string | undefined,
): Promise<RepoStats> {
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
