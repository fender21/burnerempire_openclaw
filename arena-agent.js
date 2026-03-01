#!/usr/bin/env node
// Arena Agent - Autonomous AI Player for Burner Empire
// Plays the game via REST API with LLM-driven decision-making
//
// Usage:
//   ARENA_API_KEY=arena_xxx OPENROUTER_API_KEY=xxx node arena-agent.js [--player-id UUID] [--duration 30m]
//
// The agent loops: get state → ask LLM → execute action → check notifications → repeat

import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ArenaClient } from './arena-client.js';
import { LLMClient } from './llm.js';
import {
  ARENA_API_KEY, ARENA_LLM_MODEL, TICK_INTERVAL_MS, LOGS_DIR,
  RANK_TITLES, DISTRICTS, DRUGS, DRUG_RANK_REQ, DRUG_PRECURSOR_COST,
  DRUG_BASE_PRICE, QUALITY_TIERS, GEAR_CATALOG, HEAT_MAX, PVP_MIN_RANK,
} from './config.js';

// ── Parse CLI args ──────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

const PLAYER_ID = getArg('--player-id') || process.env.ARENA_PLAYER_ID;
const DURATION_STR = getArg('--duration') || process.env.ARENA_DURATION || '30m';

function parseDuration(s) {
  const m = s.match(/^(\d+)(s|m|h)$/);
  if (!m) return 30 * 60 * 1000;
  const n = parseInt(m[1]);
  return n * ({ s: 1000, m: 60000, h: 3600000 }[m[2]]);
}
const DURATION_MS = parseDuration(DURATION_STR);

// ── Logger ──────────────────────────────────────────────────────────────

function log(level, msg, data = null) {
  const entry = { t: new Date().toISOString(), level, msg };
  if (data) entry.data = data;
  const line = JSON.stringify(entry);
  console.log(`[${level.toUpperCase()}] ${msg}`);
  try {
    mkdirSync(LOGS_DIR, { recursive: true });
    appendFileSync(join(LOGS_DIR, 'agent.jsonl'), line + '\n');
  } catch {}
}

// ── System prompt builder ───────────────────────────────────────────────

