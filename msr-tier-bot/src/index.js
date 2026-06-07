import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';

const TIERS = ['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5'];
const HOUSES = { blue: 'Blue', red: 'Red', yellow: 'Yellow', green: 'Green' };
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
    if (name === 'settier')            message = await setTier(env, opts.player, opts.mode, opts.tier);
    else if (name === 'removetier')    message = await removeTier(env, opts.player, opts.mode);
    else if (name === 'tierretire')    message = await retireTier(env, opts.player, opts.mode, true);
    else if (name === 'tierunretire')  message = await retireTier(env, opts.player, opts.mode, false);
    else if (name === 'testeradd')     message = await setFlag(env, opts.player, 'tester', true);
    else if (name === 'testerremove')  message = await setFlag(env, opts.player, 'tester', false);
    else if (name === 'premiumadd')    message = await setFlag(env, opts.player, 'premium', true);
    else if (name === 'premiumremove') message = await setFlag(env, opts.player, 'premium', false);
    else if (name === 'houseadd')      message = await setHouse(env, opts.player, opts.colour);
    else if (name === 'houseremove')   message = await removeHouse(env, opts.player, opts.colour);
    else                               message = `Unknown command: ${name}`;
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

// ---------- helpers ----------
// A tier is either "HT3" (active) or { tier:"HT3", retired:true, peak:true }
const codeOf = v => (typeof v === 'string') ? v : (v && v.tier);

// Resolve a mode id to its gamemode and which object it lives in.
// Main gamemodes -> player.tiers ; Subtier gamemodes -> player.subtiers
function findMode(data, mode) {
  let gm = (data.gamemodes || []).find(g => g.id === mode);
  if (gm) return { gm, key: 'tiers', sub: false };
  gm = (data.subgamemodes || []).find(g => g.id === mode);
  if (gm) return { gm, key: 'subtiers', sub: true };
  return null;
}

function findPlayer(data, player) {
  return data.players.find(x => x.name.toLowerCase() === player.toLowerCase());
}

