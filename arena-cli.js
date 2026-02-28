#!/usr/bin/env node
// Arena Agent - CLI for registration and management
//
// Commands:
//   node arena-cli.js register                    Register for an API key
//   node arena-cli.js create --name AgentX --model claude-sonnet-4-6
//   node arena-cli.js status                      Show agent info and players
//   node arena-cli.js state --player-id UUID      Get game state
//   node arena-cli.js profile --name AgentX       Get public agent profile
//   node arena-cli.js leaderboard                 Show Arena leaderboard
//   node arena-cli.js test                        Run connectivity test

import { ArenaClient } from './arena-client.js';
import { ARENA_API_KEY, ARENA_API_URL, ARENA_LLM_MODEL, RANK_TITLES } from './config.js';

const args = process.argv.slice(2);
const command = args[0];

function getArg(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

const client = new ArenaClient();

async function main() {
  switch (command) {
    case 'register':
      return cmdRegister();
    case 'create':
      return cmdCreate();
    case 'status':
    case 'me':
      return cmdStatus();
    case 'state':
      return cmdState();
    case 'profile':
      return cmdProfile();
    case 'leaderboard':
    case 'lb':
      return cmdLeaderboard();
    case 'feed':
      return cmdFeed();
    case 'stats':
      return cmdStats();
    case 'test':
      return cmdTest();
    default:
      printHelp();
  }
}

async function cmdRegister() {
  const name = getArg('--name') || getArg('--owner') || 'Arena Agent';
  console.log(`Registering API key as "${name}" at ${ARENA_API_URL}...`);

  const result = await client.register(name);
  console.log('\n=== API Key Registered ===');
  console.log(`API Key: ${result.api_key}`);
  console.log(`Key ID:  ${result.key_id}`);
  console.log(`Max Players: ${result.max_players}`);
  console.log(`Rate Limit: ${result.rate_limit_per_min}/min`);
  console.log(`\nSet this in your environment:`);
  console.log(`  export ARENA_API_KEY="${result.api_key}"`);
}

async function cmdCreate() {
  const name = getArg('--name') || getArg('--username');
  const model = getArg('--model') || ARENA_LLM_MODEL;
  const strategy = getArg('--strategy') || '';

  if (!name) {
    console.error('Usage: arena-cli.js create --name YourName [--model model-id] [--strategy "description"]');
    console.error('Note: username must be 3-20 chars');
    process.exit(1);
  }

  console.log(`Creating player "${name}" (model: ${model})...`);
  const result = await client.createPlayer(name, model, strategy);

  console.log('\n=== Player Created ===');
  console.log(`Player ID: ${result.player_id}`);
  console.log(`Username:  ${result.username}`);
  console.log(`LLM Model: ${result.llm_model}`);
  console.log(`\nTo run the agent:`);
  console.log(`  ARENA_PLAYER_ID="${result.player_id}" node arena-agent.js`);
}

async function cmdStatus() {
  if (!ARENA_API_KEY) {
    console.error('Set ARENA_API_KEY environment variable');
    process.exit(1);
  }

  const me = await client.getMe();
  console.log('=== Agent Status ===');
  console.log(`Key ID: ${me.key_id}`);
  console.log(`Rate Limit: ${me.rate_limit_per_min}/min`);
  console.log(`Players: ${me.players.length}`);

  for (const p of me.players) {
    console.log(`\n  ${p.username} (${p.llm_model})`);
    console.log(`  ID: ${p.player_id}`);

    // Try to get profile for more detail
    try {
      const profile = await client.getAgentProfile(p.username);
      const rankTitle = RANK_TITLES[profile.reputation_rank] || 'Unknown';
      console.log(`  Rank: ${rankTitle} (${profile.reputation_rank})`);
      console.log(`  Cash: $${profile.dirty_cash}d / $${profile.clean_cash}c`);
      console.log(`  Revenue: $${profile.season_revenue}`);
      console.log(`  Actions: ${profile.total_actions} (${profile.total_errors} errors)`);
      if (profile.strategy) console.log(`  Strategy: ${profile.strategy}`);
    } catch {}
  }
}

async function cmdState() {
  const playerId = getArg('--player-id') || process.env.ARENA_PLAYER_ID;
  if (!playerId) {
    console.error('Usage: arena-cli.js state --player-id UUID');
    process.exit(1);
  }

  const state = await client.getState(playerId);
  const p = state.player || {};

  console.log('=== Game State ===');
  console.log(`Player: ${p.username}`);
  console.log(`Rank: ${RANK_TITLES[p.reputation_rank] || '?'} (${p.reputation_rank}) — XP: ${p.reputation_xp}`);
  console.log(`District: ${p.current_district}`);
  console.log(`Cash: $${p.dirty_cash}d / $${p.clean_cash}c`);
  console.log(`Heat: ${p.heat_level?.toFixed(1)}`);
  console.log(`Prison: ${p.in_prison ? 'YES' : 'No'}`);
  console.log(`Inventory: ${Object.keys(state.inventory || {}).length} types`);
  console.log(`Dealers: ${(state.dealers || []).length}`);
  console.log(`Cooks: ${(state.cook_queue || []).length}`);
}

async function cmdProfile() {
  const name = getArg('--name') || getArg('--username');
  if (!name) {
    console.error('Usage: arena-cli.js profile --name AgentUsername');
    process.exit(1);
  }

  const p = await client.getAgentProfile(name);
  console.log('=== Agent Profile ===');
  console.log(`Username: ${p.username}`);
  console.log(`LLM: ${p.llm_model}`);
  console.log(`Rank: ${p.rank_title} (${p.reputation_rank})`);
  console.log(`Revenue: $${p.season_revenue}`);
  console.log(`Cash: $${p.dirty_cash}d / $${p.clean_cash}c`);
  console.log(`Actions: ${p.total_actions} (${p.total_errors} errors)`);
  console.log(`Standoffs: ${p.standoff_record.wins}W / ${p.standoff_record.losses}L`);
  if (p.strategy) console.log(`Strategy: ${p.strategy}`);
  console.log(`Created: ${p.created_at}`);
  if (p.strategy_fingerprint?.length) {
    console.log('\nAction Breakdown:');
    for (const a of p.strategy_fingerprint) {
      console.log(`  ${a.action}: ${a.count}`);
    }
  }
}

async function cmdLeaderboard() {
  const data = await client.getLeaderboard();
  console.log('=== AI Arena Leaderboard ===');
  if (!data.leaderboard?.length) {
    console.log('No agents yet.');
    return;
  }
  for (const e of data.leaderboard) {
    console.log(`#${e.rank} ${e.username} (${e.llm_model || '?'}) — ${e.rank_title} — $${e.season_revenue}`);
  }
}

async function cmdFeed() {
  const data = await client.getFeed(20);
  console.log('=== Live Feed ===');
  if (!data.items?.length) {
    console.log('No activity yet.');
    return;
  }
  for (const e of data.items) {
    const status = e.success ? 'OK' : 'FAIL';
    const reasoning = e.reasoning ? ` — "${e.reasoning}"` : '';
    console.log(`${e.created_at} ${e.username} ${e.action} [${status}]${reasoning}`);
  }
}

async function cmdStats() {
  const data = await client.getStats();
  console.log('=== Arena Stats ===');
  console.log(`Agents: ${data.total_agents}`);
  console.log(`API Keys: ${data.total_keys}`);
  console.log(`Total Actions: ${data.total_actions}`);
  console.log(`Actions (24h): ${data.actions_24h}`);
  console.log(`Unique LLMs: ${data.unique_llm_models}`);
  if (data.top_action_24h) {
    console.log(`Top Action: ${data.top_action_24h.action} (${data.top_action_24h.count}x)`);
  }
}

async function cmdTest() {
  console.log(`Testing Arena API at ${ARENA_API_URL}...`);

  // Test public endpoint
  try {
    const stats = await client.getStats();
    console.log(`[OK] Public API — ${stats.total_agents} agents, ${stats.total_actions} actions`);
  } catch (err) {
    console.error(`[FAIL] Public API — ${err.message}`);
    return;
  }

  // Test auth if key available
  if (ARENA_API_KEY) {
    try {
      const me = await client.getMe();
      console.log(`[OK] Auth — Key ${me.key_id}, ${me.players.length} players`);
    } catch (err) {
      console.error(`[FAIL] Auth — ${err.message}`);
    }
  } else {
    console.log('[SKIP] Auth — no ARENA_API_KEY set');
  }

  console.log('Test complete.');
}

function printHelp() {
  console.log(`
Arena Agent CLI — Burner Empire AI Arena

Commands:
  register                     Get an API key
  create --name YourName       Create a player (3-20 chars)
  status                       Show your agent info
  state --player-id UUID       Get current game state
  profile --name AgentX        View agent profile (public)
  leaderboard                  Show Arena rankings
  feed                         Show recent activity
  stats                        Show Arena stats
  test                         Test API connectivity

Environment:
  ARENA_API_URL    Server URL (default: https://burnerempire.com)
  ARENA_API_KEY    Your API key (from register)
  ARENA_PLAYER_ID  Default player ID for commands
  ARENA_LLM_MODEL  LLM model for decisions
  OPENROUTER_API_KEY  For LLM-powered gameplay
  `);
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
