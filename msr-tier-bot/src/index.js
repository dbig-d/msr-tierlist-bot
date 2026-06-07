import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';

const TIERS = ['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5'];
const GH = 'https://api.github.com';

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'GET') return new Response('MSR tier bot is running.');
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    // 1) Verify the request really came from Discord
    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    const body = await request.text();
    const valid = signature && timestamp &&
      await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
    if (!valid) return new Response('Bad request signature', { status: 401 });

    const interaction = JSON.parse(body);

    // 2) Discord's verification ping
    if (interaction.type === InteractionType.PING) {
      return json({ type: InteractionResponseType.PONG });
    }

    // 3) A slash command: ack within 3s, then do the GitHub commit in the background
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      ctx.waitUntil(handleCommand(interaction, env));
      return json({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
    }

    return new Response('Unhandled interaction type', { status: 400 });
  }
};

function json(obj) {
  return new Response(JSON.stringify(obj), { headers: { 'Content-Type': 'application/json' } });
}

async function handleCommand(interaction, env) {
  const name = interaction.data.name;
  const opts = Object.fromEntries((interaction.data.options || []).map(o => [o.name, o.value]));
  let message;
  try {
    if (name === 'settier')         message = await setTier(env, opts.player, opts.mode, opts.tier);
    else if (name === 'removetier') message = await removeTier(env, opts.player, opts.mode);
    else                            message = `Unknown command: ${name}`;
  } catch (err) {
    message = `\u274c ${err.message}`;
  }
  await editReply(interaction, message);
}

// Replace the "thinking..." deferred message with the result
async function editReply(interaction, content) {
  const url = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
}

// ---------- GitHub: read & write data.json ----------
function ghHeaders(env) {
  return {
    Authorization: `Bearer ${env.GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'msr-tier-bot'
  };
}

async function readData(env) {
  const url = `${GH}/repos/${env.GH_REPO}/contents/${env.DATA_PATH}?ref=${env.GH_BRANCH}`;
  const res = await fetch(url, { headers: ghHeaders(env) });
  if (!res.ok) throw new Error(`Couldn't read data.json (GitHub ${res.status}).`);
  const file = await res.json();
  return { data: JSON.parse(b64decode(file.content)), sha: file.sha };
}

async function writeData(env, data, sha, message) {
  const url = `${GH}/repos/${env.GH_REPO}/contents/${env.DATA_PATH}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: ghHeaders(env),
    body: JSON.stringify({
      message,
      content: b64encode(JSON.stringify(data, null, 2) + '\n'),
      sha,
      branch: env.GH_BRANCH
    })
  });
  if (!res.ok) throw new Error(`Couldn't save data.json (GitHub ${res.status}).`);
}

// ---------- command logic ----------
async function setTier(env, player, mode, tier) {
  if (!TIERS.includes(tier)) throw new Error(`Invalid tier "${tier}".`);
  const { data, sha } = await readData(env);
  const gm = data.gamemodes.find(g => g.id === mode);
  if (!gm) throw new Error(`Unknown gamemode "${mode}".`);

  let p = data.players.find(x => x.name.toLowerCase() === player.toLowerCase());
  let added = false;
  if (!p) { p = { name: player, region: '', tiers: {} }; data.players.push(p); added = true; }
  p.tiers[mode] = tier;

  await writeData(env, data, sha, `tier: ${p.name} ${mode}=${tier}`);
  return `\u2705 **${p.name}** set to **${tier}** in **${gm.name}**${added ? ' _(new player added)_' : ''}.\nThe site updates in ~1 minute.`;
}

async function removeTier(env, player, mode) {
  const { data, sha } = await readData(env);
  const gm = data.gamemodes.find(g => g.id === mode);
  const p = data.players.find(x => x.name.toLowerCase() === player.toLowerCase());
  if (!p) throw new Error(`Player "${player}" not found.`);
  if (!p.tiers[mode]) throw new Error(`${p.name} has no tier in ${gm ? gm.name : mode}.`);
  delete p.tiers[mode];

  let removed = false;
  if (Object.keys(p.tiers).length === 0) {
    data.players = data.players.filter(x => x !== p);
    removed = true;
  }
  await writeData(env, data, sha, `tier: remove ${p.name} ${mode}`);
  return `\U0001f5d1\ufe0f Removed **${p.name}**'s tier in **${gm ? gm.name : mode}**${removed ? ' _(no tiers left — player removed)_' : ''}.\nThe site updates in ~1 minute.`;
}

// ---------- base64 (UTF-8 safe, so emoji in gamemode names survive) ----------
function b64decode(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin);
}
