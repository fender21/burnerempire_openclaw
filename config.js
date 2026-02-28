// Arena Agent - Configuration
// REST API client for Burner Empire AI Arena

export const ARENA_API_URL = process.env.ARENA_API_URL || 'https://burnerempire.com';
export const ARENA_API_KEY = process.env.ARENA_API_KEY || '';

// LLM
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
export const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
export const ARENA_LLM_MODEL = process.env.ARENA_LLM_MODEL || 'qwen/qwen3-32b';
export const LLM_MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS || '2048');
export const LLM_TEMPERATURE = parseFloat(process.env.LLM_TEMPERATURE || '0.4');

// Timing
export const TICK_INTERVAL_MS = parseInt(process.env.ARENA_TICK_MS || '8000');   // 8s between decisions
export const POLL_NOTIFICATIONS_MS = parseInt(process.env.ARENA_POLL_MS || '5000');

// Logging
export const LOGS_DIR = new URL('./logs/', import.meta.url).pathname;

// Game constants (mirrors server/src/constants.rs)
export const RANK_TITLES = [
  'Street Rat', 'Corner Hustler', 'Block Runner', 'Shot Caller',
  'Lieutenant', 'Underboss', 'Kingpin', 'Cartel Boss',
];

export const DISTRICTS = [
  'downtown', 'eastside', 'the_docks', 'college',
  'the_strip', 'industrial', 'southside', 'uptown',
];

export const DRUGS = ['weed', 'coke', 'meth', 'heroin', 'pills'];

export const DRUG_RANK_REQ = { weed: 0, pills: 1, meth: 2, coke: 3, heroin: 4 };

export const DRUG_PRECURSOR_COST = { weed: 100, pills: 250, meth: 350, coke: 500, heroin: 700 };

export const DRUG_BASE_YIELD = { weed: 12, coke: 5, meth: 8, heroin: 4, pills: 12 };

export const DRUG_BASE_PRICE = { weed: 50, coke: 200, meth: 150, heroin: 300, pills: 100 };

export const QUALITY_TIERS = ['cut', 'standard', 'pure'];

export const GEAR_CATALOG = [
  { type: 'brass_knuckles', name: 'Brass Knuckles', slot: 'weapon', cost: 500, atk: 10, def: 0, consumable: true, special: 'press_double' },
  { type: 'switchblade', name: 'Switchblade', slot: 'weapon', cost: 1500, atk: 5, def: 2, consumable: false },
  { type: 'piece', name: 'Burner Piece', slot: 'weapon', cost: 3000, atk: 8, def: 0, consumable: false, special: 'win_ties' },
  { type: 'leather_jacket', name: 'Leather Jacket', slot: 'protection', cost: 400, atk: 0, def: 6, consumable: false },
  { type: 'kevlar_vest', name: 'Kevlar Vest', slot: 'protection', cost: 2000, atk: 0, def: 12, consumable: true, special: 'survive_loss' },
  { type: 'plated_carrier', name: 'Plated Carrier', slot: 'protection', cost: 5000, atk: 0, def: 15, consumable: true, special: 'survive_loss' },
];

// Heat
export const HEAT_MAX = 100;
export const BUST_CHECK_MIN_HEAT = 25.0;
export const BRIBE_BASE_COST = 500;
export const BRIBE_COST_PER_HEAT = 50;

// PvP
export const PVP_MIN_RANK = 2;
export const STANDOFF_MAX_ROUNDS = 5;
