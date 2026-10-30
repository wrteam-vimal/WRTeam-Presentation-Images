import "server-only";
import { APP_DIRS } from "@/lib/config";

// Minimal GitHub REST client for the images repo, using a server-side token.

const API = "https://api.github.com";

export const repo = {
  owner: process.env.GITHUB_OWNER || "wrteam-vimal",
  name: process.env.GITHUB_REPO || "WRTeam-Presentation-Images",
  branch: process.env.GITHUB_BRANCH || "main",
};

export const repoUrl = `https://github.com/${repo.owner}/${repo.name}`;

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** A problem the user can fix (e.g. a file that already exists). */
export class UploadConflict extends Error {}

async function gh<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const token = init.token ?? process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set.");
  const res = await fetch(`${API}/repos/${repo.owner}/${repo.name}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new GitHubError(res.status, data.message || `GitHub API ${res.status}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/**
 * True if the signed-in user (identified by their own GitHub OAuth token) can write to the repo:
 * the owner, or a collaborator with Write, Maintain or Admin access.
 * Uses the user's token because fine-grained PATs cannot call the collaborators API.
 */
export async function hasWriteAccess(userToken: string): Promise<boolean> {
  try {
    const info = await gh<{ permissions?: { admin?: boolean; maintain?: boolean; push?: boolean } }>("", {
      token: userToken,
    });
    const p = info.permissions ?? {};
    return !!(p.admin || p.maintain || p.push);
  } catch (e) {
    // 401 = token revoked/expired, 404 = no access to the repo.
    if (e instanceof GitHubError && (e.status === 401 || e.status === 404)) return false;
    throw e;
  }
}

type Ref = { object: { sha: string } };
type Commit = { sha: string; html_url: string; tree: { sha: string } };
type Tree = { sha: string; tree: { path: string; type: string }[] };

async function head() {
  const ref = await gh<Ref>(`/git/ref/heads/${repo.branch}`);
  const commit = await gh<Commit>(`/git/commits/${ref.object.sha}`);
  return { sha: ref.object.sha, treeSha: commit.tree.sha };
}

/** Top-level product folders on the branch, sorted by name. */
export async function listFolders(): Promise<string[]> {
  const { treeSha } = await head();
  const tree = await gh<Tree>(`/git/trees/${treeSha}`);
  return tree.tree
    .filter((e) => e.type === "tree" && !e.path.startsWith(".") && !APP_DIRS.includes(e.path))
    .map((e) => e.path)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** Store file bytes as a git blob and return its SHA. */
export async function createBlob(bytes: Buffer): Promise<string> {
  const blob = await gh<{ sha: string }>("/git/blobs", {
    method: "POST",
    body: { content: bytes.toString("base64"), encoding: "base64" },
  });
  return blob.sha;
}

/**
 * Add already-uploaded blobs to `folder` in a single commit on the branch.
 * Refuses to overwrite existing files and retries if the branch moved meanwhile
 * (the README Action also pushes to it).
 */
export async function commitFiles(opts: {
  folder: string;
  files: { name: string; sha: string }[];
  author: { name: string; email: string };
}): Promise<{ sha: string; url: string }> {
  const paths = opts.files.map((f) => `${opts.folder}/${f.name}`);
  const message = `Upload ${paths.length} file${paths.length === 1 ? "" : "s"} to ${opts.folder}`;

  for (let attempt = 0; ; attempt++) {
    const base = await head();
    const existing = await gh<Tree>(`/git/trees/${base.treeSha}?recursive=1`);
    const taken = new Set(existing.tree.map((e) => e.path.toLowerCase()));
    const clash = paths.filter((p) => taken.has(p.toLowerCase()));
    if (clash.length) throw new UploadConflict(`Already in the repo: ${clash.join(", ")}`);

    const tree = await gh<Tree>("/git/trees", {
      method: "POST",
      body: {
        base_tree: base.treeSha,
        tree: opts.files.map((f, i) => ({ path: paths[i], mode: "100644", type: "blob", sha: f.sha })),
      },
    });
    const commit = await gh<Commit>("/git/commits", {
      method: "POST",
      body: { message, tree: tree.sha, parents: [base.sha], author: opts.author },
    });
    try {
      await gh(`/git/refs/heads/${repo.branch}`, { method: "PATCH", body: { sha: commit.sha, force: false } });
      return { sha: commit.sha, url: commit.html_url };
    } catch (e) {
      // 422 = not a fast-forward: someone pushed in between; rebuild on the new head.
      if (!(e instanceof GitHubError && e.status === 422) || attempt >= 2) throw e;
    }
  }
}
