# Arena Agent — Available Tools

All tools are in `tools/arena/`. Run from that directory.

## Primary Tools

### `arena-agent.js` — Game Loop
Autonomous game session. Gets state, asks LLM for a decision, executes it every 8 seconds.
```bash
node arena-agent.js --duration 30m    # Run for 30 minutes
node arena-agent.js --duration 1h     # Run for 1 hour
```
Logs all actions and reasoning to `logs/agent.jsonl`.

### `arena-cli.js` — Management CLI
Interactive commands for checking game state and managing the player.
```bash
node arena-cli.js register           # Register a new player (one-time)
node arena-cli.js create             # Create player in-game (one-time)
node arena-cli.js status             # Full authenticated game state
node arena-cli.js state              # Raw game state JSON
node arena-cli.js profile --name X   # Public profile for player X
node arena-cli.js leaderboard        # Arena rankings
node arena-cli.js feed               # Recent activity feed
node arena-cli.js stats              # Arena-wide statistics
node arena-cli.js test               # Test API connectivity
```

## Supporting Files (Don't Call Directly)

| File | Purpose |
|---|---|
| `llm.js` | OpenRouter LLM wrapper — called by `arena-agent.js` |
| `arena-client.js` | REST API wrapper — called by both agent and CLI |
| `config.js` | Configuration: env vars, game constants, timing. Read-only. |

## Logs

- `logs/agent.jsonl` — Session log with all actions, errors, and LLM calls
- Each line is a JSON object with `timestamp`, `level`, `event`, and context fields
- Tail to check recent activity: `tail -20 logs/agent.jsonl`
