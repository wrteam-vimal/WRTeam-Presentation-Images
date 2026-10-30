import { auth, signIn, signOut } from "@/auth";
import { listFolders, repo, repoUrl } from "@/lib/github";
import Uploader from "./uploader";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await auth();
  const login = session?.user?.login;

  if (!login || !session.user.canWrite) {
    const denied = error === "AccessDenied" || !!login;
    return (
      <main className="card narrow">
        <h1>WRTeam Presentation Images</h1>
        <p className="muted">
          Upload images to the {repo.name} repo. Only repo collaborators with write access can sign in.
        </p>
        {denied && (
          <p className="error">
            That GitHub account does not have write access to {repo.owner}/{repo.name}. Ask the repo owner to add you
            as a collaborator.
          </p>
        )}
        {error && !denied && <p className="error">Sign-in failed ({error}). Please try again.</p>}
        <form
          action={async () => {
            "use server";
            if (login) await signOut({ redirect: false });
            await signIn("github", { redirectTo: "/" });
          }}
        >
          <button className="primary">{login ? "Sign in with a different GitHub account" : "Sign in with GitHub"}</button>
        </form>
      </main>
    );
  }

  const folders = await listFolders();
  return (
    <main className="card">
      <header className="row">
        <div>
          <h1>Upload images</h1>
          <p className="muted">
            Files go straight to <a href={repoUrl}>{repo.owner}/{repo.name}</a> on <code>{repo.branch}</code>; the README
            updates itself a minute later.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <span className="muted">@{login} </span>
          <button>Sign out</button>
        </form>
      </header>
      <Uploader folders={folders} repoUrl={repoUrl} branch={repo.branch} />
    </main>
  );
}
