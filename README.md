# Tower Tycoon

A pixel-art business tycoon game. Open shops in your tower floor by floor, hire and look after your staff, keep customers happy, trade stocks and buy land in new districts.

It comes in two versions that share the same game code:

| Folder | What it is |
|---|---|
| `web/` | The website version. Hosted on Render as a static site. |
| `extension/` | The Chrome extension version. |

## Play on the web

The site is deployed from this repo by Render using `render.yaml`. Your progress saves in the browser you play in.

## Move your company between versions

1. In the game you're leaving, open **⚙ Settings → Move your company → Get my save code**.
2. Click **Copy code** (or **Download as file**).
3. In the other version, open **⚙ Settings → Load a save**, paste the code (or choose the file), and click **Load this save** twice to confirm.

Everything comes with you: cash, towers, staff, stocks and rank. The same steps move a save to another browser or device.

## Deploy to Render (one time)

1. Sign in at [render.com](https://render.com) with GitHub.
2. Click **New → Blueprint** and pick this repository.
3. Render reads `render.yaml` and creates a static site. Click **Apply**.
4. When it finishes you get a `*.onrender.com` link. Every push to `main` redeploys automatically.

## Install the Chrome extension

1. Go to `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick the `extension/` folder.

## Changing the game

Edit the files in `web/`, then run `./sync-extension.sh` to copy the shared files into `extension/`.
