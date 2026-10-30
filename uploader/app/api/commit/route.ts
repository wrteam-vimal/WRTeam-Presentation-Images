import { currentCollaborator } from "@/auth";
import { MAX_FILES_PER_UPLOAD, validateFile, validateFolder } from "@/lib/config";
import { commitFiles, UploadConflict } from "@/lib/github";

type Body = { folder?: unknown; files?: { name?: unknown; sha?: unknown }[] };

// Step 2 of an upload: put the uploaded blobs into the folder as a single commit on main.
export async function POST(req: Request) {
  const user = await currentCollaborator();
  if (!user) return Response.json({ error: "Not signed in as a repo collaborator." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const folder = typeof body.folder === "string" ? body.folder : "";
  const files = Array.isArray(body.files) ? body.files : [];

  const folderError = validateFolder(folder);
  if (folderError) return Response.json({ error: folderError }, { status: 400 });
  if (!files.length || files.length > MAX_FILES_PER_UPLOAD) {
    return Response.json({ error: `Send between 1 and ${MAX_FILES_PER_UPLOAD} files.` }, { status: 400 });
  }
  const clean: { name: string; sha: string }[] = [];
  for (const f of files) {
    const name = typeof f.name === "string" ? f.name : "";
    const sha = typeof f.sha === "string" ? f.sha : "";
    // Size was enforced when the blob was created; 1 is a placeholder here.
    const invalid = validateFile(name, 1);
    if (invalid || !/^[0-9a-f]{40}$/.test(sha)) {
      return Response.json({ error: invalid ?? `Bad upload reference for "${name}".` }, { status: 400 });
    }
    clean.push({ name, sha });
  }
  if (new Set(clean.map((f) => f.name.toLowerCase())).size !== clean.length) {
    return Response.json({ error: "Two files have the same name." }, { status: 400 });
  }

  const author = {
    name: user.name || user.login,
    email: user.githubId ? `${user.githubId}+${user.login}@users.noreply.github.com` : `${user.login}@users.noreply.github.com`,
  };
  try {
    const commit = await commitFiles({ folder, files: clean, author });
    return Response.json(commit);
  } catch (e) {
    if (e instanceof UploadConflict) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