function buildSystemPrompt(state) {
  const player = state.player || {};
  const rank = player.reputation_rank || 0;
  const rankTitle = RANK_TITLES[rank] || 'Unknown';

  // Available drugs for this rank
  const availableDrugs = DRUGS.filter(d => DRUG_RANK_REQ[d] <= rank);

  // Inventory summary (format: {"weed_standard": 10, "pills_pure": 5})
  const inv = state.inventory || {};
  const inventory = Object.keys(inv).length > 0
    ? Object.entries(inv).map(([k, v]) => `${v}x ${k.replace('_', ' ')}`).join(', ')
    : 'empty';

  // Dealer summary (include UUIDs and clear status)
  const dealers = (state.dealers || [])
    .map(d => {
      const parts = [`[${d.id}] ${d.name}: ${d.status.toUpperCase()}`];
      if (d.district) parts.push(`@ ${d.district}`);
      if (d.assigned_drug) parts.push(`selling ${d.assigned_drug} (${d.assigned_quality})`);
      if (d.inventory_count) parts.push(`${d.inventory_count} units left`);
      if (d.status === 'idle') parts.push('— can be assigned');
      if (d.status === 'busted') parts.push('— cannot be used');
      return parts.join(' ');
    })
    .join('\n  ') || 'none';

  // Cook queue (include UUIDs, completion time, and units)
  const cooks = (state.cook_queue || [])
    .map(c => {
      const ready = c.status === 'ready';
      const eta = !ready && c.completes_at
        ? ` — finishes ${new Date(c.completes_at).toISOString()}`
        : '';
      return `[${c.id}] ${c.drug_type} (${c.quality_tier}): ${c.status.toUpperCase()}${ready ? ' ✓ COLLECT NOW' : eta} (${c.units_expected} units)`;
    })
    .join('\n  ') || 'none';

  // Gear (include UUIDs)
  const gear = (state.gear || [])
    .map(g => `[${g.id}] ${g.gear_type}${g.equipped ? ' [EQUIPPED]' : ''}`)
    .join(', ') || 'none';

  // District players (potential targets or threats)
  const districtPlayers = (state.district_players || [])
    .filter(p => p.id !== player.id)
    .map(p => `${p.username} (${p.rank_title})`)
    .join(', ') || 'none nearby';

  // Active contracts (max 1)
  const myContracts = (state.my_contracts || [])
    .map(c => `[${c.id}] ${c.contract_type}: ${c.description} — progress ${c.progress || 0}/${c.target} (reward $${c.scaled_reward || c.base_reward})`)
    .join('\n  ');

  // Available contracts on the board
  const offeredContracts = (state.contracts || [])
    .filter(c => c.status === 'offered')
    .map(c => `[${c.id}] ${c.contract_type}: ${c.description} (reward $${c.scaled_reward || c.base_reward})`)
    .join('\n  ');

  const hasActiveContract = (state.my_contracts || []).length > 0;
  const contracts = myContracts
    ? `ACTIVE: ${myContracts}${offeredContracts ? '\n  Board: ' + offeredContracts : ''}`
    : (offeredContracts || 'none');

  // Pending standoff
  const standoff = state.active_standoff;

  return `You are an AI agent playing Burner Empire, a competitive crime MMO.
You compete against humans and other AI agents. Your goal: maximize revenue, rank up, and survive.

## Your Status
- Username: ${player.username}
- Rank: ${rankTitle} (${rank}/7) — XP: ${player.reputation_xp || 0}
- District: ${player.current_district}
- Dirty Cash: $${player.dirty_cash || 0}
- Clean Cash: $${player.clean_cash || 0}
- Heat: ${player.heat_level?.toFixed(1) || 0}/${HEAT_MAX} ${player.heat_level > 25 ? '⚠ RISK OF BUST' : ''}
- Season Revenue: $${player.season_revenue || 0}
- In Prison: ${player.in_prison ? 'YES (until ' + player.prison_until + ')' : 'No'}
- Shaken: ${player.is_shaken ? 'YES' : 'No'}
- Laying Low: ${player.laying_low_until ? 'YES' : 'No'}
- Traveling: ${player.travel_to ? 'YES → ' + player.travel_to : 'No'}

## Resources
- Inventory: ${inventory}
- Dealers (${(state.dealers || []).length}/8):
  ${dealers}
- Cook Queue: ${cooks}
- Gear: ${gear}
- Contracts: ${contracts}

## Environment
- District Players: ${districtPlayers}
${standoff ? `- ACTIVE STANDOFF: ${standoff.id} — Score: ${standoff.attacker_score}-${standoff.defender_score}` : ''}

## Available Actions
${rank >= 0 ? `- cook: Start cooking drugs. Params: {drug: "${availableDrugs.join('|')}", quality: "cut|standard|pure"}` : ''}
- collect_cook: Collect a READY cook. Params: {cook_id: "UUID"} *** ONLY works on cooks with status READY — do NOT collect COOKING cooks ***
- recruit_dealer: Hire a dealer ($300, first free). No params.
- assign_dealer: Deploy an IDLE dealer. Params: {dealer_id, district, drug, quality, units} *** dealer must be IDLE — cannot assign ACTIVE or BUSTED dealers ***
- resupply_dealer: Restock. Params: {dealer_id, units}
- recall_dealer: Pull back. Params: {dealer_id}
- travel: Move districts. Params: {district: "${DISTRICTS.join('|')}"}
- lay_low: Hide (5min). No params. Do this if heat > 30.
- bribe: Pay clean cash to reduce heat by 25. No params.
${rank >= 1 ? `- launder: Convert dirty→clean. Params: {amount: number} *** amount must be <= your dirty cash ($${player.dirty_cash || 0}) ***` : ''}
${rank >= 2 ? '- scout: Gather district intel (4hr cooldown). No params.' : ''}
${rank >= 2 ? `- hostile_action: Attack player. Params: {action_type: "rob|snitch|intimidate|hit", target_player_id: "UUID"}` : ''}
${standoff ? '- standoff_choice: Combat round. Params: {standoff_id: "UUID", choice: "attack|defend|counter"}' : ''}
- buy_gear: Purchase gear. Params: {gear_type: "brass_knuckles|switchblade|piece|leather_jacket|kevlar_vest|plated_carrier"}
- equip_gear: Equip owned gear. Params: {gear_id: "UUID"}
- accept_contract: Take contract (max 1 active). Params: {contract_id: "UUID"}${hasActiveContract ? ' *** YOU ALREADY HAVE AN ACTIVE CONTRACT — DO NOT ACCEPT ANOTHER ***' : ''}
- bail: Leave prison early (costs clean cash). No params.
- wait: Do nothing this tick.

## Drug Economics
${availableDrugs.map(d => `- ${d}: costs $${DRUG_PRECURSOR_COST[d]}, sells ~$${DRUG_BASE_PRICE[d]}/unit`).join('\n')}

## Combat (Rock-Paper-Scissors)
Attack beats Counter, Counter beats Defend, Defend beats Attack.
First to 2 points wins. Gear ATK/DEF affects win magnitude.

## Rules
- ALWAYS respond with valid JSON: {"action": "action_name", "params": {...}, "reasoning": "why"}
- When actions need UUIDs (dealer_id, cook_id, contract_id, gear_id, etc.), use the exact UUID shown in brackets [uuid] above. Never use descriptions as IDs.
- If in a standoff, you MUST submit standoff_choice.
- If in prison with clean cash, consider bail.
- If heat > 30, consider laying low or bribing.
- If traveling, you must wait.
- Manage your dealers — they're your main income source.
- Launder dirty cash when possible (rank 1+) to build clean cash reserves for bribes/bail.
- "wait" is valid if nothing productive can be done right now.`;
}

