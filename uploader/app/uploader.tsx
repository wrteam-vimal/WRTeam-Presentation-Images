"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  ALLOWED_EXTS,
  MAX_FILE_BYTES,
  MAX_FILES_PER_UPLOAD,
  formatBytes,
  validateFile,
  validateFolder,
} from "@/lib/config";

type Item = { id: string; file: File; error: string | null; status: "ready" | "uploading" | "done" | "failed" };
type Result = { ok: true; url: string; folder: string; count: number } | { ok: false; error: string };

const NEW = "__new__";

async function post<T>(url: string, body: BodyInit, json = false): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    body,
    headers: json ? { "Content-Type": "application/json" } : undefined,
  });
  const data = await res.json().catch(() => ({ error: `Request failed (${res.status}).` }));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data as T;
}

export default function Uploader({ folders, repoUrl, branch }: { folders: string[]; repoUrl: string; branch: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [choice, setChoice] = useState(folders[0] ?? NEW);
  const [newFolder, setNewFolder] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const folder = choice === NEW ? newFolder : choice;
  const folderError = validateFolder(folder);
  const ready = items.filter((i) => !i.error);

  function add(files: FileList | File[]) {
    setResult(null);
    setItems((prev) => {
      const names = new Set(prev.map((i) => i.file.name.toLowerCase()));
      const next = [...prev];
      for (const file of Array.from(files)) {
        const lower = file.name.toLowerCase();
        let error = validateFile(file.name, file.size);
        if (!error && names.has(lower)) error = `"${file.name}" is already in the list.`;
        if (!error && next.filter((i) => !i.error).length >= MAX_FILES_PER_UPLOAD) {
          error = `Only ${MAX_FILES_PER_UPLOAD} files per upload.`;
        }
        names.add(lower);
        next.push({ id: crypto.randomUUID(), file, error, status: "ready" });
      }
      return next;
    });
  }

  function setStatus(id: string, status: Item["status"]) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  }

  async function upload() {
    if (folderError || !ready.length) return;
    setBusy(true);
    setResult(null);
    try {
      const blobs: { name: string; sha: string }[] = [];
      for (const item of ready) {
        setStatus(item.id, "uploading");
        const form = new FormData();
        form.append("file", item.file);
        try {
          const { sha } = await post<{ sha: string }>("/api/blob", form);
          blobs.push({ name: item.file.name, sha });
        } catch (e) {
          setStatus(item.id, "failed");
          throw e;
        }
      }
      const commit = await post<{ url: string }>("/api/commit", JSON.stringify({ folder, files: blobs }), true);
      setItems([]);
      setNewFolder("");
      setResult({ ok: true, url: commit.url, folder, count: blobs.length });
      if (choice === NEW) setChoice(folder);
      router.refresh();
    } catch (e) {
      setItems((prev) => prev.map((i) => (i.status === "uploading" ? { ...i, status: "ready" } : i)));
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <label className="stack">
        <span className="label">Folder</span>
        <select value={choice} onChange={(e) => setChoice(e.target.value)} disabled={busy}>
          {folders.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
          <option value={NEW}>+ New folder…</option>
        </select>
      </label>
      {choice === NEW && (
        <label className="stack">
          <span className="label">New folder name</span>
          <input
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            placeholder="e.g. eTaxi"
            disabled={busy}
          />
        </label>
      )}
      {folder && folderError && <p className="error">{folderError}</p>}

      <div
        className={`drop${dragging ? " over" : ""}`}
        onClick={() => !busy && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) add(e.dataTransfer.files);
        }}
      >
        <strong>Drop files here or click to choose</strong>
        <span className="muted">
          Max {formatBytes(MAX_FILE_BYTES)} per file · {ALLOWED_EXTS.join(", ")}
        </span>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept={ALLOWED_EXTS.map((e) => `.${e}`).join(",")}
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className="files">
          {items.map((i) => (
            <li key={i.id} className={i.error ? "bad" : i.status}>
              <span className="name">{i.file.name}</span>
              <span className="muted">{formatBytes(i.file.size)}</span>
              <span className="state">
                {i.error ?? { ready: "Ready", uploading: "Uploading…", done: "Done", failed: "Failed" }[i.status]}
              </span>
              <button
                aria-label={`Remove ${i.file.name}`}
                disabled={busy}
                onClick={() => setItems((prev) => prev.filter((x) => x.id !== i.id))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="row">
        <button className="primary" onClick={upload} disabled={busy || !!folderError || !ready.length}>
          {busy ? "Uploading…" : `Upload ${ready.length || ""} file${ready.length === 1 ? "" : "s"}`}
        </button>
        {items.some((i) => i.error) && (
          <button disabled={busy} onClick={() => setItems((prev) => prev.filter((i) => !i.error))}>
            Remove invalid files
          </button>
        )}
      </div>

      {result?.ok && (
        <p className="success">
          Uploaded {result.count} file{result.count === 1 ? "" : "s"} to <b>{result.folder}</b>.{" "}
          <a href={result.url}>View commit</a> · <a href={`${repoUrl}/blob/${branch}/README.md`}>README</a> (updates in
          about a minute)
        </p>
      )}
      {result && !result.ok && <p className="error">{result.error}</p>}
    </section>
  );
}
