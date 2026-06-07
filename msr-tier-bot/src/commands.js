// Slash-command definitions for the MSR tier bot.
// After editing this file, re-run:  npm run register
const STRING = 3; // Discord option type for text

const TIER_CHOICES = ['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5']
  .map(t => ({ name: t, value: t }));

// Main gamemodes + Subtier gamemodes. Subtier modes are written to a player's
// separate `subtiers` object (they don't count toward points or the overall tab).
// Add a line here if you add a new mode, then re-run `npm run register`.
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
  { name: "Hybrid SMP", value: "hsmp" },
  { name: "Cart (Subtier)", value: "cart" },
  { name: "Pearl Fight (Subtier)", value: "pearl" },
  { name: "Fireball (Subtier)", value: "fireball" },
  { name: "Creeper (Subtier)", value: "creeper" },
  { name: "Spleef (Subtier)", value: "spleef" },
  { name: "Spear Mace (Subtier)", value: "spearmace" }
];

const HOUSE_CHOICES = [
  { name: "Blue", value: "blue" },
  { name: "Red", value: "red" },
  { name: "Yellow", value: "yellow" },
  { name: "Green", value: "green" }
];

const PLAYER_OPT = { name: 'player', description: 'Minecraft username', type: STRING, required: true };
const MODE_OPT   = { name: 'mode',   description: 'Gamemode (incl. subtiers)', type: STRING, required: true, choices: MODE_CHOICES };

export const SETTIER_COMMAND = {
  name: 'settier',
  description: "Set or update a player's tier in a gamemode (main or subtier)",
  options: [
    PLAYER_OPT,
    MODE_OPT,
    { name: 'tier', description: 'Tier', type: STRING, required: true, choices: TIER_CHOICES }
  ]
};

export const REMOVETIER_COMMAND = {
  name: 'removetier',
  description: "Remove a player's tier in a gamemode (main or subtier)",
  options: [ PLAYER_OPT, MODE_OPT ]
};

export const TIERRETIRE_COMMAND = {
  name: 'tierretire',
  description: "Mark a player's tier in a gamemode as retired (grayed out)",
  options: [ PLAYER_OPT, MODE_OPT ]
};

export const TIERUNRETIRE_COMMAND = {
  name: 'tierunretire',
  description: "Un-retire a player's tier in a gamemode (make it active again)",
  options: [ PLAYER_OPT, MODE_OPT ]
};

export const TESTERADD_COMMAND = {
  name: 'testeradd',
  description: "Give a player the Tester badge",
  options: [ PLAYER_OPT ]
};

export const TESTERREMOVE_COMMAND = {
  name: 'testerremove',
  description: "Remove a player's Tester badge",
  options: [ PLAYER_OPT ]
};

export const PREMIUMADD_COMMAND = {
  name: 'premiumadd',
  description: "Give a player the Premium badge",
  options: [ PLAYER_OPT ]
};

export const PREMIUMREMOVE_COMMAND = {
  name: 'premiumremove',
  description: "Remove a player's Premium badge",
  options: [ PLAYER_OPT ]
};

export const HOUSEADD_COMMAND = {
  name: 'houseadd',
  description: "Put a player in a House (replaces any current house)",
  options: [ PLAYER_OPT, { name: 'colour', description: 'House', type: STRING, required: true, choices: HOUSE_CHOICES } ]
};

export const HOUSEREMOVE_COMMAND = {
  name: 'houseremove',
  description: "Remove a player from their House",
  options: [ PLAYER_OPT, { name: 'colour', description: 'House (optional — must match if given)', type: STRING, required: false, choices: HOUSE_CHOICES } ]
};

export const COMMANDS = [
  SETTIER_COMMAND,
  REMOVETIER_COMMAND,
  TIERRETIRE_COMMAND,
  TIERUNRETIRE_COMMAND,
  TESTERADD_COMMAND,
  TESTERREMOVE_COMMAND,
  PREMIUMADD_COMMAND,
  PREMIUMREMOVE_COMMAND,
  HOUSEADD_COMMAND,
  HOUSEREMOVE_COMMAND
];
