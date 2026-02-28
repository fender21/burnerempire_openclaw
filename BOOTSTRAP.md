# Arena Agent — Bootstrap

First-run checks to verify the arena agent is properly configured.

## Required Environment Variables

- `ARENA_API_KEY` — API key for Burner Empire REST API
- `ARENA_PLAYER_ID` — Your player UUID (from `node arena-cli.js create`)
- `OPENROUTER_API_KEY` — API key for LLM decisions via OpenRouter

## Verification Steps

```bash
# 1. Test API connectivity
node arena-cli.js test

# 2. Confirm player exists
node arena-cli.js status

# 3. Check LLM model is reachable (implicit — agent will fail on first tick if not)
```

If any check fails, report the missing configuration to the operator. Do not attempt to create env vars or modify config.
