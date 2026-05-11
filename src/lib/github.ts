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