// ── Pre-flight validation ────────────────────────────────────────────────
// Catches obviously invalid actions before they hit the server.
// Returns a rejection reason string, or null if the action looks valid.

function validateAction(action, params, state) {
  const player = state.player || {};
  const cooks = state.cook_queue || [];
  const dealers = state.dealers || [];
  const inv = state.inventory || {};

  switch (action) {
    case 'collect_cook': {
      const cook = cooks.find(c => c.id === params.cook_id);
      if (!cook) return 'cook_id not found in queue';
      if (cook.status !== 'ready') return `cook is still ${cook.status}, not ready`;
      break;
    }
    case 'assign_dealer': {
      const dealer = dealers.find(d => d.id === params.dealer_id);
      if (!dealer) return 'dealer_id not found';
      if (dealer.status !== 'idle') return `dealer is ${dealer.status}, must be idle`;
      if (params.units > 0) {
        const key = `${params.drug}_${params.quality}`;
        const available = inv[key] || 0;
        if (available < params.units) return `only ${available} units of ${key} in inventory`;
      }
      break;
    }
    case 'resupply_dealer': {
      const dealer = dealers.find(d => d.id === params.dealer_id);
      if (!dealer) return 'dealer_id not found';
      if (dealer.status !== 'active') return `dealer is ${dealer.status}, must be active`;
      if (dealer.assigned_drug) {
        const key = `${dealer.assigned_drug}_${dealer.assigned_quality}`;
        const available = inv[key] || 0;
        if (available < (params.units || 1)) return `only ${available} units of ${key} in inventory`;
      }
      break;
    }
    case 'launder': {
      const dirty = player.dirty_cash || 0;
      if ((params.amount || 0) > dirty) return `amount $${params.amount} exceeds dirty cash $${dirty}`;
      break;
    }
    case 'cook': {
      const dirty = player.dirty_cash || 0;
      const cost = DRUG_PRECURSOR_COST[params.drug] || 0;
      if (cost > dirty) return `precursor costs $${cost}, only have $${dirty} dirty`;
      break;
    }
    case 'buy_gear': {
      const dirty = player.dirty_cash || 0;
      const item = GEAR_CATALOG.find(g => g.type === params.gear_type);
      if (item && item.cost > dirty) return `${item.name} costs $${item.cost}, only have $${dirty} dirty`;
      break;
    }
    case 'hostile_action': {
      if ((player.reputation_rank || 0) < PVP_MIN_RANK) return `need rank ${PVP_MIN_RANK}+ for PvP`;
      break;
    }
  }
  return null; // action looks valid
}

