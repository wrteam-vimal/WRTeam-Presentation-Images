# Uploader

Next.js app for adding images to this repo from the browser. It lives in `uploader/`, which the README script skips, so it never appears as a product folder.

- **Sign in with GitHub.** Only people with write access to the repo can sign in: the owner, or collaborators with the Write, Maintain or Admin role (Settings → Collaborators). The check uses the person's own GitHub sign-in and runs again on every request, so removing someone locks them out right away.
- **Upload.** Pick a folder or create a new one, then drop files. Files must be at most 4 MB each and one of `webp, png, jpg, jpeg, gif, svg, avif, mp4, webm, mov, m4v`. The browser and the server both check this.
- **One commit.** Each upload becomes one commit on `main`, with the uploader as author. Existing files are never overwritten. The repo's GitHub Action then renames the files and rebuilds the README.

## One-time setup

1. **GitHub OAuth App** (github.com → Settings → Developer settings → OAuth Apps → New):
   - Homepage URL: `https://<your-app>.vercel.app`
   - Callback URL: `https://<your-app>.vercel.app/api/auth/callback/github`
   - Copy the Client ID and generate a Client secret.
2. **Fine-grained token** (Settings → Developer settings → Personal access tokens → Fine-grained):
   - Repository access: only `WRTeam-Presentation-Images`
   - Permissions: **Contents: Read and write**, **Metadata: Read-only**
3. **Vercel project** (Add New → Project → import this repo):
   - **Root Directory: `uploader`**
   - Environment variables: see `.env.example` (`AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `GITHUB_TOKEN`).
   - `vercel.json` skips rebuilds when a push doesn't touch `uploader/`, such as image uploads or README updates.

Vercel's free Hobby plan is for non-commercial use only. A company tool needs Vercel Pro.

## Local development

```bash
cd uploader
cp .env.example .env.local   # fill in values; OAuth callback http://localhost:3000/api/auth/callback/github
npm install
npm run dev
```
