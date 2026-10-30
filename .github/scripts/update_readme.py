"""Rename images and videos to URL-safe names and rebuild the README.

Each top-level folder (one per product) gets a collapsible section with a
"copy all" code block and one code block per file holding its <img> tag.
New or changed files go to the top of their folder, and folders with the
latest changes move to the top of the README.
Titles already in README.md are kept, so a title can be edited by hand.
New files get a title derived from their original file name.
Also keeps the WRTeam copyright year range in README.md and LICENSE current.
"""
import datetime
import html
import os
import re
import subprocess
import sys
from urllib.parse import quote, unquote

REPO = os.environ.get("REPO", "wrteam-vimal/WRTeam-Presentation-Images")
BRANCH = os.environ.get("BRANCH", "main")
BEFORE = os.environ.get("BEFORE", "")  # commit before this push, if known
README = "README.md"
LICENSE = "LICENSE"
ROOT = "Uncategorized"  # section for media files left in the repo root
IMAGE_EXTS = {".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".avif"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v"}
EXTS = IMAGE_EXTS | VIDEO_EXTS
SECTION = re.compile(r"^<summary><b>(.+?)</b>")
# Each file is a "**1. Title** (Image)" line followed by a code block whose tag
# src gives the file path (relative to the repo root).
ITEM = re.compile(r"^\*\*\d+\. (.*)\*\* \((?:Image|Video)\)$")
SRC = re.compile(r'src="https://raw\.githubusercontent\.com/[^/]+/[^/]+/[^/]+/([^"]+)"')
# Older table layout: title plus file name, from the raw link or "[name](...)" column.
ROW = re.compile(
    r"^\|\s*\d+\s*\|\s*(.*?)\s*\|\s*(?:(?:Image|Video)\s*\|\s*)?"
    r"(?:\[([^\]]+)\]|https://raw\.githubusercontent\.com/\S*/([^/\s|]+))"
)
SMALL = {"and", "or", "of", "for", "to", "the", "a", "an", "in", "on", "with"}
COPYRIGHT = re.compile(r"((?:©|\(c\)) )(\d{4})(?:-\d{4})?( WRTeam)", re.IGNORECASE)


def stamp_year(text, year=None):
    """Turn "© 2026 WRTeam" into "© 2026-<year> WRTeam", keeping the first year."""
    year = year or datetime.datetime.now(datetime.timezone.utc).year

    def repl(m):
        first = int(m.group(2))
        span = f"{first}-{year}" if year > first else str(first)
        return f"{m.group(1)}{span}{m.group(3)}"

    return COPYRIGHT.sub(repl, text)


def slugify(stem):
    s = stem.lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "image"


def title_from(stem):
    words = re.sub(r"^[\d\s._-]+", "", stem)  # drop leading "12-" / "10.1 " numbering
    words = re.sub(r"[-_]+", " ", words or stem).strip()
    out = []
    for i, w in enumerate(words.split()):
        if w.lower() == "and":
            out.append("&")
        elif i and w.lower() in SMALL:
            out.append(w.lower())
        elif w.islower():
            out.append(w.capitalize())
        else:
            out.append(w)
    return " ".join(out)


def sort_key(path):
    stem = os.path.splitext(os.path.basename(path))[0]
    m = re.match(r"^(\d+(?:-\d+)*)-", stem)
    if not m:
        return (1, (), stem)
    nums = tuple(int(n) for n in m.group(1).split("-"))
    return (0, nums, stem[m.end():])


def join(folder, name):
    return f"{folder}/{name}" if folder else name


def is_media(name):
    return os.path.splitext(name)[1].lower() in EXTS


def git(*args):
    subprocess.run(["git", *args], check=True)


def changed_paths():
    """Files touched by this push (empty when the previous commit is unknown)."""
    if not BEFORE or set(BEFORE) == {"0"}:
        return set()
    out = subprocess.run(["git", "diff", "--name-only", "-z", BEFORE, "HEAD"], capture_output=True, text=True)
    return set(filter(None, out.stdout.split("\0"))) if out.returncode == 0 else set()


def read_readme():
    """Return (head, titles, per-section row order, section order) from README.md.

    Rows found before any section come from the old single-table layout and
    are keyed by bare file name under the None section.
    """
    head, titles, order, sections = None, {}, {}, []
    if not os.path.exists(README):
        return head, titles, order, sections
    text = open(README, encoding="utf-8").read()
    if "\nTotal images:" in text:
        head = text.split("\nTotal images:")[0].rstrip()
    section, pending = None, None
    for line in text.splitlines():
        m = SECTION.match(line)
        if m:
            section, pending = html.unescape(m.group(1)), None
            sections.append(section)
            order.setdefault(section, [])
            continue
        m = ITEM.match(line)
        if m:
            pending = m.group(1)
            continue
        m = SRC.search(line) if pending is not None else None
        if m:
            key = unquote(m.group(1))
            titles[key] = pending
            order.setdefault(section, []).append(key)
            pending = None
            continue
        m = ROW.match(line)
        if m:
            name = m.group(2) or unquote(m.group(3))
            folder = "" if section in (None, ROOT) else section
            key = join(folder, name) if section else name
            titles[key] = m.group(1)
            order.setdefault(section, []).append(key)
    return head, titles, order, sections


