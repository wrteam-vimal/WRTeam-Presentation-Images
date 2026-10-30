import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import { isCollaborator } from "@/lib/github";

declare module "next-auth" {
  interface Session {
    user: { login?: string; githubId?: number } & DefaultSession["user"];
  }
}

type GitHubProfile = { login?: string; id?: number };

// GitHub provider reads AUTH_GITHUB_ID / AUTH_GITHUB_SECRET; AUTH_SECRET signs the session.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  pages: { signIn: "/", error: "/" },
  callbacks: {
    // Only collaborators on the images repo may sign in.
    async signIn({ profile }) {
      const login = (profile as GitHubProfile | undefined)?.login;
      return !!login && (await isCollaborator(login));
    },
    async jwt({ token, profile }) {
      if (profile) {
        const p = profile as GitHubProfile;
        token.login = p.login;
        token.githubId = p.id;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.login = token.login as string | undefined;
      session.user.githubId = token.githubId as number | undefined;
      return session;
    },
  },
});

/**
 * The signed-in user if they are still a collaborator, else null.
 * Re-checked on every request so removing someone from the repo locks them out at once.
 */
export async function currentCollaborator() {
  const session = await auth();
  const login = session?.user?.login;
  if (!login || !(await isCollaborator(login))) return null;
  return { ...session.user, login };
}