// Whether a player has nothing left worth keeping (so it's safe to auto-remove)
function isEmptyPlayer(p) {
  const noTiers = !p.tiers || Object.keys(p.tiers).length === 0;
  const noSub   = !p.subtiers || Object.keys(p.subtiers).length === 0;
  const noBadges = !p.premium && !p.tester && !p.subtester && !p.house;
  return noTiers && noSub && noBadges;
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

// ---------- tier commands ----------
async function setTier(env, player, mode, tier) {
  if (!TIERS.includes(tier)) throw new Error(`Invalid tier "${tier}".`);
  const { data, sha } = await readData(env);
  const m = findMode(data, mode);
  if (!m) throw new Error(`Unknown gamemode "${mode}".`);

  let p = findPlayer(data, player);
  let added = false;
  if (!p) { p = { name: player, region: '', tiers: {} }; data.players.push(p); added = true; }
  if (!p[m.key]) p[m.key] = {};
  // setting a tier makes it active (clears any retired/peak state)
  p[m.key][mode] = tier;

  await writeData(env, data, sha, `tier: ${p.name} ${mode}=${tier}`);
  const tag = m.sub ? ' _(subtier)_' : '';
  return `\u2705 **${p.name}** set to **${tier}** in **${m.gm.name}**${tag}${added ? ' _(new player added)_' : ''}.\nThe site updates in ~1 minute.`;
}

async function removeTier(env, player, mode) {
  const { data, sha } = await readData(env);
  const m = findMode(data, mode);
  const gmName = m ? m.gm.name : mode;
  const p = findPlayer(data, player);
  if (!p) throw new Error(`Player "${player}" not found.`);
  const key = m ? m.key : 'tiers';
  if (!p[key] || !p[key][mode]) throw new Error(`${p.name} has no tier in ${gmName}.`);
  delete p[key][mode];

  let removed = false;
  if (isEmptyPlayer(p)) { data.players = data.players.filter(x => x !== p); removed = true; }
  await writeData(env, data, sha, `tier: remove ${p.name} ${mode}`);
  return `\ud83d\uddd1\ufe0f Removed **${p.name}**'s tier in **${gmName}**${removed ? ' _(nothing left \u2014 player removed)_' : ''}.\nThe site updates in ~1 minute.`;
}

// retire=true marks a tier retired; retire=false un-retires it
async function retireTier(env, player, mode, retire) {
  const { data, sha } = await readData(env);
  const m = findMode(data, mode);
  const gmName = m ? m.gm.name : mode;
  const key = m ? m.key : 'tiers';
  const p = findPlayer(data, player);
  if (!p) throw new Error(`Player "${player}" not found.`);

  const v = p[key] && p[key][mode];
  if (!v) throw new Error(`${p.name} has no tier in ${gmName}.`);
  const code = codeOf(v);
  const isRetired = (typeof v === 'object') && !!v.retired;

  if (retire) {
    if (isRetired) throw new Error(`${p.name}'s ${gmName} tier is already retired.`);
    const obj = (typeof v === 'string') ? { tier: v } : { ...v };
    obj.retired = true;
    p[key][mode] = obj;
    await writeData(env, data, sha, `tier: retire ${p.name} ${mode}`);
    return `\ud83d\uded1 **${p.name}**'s **${gmName}** tier (**${code}**) is now **retired**.\nThe site updates in ~1 minute.`;
  } else {
    if (!isRetired) throw new Error(`${p.name}'s ${gmName} tier isn't retired.`);
    const obj = { ...v };
    delete obj.retired;
    const leftover = Object.keys(obj).filter(k => k !== 'tier' && obj[k]);
    p[key][mode] = leftover.length ? obj : code;
    await writeData(env, data, sha, `tier: unretire ${p.name} ${mode}`);
    return `\u2705 **${p.name}**'s **${gmName}** tier (**${code}**) is **active** again.\nThe site updates in ~1 minute.`;
  }
}

// ---------- badge commands ----------
async function setFlag(env, player, flag, on) {
  const label = flag === 'tester' ? 'Tester' : 'Premium';
  const { data, sha } = await readData(env);
  let p = findPlayer(data, player);
  let added = false;
  if (!p) {
    if (!on) throw new Error(`Player "${player}" not found.`);
    p = { name: player, region: '', tiers: {} }; data.players.push(p); added = true;
  }
  if (on) {
    if (p[flag]) throw new Error(`${p.name} already has the ${label} badge.`);
    p[flag] = true;
    await writeData(env, data, sha, `badge: +${flag} ${p.name}`);
    return `\u2705 Gave the **${label}** badge to **${p.name}**${added ? ' _(new player added)_' : ''}.\nThe site updates in ~1 minute.`;
  } else {
    if (!p[flag]) throw new Error(`${p.name} doesn't have the ${label} badge.`);
    delete p[flag];
    let removed = false;
    if (isEmptyPlayer(p)) { data.players = data.players.filter(x => x !== p); removed = true; }
    await writeData(env, data, sha, `badge: -${flag} ${p.name}`);
    return `\ud83d\uddd1\ufe0f Removed the **${label}** badge from **${p.name}**${removed ? ' _(nothing left \u2014 player removed)_' : ''}.\nThe site updates in ~1 minute.`;
  }
}

async function setHouse(env, player, colour) {
  if (!HOUSES[colour]) throw new Error(`Unknown house "${colour}".`);
  const { data, sha } = await readData(env);
  let p = findPlayer(data, player);
  let added = false;
  if (!p) { p = { name: player, region: '', tiers: {} }; data.players.push(p); added = true; }
  const prev = p.house;
  p.house = colour; // one house at a time — this replaces any existing
  await writeData(env, data, sha, `house: ${p.name}=${colour}`);
  const moved = (prev && prev !== colour) ? ` _(moved from ${HOUSES[prev]} House)_` : '';
  return `\u2705 **${p.name}** is now in **${HOUSES[colour]} House**${moved}${added ? ' _(new player added)_' : ''}.\nThe site updates in ~1 minute.`;
}

async function removeHouse(env, player, colour) {
  const { data, sha } = await readData(env);
  const p = findPlayer(data, player);
  if (!p) throw new Error(`Player "${player}" not found.`);
  if (!p.house) throw new Error(`${p.name} isn't in a house.`);
  if (colour && p.house !== colour) {
    throw new Error(`${p.name} is in ${HOUSES[p.house]} House, not ${HOUSES[colour] || colour} House.`);
  }
  const was = HOUSES[p.house] || p.house;
  delete p.house;
  let removed = false;
  if (isEmptyPlayer(p)) { data.players = data.players.filter(x => x !== p); removed = true; }
  await writeData(env, data, sha, `house: remove ${p.name}`);
  return `\ud83d\uddd1\ufe0f Removed **${p.name}** from **${was} House**${removed ? ' _(nothing left \u2014 player removed)_' : ''}.\nThe site updates in ~1 minute.`;
}

// ---------- base64 (UTF-8 safe, so emoji / icon markup survive) ----------
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
