// Slash-command definitions for the MSR tier bot.
// After editing this file, re-run:  npm run register
const STRING = 3; // Discord option type for text

const TIER_CHOICES = ['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5']
  .map(t => ({ name: t, value: t }));

// Generated from your gamemodes. Add a line here if you add a new mode.
const MODE_CHOICES = [
  { name: "Sword", value: "sword" },
  { name: "Axe", value: "axe" },
  { name: "UHC", value: "uhc" },
  { name: "Mace", value: "mace" },
  { name: "Crystal", value: "crystal" },
  { name: "Diamond SMP", value: "dsmp" },
  { name: "Netherite SMP", value: "nsmp" },
  { name: "Diamond Pot", value: "dpot" },
  { name: "Netherite Pot", value: "npot" },
  { name: "Hybrid SMP", value: "hsmp" }
];

export const SETTIER_COMMAND = {
  name: 'settier',
  description: "Set or update a player's tier in a gamemode",
  options: [
    { name: 'player', description: 'Minecraft username', type: STRING, required: true },
    { name: 'mode',   description: 'Gamemode', type: STRING, required: true, choices: MODE_CHOICES },
    { name: 'tier',   description: 'Tier',     type: STRING, required: true, choices: TIER_CHOICES }
  ]
};

export const REMOVETIER_COMMAND = {
  name: 'removetier',
  description: "Remove a player's tier in a gamemode",
  options: [
    { name: 'player', description: 'Minecraft username', type: STRING, required: true },
    { name: 'mode',   description: 'Gamemode', type: STRING, required: true, choices: MODE_CHOICES }
  ]
};

export const COMMANDS = [SETTIER_COMMAND, REMOVETIER_COMMAND];