// ── Main Agent Loop ─────────────────────────────────────────────────────

async function run() {
  if (!ARENA_API_KEY) {
    console.error('Set ARENA_API_KEY environment variable');
    process.exit(1);
  }
  if (!PLAYER_ID) {
    console.error('Set ARENA_PLAYER_ID or --player-id');
    process.exit(1);
  }

  const client = new ArenaClient();
  const llm = new LLMClient();

  log('info', `Arena Agent starting`, {
    player_id: PLAYER_ID,
    duration: DURATION_STR,
    model: ARENA_LLM_MODEL,
    tick_interval: TICK_INTERVAL_MS,
  });

  const startTime = Date.now();
  let tickCount = 0;
  let errorStreak = 0;

  while (Date.now() - startTime < DURATION_MS) {
    tickCount++;

    try {
      // 1. Get current game state
      const state = await client.getState(PLAYER_ID);
      const player = state.player || {};

      log('info', `Tick ${tickCount}: ${player.username} | ${RANK_TITLES[player.reputation_rank || 0]} | $${player.dirty_cash}d/$${player.clean_cash}c | Heat: ${player.heat_level?.toFixed(1)}`);

      // 2. Check notifications
      try {
        const notifs = await client.getNotifications(PLAYER_ID);
        if (notifs.count > 0) {
          log('info', `${notifs.count} notifications`, { types: notifs.notifications.map(n => n.kind || n.event || n.type) });
        }
      } catch {}

      // 3. Ask LLM what to do
      const systemPrompt = buildSystemPrompt(state);
      const decision = await llm.decide(systemPrompt, 'Analyze your current situation and choose the best action. Respond with JSON: {"action": "action_name", "params": {...}, "reasoning": "brief explanation"}');

      if (!decision.action || decision.action === 'wait' || decision.fallback) {
        const reason = decision.reasoning || (decision.fallback ? 'LLM fallback' : 'chose to wait');
        log('info', `Wait: ${reason}`);

        // Still log the decision for spectators even if waiting
        if (decision.action === 'wait' && decision.reasoning) {
          try {
            await client.executeAction(PLAYER_ID, 'list_district_players', {}, decision.reasoning, ARENA_LLM_MODEL);
          } catch {}
        }

        errorStreak = 0;
        await sleep(TICK_INTERVAL_MS);
        continue;
      }

      // 4. Validate and execute the chosen action
      const { action, params = {}, reasoning = '' } = decision;

      // Pre-flight: catch obviously invalid actions before hitting the server
      const rejection = validateAction(action, params, state);
      if (rejection) {
        log('info', `Blocked: ${action} — ${rejection}`, { params, reasoning });
        // Don't count as error streak — just a bad LLM pick
        await sleep(TICK_INTERVAL_MS);
        continue;
      }

      log('info', `Action: ${action}`, { params, reasoning });

      try {
        const result = await client.executeAction(PLAYER_ID, action, params, reasoning, ARENA_LLM_MODEL);

        if (result.success) {
          log('info', `Success: ${action}`, { responses: result.responses?.length });
          errorStreak = 0;
        } else {
          log('warn', `Failed: ${action} — ${result.error}`, { code: result.code });
          errorStreak++;
        }
      } catch (err) {
        log('error', `Action error: ${action} — ${err.message}`);
        errorStreak++;
      }

      // 5. Back off if too many errors
      if (errorStreak >= 5) {
        log('warn', 'Error streak — backing off 30s');
        await sleep(30000);
        errorStreak = 0;
      }

    } catch (err) {
      log('error', `Tick error: ${err.message}`);
      errorStreak++;
      if (errorStreak >= 10) {
        log('error', 'Too many errors, stopping');
        break;
      }
    }

    await sleep(TICK_INTERVAL_MS);
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const llmStats = llm.getStats();
  log('info', `Agent finished`, {
    ticks: tickCount,
    elapsed_secs: elapsed,
    llm_calls: llmStats.calls,
    llm_tokens: llmStats.tokens,
    model: llmStats.model,
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Run
run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
