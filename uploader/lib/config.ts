// Upload rules shared by the browser (instant feedback) and the API (enforcement).

// Vercel functions reject request bodies over 4.5 MB, so keep a margin for form overhead.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 50;

// Same extensions the images repo's README script lists.
export const IMAGE_EXTS = ["webp", "png", "jpg", "jpeg", "gif", "svg", "avif"];
export const VIDEO_EXTS = ["mp4", "webm", "mov", "m4v"];
export const ALLOWED_EXTS = [...IMAGE_EXTS, ...VIDEO_EXTS];

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Top-level folders in the images repo that are not product folders (this app lives in one).
export const APP_DIRS = ["uploader"];

const BAD_CHARS = /[\/\\\x00-\x1f]/;

/** Error message for an unusable file, or null if it can be uploaded. */
export function validateFile(name: string, size: number): string | null {
  if (!name || name.startsWith(".") || BAD_CHARS.test(name) || name.length > 200) {
    return `"${name}" is not a valid file name.`;
  }
  if (!ALLOWED_EXTS.includes(extOf(name))) {
    return `"${name}" is not an allowed type (${ALLOWED_EXTS.join(", ")}).`;
  }
  if (size === 0) return `"${name}" is empty.`;
  if (size > MAX_FILE_BYTES) {
    return `"${name}" is ${formatBytes(size)}, over the ${formatBytes(MAX_FILE_BYTES)} limit per file.`;
  }
  return null;
}

/** Error message for an unusable folder name, or null if it is fine. */
export function validateFolder(name: string): string | null {
  if (!name.trim()) return "Choose a folder or enter a new folder name.";
  if (name !== name.trim()) return "Folder name cannot start or end with spaces.";
  if (name.startsWith(".") || BAD_CHARS.test(name) || name.length > 100) {
    return `"${name}" is not a valid folder name.`;
  }
  if (APP_DIRS.includes(name.toLowerCase())) return `"${name}" is reserved for the upload app.`;
  return null;
}
