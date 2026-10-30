import { currentCollaborator } from "@/auth";
import { validateFile } from "@/lib/config";
import { createBlob } from "@/lib/github";

// Step 1 of an upload: one file per request (keeps each request under Vercel's body limit).
export async function POST(req: Request) {
  if (!(await currentCollaborator())) {
    return Response.json({ error: "Not signed in as a repo collaborator." }, { status: 401 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file received." }, { status: 400 });
  }
  const invalid = validateFile(file.name, file.size);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  const sha = await createBlob(Buffer.from(await file.arrayBuffer()));
  return Response.json({ sha });
}
