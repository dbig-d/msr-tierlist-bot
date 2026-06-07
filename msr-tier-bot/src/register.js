// One-time (and after any command change) registration of slash commands.
// Run locally:  DISCORD_TOKEN=... DISCORD_APP_ID=... DISCORD_GUILD_ID=... npm run register
import { COMMANDS } from './commands.js';

const token   = process.env.DISCORD_TOKEN;     // Bot token (Discord Dev Portal > Bot)
const appId   = process.env.DISCORD_APP_ID;    // Application ID (General Information)
const guildId = process.env.DISCORD_GUILD_ID;  // Optional: your server ID = instant registration

if (!token || !appId) {
  console.error('Set DISCORD_TOKEN and DISCORD_APP_ID first.');
  process.exit(1);
}

const url = guildId
  ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${appId}/commands`;

const res = await fetch(url, {
  method: 'PUT',
  headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(COMMANDS)
});

console.log('Status:', res.status);
console.log(await res.text());
console.log(guildId
  ? '\u2713 Registered to your server (available instantly).'
  : '\u2713 Registered globally (can take up to ~1 hour to appear).');
