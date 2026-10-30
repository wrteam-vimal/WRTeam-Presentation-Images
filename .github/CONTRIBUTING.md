# How to use this repo

Images and videos for WRTeam products, one folder per product. The [README](../README.md) lists every file with a ready-to-paste `<img>` tag.

> [!IMPORTANT]
> For authorised WRTeam members only. See [LICENSE](../LICENSE).

## Copy an image tag

**Easiest: the [Browse page](https://wrteam-vimal.github.io/WRTeam-Presentation-Images/).** Pick a product tab, then click **Copy** on a card or **Copy all** for the whole product. Search finds files across all products.

**Or in the README:**

1. Open the [README](../README.md#folders) and click a product name to expand it. Recently changed products are listed first.
2. Click the copy button at the top-right of a code block to copy that file's tag.
3. To copy every tag in a product at once, open **Copy all** and use its copy button.
4. Click **View** next to a title to see the image before copying.

Each tag looks like this, with the file's title used for `alt` and `title`:

```html
<img src="https://raw.githubusercontent.com/wrteam-vimal/WRTeam-Presentation-Images/main/eMarket/04-payment-method.webp" alt="Payment Method" title="Payment Method">
```

## Add images

**On GitHub (easiest)**

1. Open the product folder, for example [`eMarket`](../eMarket).
2. Click **Add file → Upload files** and drop your files.
3. Leave **Commit directly to the `main` branch** selected and click **Commit changes**.

**With git**

```bash
git pull
cp ~/Downloads/new-feature.webp "eMarket/"
git add -A && git commit -m "Add new-feature to eMarket" && git push
```

About a minute later the README updates itself: the new file is at the top of its product, and that product moves to the top of the list. You can follow progress in the **Actions** tab.

### Supported files

| Type | Formats |
|---|---|
| Images | `webp`, `png`, `jpg`, `jpeg`, `gif`, `svg`, `avif` |
| Videos | `mp4`, `webm`, `mov`, `m4v` |

- GitHub's web upload takes files up to **25 MB** each; git accepts up to **100 MB**. Prefer `webp` to keep pages fast.
- Videos get a `<video controls>` tag instead of `<img>`.

### Naming tips

- The file name becomes the title: `Live Order Tracking.webp` is renamed to `live-order-tracking.webp` with the title **Live Order Tracking**.
- Leading numbers are dropped from the title, so `26-live-order-tracking.webp` is still titled **Live Order Tracking**.
- Renaming happens automatically. Spaces, capitals and symbols are fine to upload.

## Manage products and files

| Task | How |
|---|---|
| **Add a product** | Create a folder with at least one file. Git can't store empty folders, so add a `.gitkeep` if you have no images yet. It gets its own section in the README automatically. |
| **Change a title** | Edit the bold `N. Title` line in the README and commit. The tags and **Copy all** update on the next push. |
| **Move or rename a file** | Move or rename it on GitHub or with git. Its old link stops working, so update any page that uses it. |
| **Delete a file** | Delete it on GitHub or with git. It disappears from the README on the next update. |

> [!WARNING]
> Links change when a file is moved, renamed or deleted, and old links return 404. Check before changing files that are already used on a website or in an app.

## Troubleshooting

- **The README didn't update.** Open the **Actions** tab and check the latest *Update image links* run. A red ❌ means it failed; open it to see why.
- **My file isn't listed.** Check it's one of the supported formats and sits inside a product folder, not in a subfolder of one.
- **A title looks wrong.** Fix the bold `N. Title` line in the README; your edit is kept.
