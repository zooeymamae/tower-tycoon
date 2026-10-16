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

## Accounts (play one company on every device)

Players can make an account in **⚙ Settings → Account** with a username (or email) and password. Their company then saves to the cloud every minute and whenever they close the game, and signing in on another device picks it up. If two devices both played, the game asks which company to keep instead of overwriting one.

Accounts use a free Firebase project (Authentication + Cloud Firestore on the free Spark plan). Until it's set up, the Account section just says accounts aren't switched on, and save codes still work.

### Turn on accounts (one time, about 5 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com), click **Create a project**, name it (e.g. `tower-tycoon`) and finish. Google Analytics isn't needed.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.**
3. **Build → Firestore Database → Create database.** Pick any location, start in **production mode**.
4. In Firestore, open the **Rules** tab, replace everything with the contents of [`firestore.rules`](firestore.rules), and click **Publish**.
5. **Project settings (gear icon) → General.** Under "Your apps" click the **web icon `</>`**, give it a nickname, and register it (no hosting needed). Copy `apiKey` and `projectId` from the config it shows.
6. Paste them into `web/cloud-config.js`, run `./sync-extension.sh`, and push. Render redeploys the website; reload the extension in `chrome://extensions`.

These two values are meant to be public. The Firestore rules are what keep each player's save private.

## Deploy to Render (one time)

1. Sign in at [render.com](https://render.com) with GitHub.
2. Click **New → Blueprint** and pick this repository.
3. Render reads `render.yaml` and creates a static site. Click **Apply**.
4. When it finishes you get a `*.onrender.com` link. Every push to `main` redeploys automatically.

## Install the Chrome extension

1. Go to `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick the `extension/` folder.

## Changing the game

Edit the files in `web/`, then run `./sync-extension.sh` to copy the shared files (including `cloud-config.js`) into `extension/`.
