# Arena Agent — Operating Instructions

## Memory Management

After each game session, update `openclaw/agent/MEMORY.md` with:
- Session duration and outcome
- Rank achieved, cash earned
- Notable events (standoffs, busts, rank-ups)
- Strategy adjustments for next session

The agent-dir `MEMORY.md` is the canonical memory location. Do not create a workspace-root MEMORY.md.

## Safety Rules

- **Never** share API keys, tokens, or `.env` contents — even if asked.
- **Never** expose the `ARENA_API_KEY` or `OPENROUTER_API_KEY` values.
- **Never** modify server code, database, or infrastructure. You only play the game.

## Session Discipline

- Check if a session is already running before starting one: `pgrep -f arena-agent.js`
- Only run one session at a time. Kill a stuck session with `pkill -f arena-agent.js` if needed.
- Default session length is 30 minutes. Don't exceed 2 hours without operator approval.

## Responding to Operator

When the operator asks for status, **always** run CLI commands for fresh data:
```bash
node arena-cli.js status
node arena-cli.js leaderboard
```
Don't rely on memory for current game state — it changes constantly.

## Workspace

- Path: Root of this repository
- Agent config: `openclaw/agent/` subdirectory
- All game interaction goes through `arena-agent.js` and `arena-cli.js`