def rename_media(folder, titles):
    """Give media files in folder URL-safe names; return (paths, {old: new})."""
    files = sorted(f for f in os.listdir(folder or ".") if os.path.isfile(join(folder, f)) and is_media(f))
    taken, renamed = set(files), {}
    for f in files:
        stem, ext = os.path.splitext(f)
        new = slugify(stem) + ext.lower()
        if new == f:
            continue
        base, n = os.path.splitext(new)[0], 2
        while new in taken:
            new = f"{base}-{n}{ext.lower()}"
            n += 1
        old_path, new_path = join(folder, f), join(folder, new)
        tracked = subprocess.run(["git", "ls-files", "--error-unmatch", old_path], capture_output=True).returncode == 0
        if tracked:
            git("mv", old_path, new_path)
        else:
            os.rename(old_path, new_path)
        print(f"renamed: {old_path} -> {new_path}")
        taken.discard(f)
        taken.add(new)
        renamed[old_path] = new_path
        titles.setdefault(new_path, titles.pop(old_path, None) or titles.get(f) or title_from(stem))
    return {join(folder, f) for f in taken}, renamed


def is_video(path):
    return os.path.splitext(path)[1].lower() in VIDEO_EXTS


def tag(path, title):
    """HTML tag that embeds the file from its direct raw URL."""
    src = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}/{quote(path)}"
    t = html.escape(title)
    if is_video(path):
        return f'<video src="{src}" title="{t}" controls></video>'
    return f'<img src="{src}" alt="{t}" title="{t}">'


def files_block(paths, titles):
    """A collapsible "copy all" code block, then one code block per file (GitHub adds copy buttons)."""
    named = [(p, titles.get(p) or titles.get(os.path.basename(p)) or title_from(os.path.splitext(os.path.basename(p))[0])) for p in paths]
    out = [
        "<details>",
        f"<summary>Copy all ({len(named)} tag{'' if len(named) == 1 else 's'})</summary>",
        "",
        "```html",
        *(tag(p, t) for p, t in named),
        "```",
        "",
        "</details>",
        "",
    ]
    for i, (p, t) in enumerate(named, 1):
        out += [f"**{i}. {t}** ({'Video' if is_video(p) else 'Image'})", "", "```html", tag(p, t), "```", ""]
    return out


def main():
    head, titles, order, sections = read_readme()
    changed = changed_paths()
    folders = sorted(d for d in os.listdir(".") if os.path.isdir(d) and not d.startswith("."))

    rows, touched = {}, set()
    for folder in ["", *folders]:
        section = folder or ROOT
        paths, renamed = rename_media(folder, titles)
        if not folder and not paths:
            continue
        changed |= {renamed[p] for p in changed if p in renamed}
        listed = [renamed.get(p, p) for p in order.get(section, [])]
        # Fall back to the old single-table order when this section has no rows yet.
        prev = listed or [renamed.get(p, p) for p in (join(folder, n) for n in order.get(None, []))]
        kept = [p for p in prev if p in paths and p not in changed]
        fresh = sorted((p for p in paths if p not in kept), key=sort_key)
        rows[section] = fresh + kept
        if fresh or set(listed) - paths or section not in sections:
            touched.add(section)

    known = [s for s in sections if s in rows]
    ordered = (
        sorted(s for s in touched if s not in sections)
        + [s for s in known if s in touched]
        + [s for s in known if s not in touched]
    )

    every = [p for s in ordered for p in rows[s]]
    videos = sum(is_video(p) for p in every)
    lines = [
        head or f"# {REPO.split('/')[-1]}\n\nWRTeam product images and videos, grouped by product folder.",
        "",
        f"Total images: {len(every) - videos} · Total videos: {videos} · Folders: {len(folders)}",
        "",
    ]
    for section in ordered:
        n = len(rows[section])
        lines += [
            "<details>",
            f"<summary><b>{html.escape(section)}</b> ({n} file{'' if n == 1 else 's'})</summary>",
            "",
            *(files_block(rows[section], titles) if n else ["_No files yet._", ""]),
            "</details>",
            "",
        ]
    with open(README, "w", encoding="utf-8") as fh:
        fh.write(stamp_year("\n".join(lines).rstrip() + "\n"))
    print(f"README.md lists {len(every)} files in {len(ordered)} sections")

    if os.path.exists(LICENSE):
        text = open(LICENSE, encoding="utf-8").read()
        with open(LICENSE, "w", encoding="utf-8") as fh:
            fh.write(stamp_year(text))


if __name__ == "__main__":
    sys.exit(main())
