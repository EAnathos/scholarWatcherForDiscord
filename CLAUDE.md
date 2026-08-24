# ScholarWatchForDiscord

Discord bot for automated bibliographic monitoring. Watches Google Scholar (via SerpApi) for new publications matching user-defined keywords and posts notifications to configured channels. Supports multiple watch channels per guild, each with its own keyword list.

## Commands

- `npm run dev` — start in dev mode with hot reload
- `npm run build` — compile TypeScript
- `npm run test` — run tests
- `npm run lint` — lint source files
- `npm run prisma:migrate` — run database migrations
- `npm run deploy:commands` — register Discord slash commands globally (local dev)
- `npm run deploy:commands -- --guild=ID` — register commands on a single guild (instant)
- `docker compose exec bot node dist/discord/deploy.js` — register commands from Docker
- `docker compose exec bot node dist/discord/deploy.js --guild=ID` — register on a single guild from Docker

## Architecture

```
Discord (commands/interactions) → Core (services) → Sources (adapters) → Prisma (database)
```

## Conventions

- All user-facing strings go through `i18n.t(key)` — no string literals in embeds or command responses
- New strings must be added to `locales/en.json` first (reference), then `locales/fr.json`
- Each `SourceAdapter` implements the interface in `sources/SourceAdapter.ts` and comes with a test
- No `any` — use Prisma and Zod types
- Imports sorted with `@typescript-eslint/consistent-type-imports`
- One SerpApi request per run per guild (batch keywords with OR) to preserve quota
