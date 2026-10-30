import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import { hasWriteAccess } from "@/lib/github";

declare module "next-auth" {
  interface Session {
    user: { login?: string; githubId?: number; canWrite?: boolean } & DefaultSession["user"];
  }
}

type GitHubProfile = { login?: string; id?: number };

// GitHub provider reads AUTH_GITHUB_ID / AUTH_GITHUB_SECRET; AUTH_SECRET signs the session.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  pages: { signIn: "/", error: "/" },
  callbacks: {
    // Only people who can write to the images repo (owner / collaborators) may sign in.
    async signIn({ account }) {
      return !!account?.access_token && (await hasWriteAccess(account.access_token));
    },
    async jwt({ token, profile, account }) {
      if (profile) {
        const p = profile as GitHubProfile;
        token.login = p.login;
        token.githubId = p.id;
      }
      // Kept inside the encrypted session cookie; never sent to the browser as data.
      if (account?.access_token) token.accessToken = account.access_token;
      return token;
    },
    // Runs on every auth() call, so removing someone from the repo locks them out at once.
    async session({ session, token }) {
      session.user.login = token.login as string | undefined;
      session.user.githubId = token.githubId as number | undefined;
      const accessToken = token.accessToken as string | undefined;
      session.user.canWrite = !!accessToken && (await hasWriteAccess(accessToken));
      return session;
    },
  },
});

/** The signed-in user if they can still write to the repo, else null. */
export async function currentCollaborator() {
  const session = await auth();
  const login = session?.user?.login;
  if (!login || !session.user.canWrite) return null;
  return { ...session.user, login };
}
