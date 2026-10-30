"""Rename images to URL-safe names and rebuild the README image table.

Titles already in README.md are kept, so a title can be edited by hand.
New images get a title derived from their original file name.
"""
import os
import re
import subprocess
import sys

REPO = os.environ.get("REPO", "wrteam-vimal/eMarket-Images")
BRANCH = os.environ.get("BRANCH", "main")
README = "README.md"
EXTS = {".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".avif"}
ROW = re.compile(r"^\|\s*\d+\s*\|\s*(.*?)\s*\|\s*\[([^\]]+)\]")
SMALL = {"and", "or", "of", "for", "to", "the", "a", "an", "in", "on", "with"}


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


def sort_key(name):
    stem = os.path.splitext(name)[0]
    m = re.match(r"^(\d+(?:-\d+)*)-", stem)
    if not m:
        return (1, (), stem)
    nums = tuple(int(n) for n in m.group(1).split("-"))
    return (0, nums, stem[m.end():])


def git(*args):
    subprocess.run(["git", *args], check=True)


def main():
    titles, head = {}, None
    if os.path.exists(README):
        text = open(README, encoding="utf-8").read()
        head = text.split("\nTotal images:")[0].rstrip() if "\nTotal images:" in text else None
        for line in text.splitlines():
            m = ROW.match(line)
            if m:
                titles[m.group(2)] = m.group(1)

    files = sorted(f for f in os.listdir(".") if os.path.isfile(f) and os.path.splitext(f)[1].lower() in EXTS)
    taken = set(files)
    for f in files:
        stem, ext = os.path.splitext(f)
        new = slugify(stem) + ext.lower()
        if new == f:
            continue
        base, n = os.path.splitext(new)[0], 2
        while new in taken:
            new = f"{base}-{n}{ext.lower()}"
            n += 1
        tracked = subprocess.run(["git", "ls-files", "--error-unmatch", f], capture_output=True).returncode == 0
        if tracked:
            git("mv", f, new)
        else:
            os.rename(f, new)
        print(f"renamed: {f} -> {new}")
        taken.discard(f)
        taken.add(new)
        titles.setdefault(new, titles.pop(f, None) or title_from(stem))

    images = sorted(taken, key=sort_key)
    lines = [
        head or f"# {REPO.split('/')[-1]}\n\neMarket platform feature and asset images.",
        "",
        f"Total images: {len(images)}",
        "",
        "| # | Image | GitHub Link | Direct (Raw) Link |",
        "|---|---|---|---|",
    ]
    for i, name in enumerate(images, 1):
        title = titles.get(name) or title_from(os.path.splitext(name)[0])
        lines.append(
            f"| {i} | {title} | [{name}](https://github.com/{REPO}/blob/{BRANCH}/{name}) "
            f"| https://raw.githubusercontent.com/{REPO}/{BRANCH}/{name} |"
        )
    with open(README, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    print(f"README.md lists {len(images)} images")


if __name__ == "__main__":
    sys.exit(main())
