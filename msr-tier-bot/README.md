# MSR Tier Bot

A serverless Discord bot (Cloudflare Worker) that updates your tier list's
`data.json` on GitHub when you run `/settier` or `/removetier`. GitHub Pages
then redeploys automatically, so the live site updates within ~1 minute.

```
Discord  →  this Worker  →  commits data.json on GitHub  →  GitHub Pages  →  site updated
```

## What you need (you already made the first two)
- A Discord application (you have its **Public Key** and **Application ID**, and a **Bot token**).
- A fine-grained **GitHub token** with *Contents: Read and write* on your site repo.
- A free **Cloudflare** account (for Workers).
- **Node.js** installed locally (for the one-time command registration).

## One-time setup

### 1. Point the bot at your repo
Edit **`wrangler.toml`** → set `GH_REPO` to `your-username/your-repo`
(and `GH_BRANCH` if your Pages branch isn't `main`).

### 2. Install + deploy the Worker
```bash
cd msr-tier-bot
npm install
npx wrangler login                      # opens browser, log into Cloudflare
npx wrangler secret put DISCORD_PUBLIC_KEY   # paste your app's Public Key
npx wrangler secret put GH_TOKEN             # paste your GitHub token
npm run deploy
```
Copy the deployed URL it prints, e.g. `https://msr-tier-bot.<you>.workers.dev`.

### 3. Connect the URL to Discord
Discord Developer Portal → your app → **General Information** →
**Interactions Endpoint URL** → paste the Worker URL → **Save**.
(Discord sends a signed test ping; if it saves, the Worker verified correctly.)

### 4. Register the slash commands
Use your **server ID** for instant availability (enable Developer Mode in
Discord, right-click your server → Copy Server ID):
```bash
DISCORD_TOKEN=your_bot_token \
DISCORD_APP_ID=your_application_id \
DISCORD_GUILD_ID=your_server_id \
npm run register
```
On Windows PowerShell:
```powershell
$env:DISCORD_TOKEN="..."; $env:DISCORD_APP_ID="..."; $env:DISCORD_GUILD_ID="..."; npm run register
```

### 5. Lock the commands down (recommended)
Server Settings → Integrations → your app → restrict `/settier` and
`/removetier` to your tester role so only staff can edit rankings.

## Daily use
```
/settier player:xqste mode:Sword tier:HT1
/removetier player:xqste mode:Sword
```
- Unknown player on `/settier` → they're added automatically.
- Removing a player's last tier → the player is removed.
- The reply confirms the change; the site reflects it within ~1 minute.

## Adding a new gamemode
1. Add it to `data.json` `gamemodes` (and the website tab appears automatically).
2. Add the same `{ name, value }` to `MODE_CHOICES` in `src/commands.js`.
3. Re-run `npm run register`.

## Notes
- Secrets (`GH_TOKEN`, `DISCORD_PUBLIC_KEY`) live only in Cloudflare — never commit them.
- If two people edit at the exact same second, one commit may fail with a
  conflict; just re-run the command.
- Every change is a Git commit, so you can roll back any bad edit from GitHub.
