# ScholarWatchForDiscord

> Automated bibliographic monitoring bot for Discord — track new scientific publications across any field.

[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Overview

ScholarWatchForDiscord monitors Google Scholar for new publications matching your keywords and delivers them as Discord notifications. Each server configures its own keywords, schedule, and notification channel — the bot works for any research domain, from myrmecology to astrophysics.

## Features

- **Generic** — no hardcoded domain, everything is driven by keywords
- **Multi-server** — each server has its own configuration
- **Bilingual** — English by default, French available per server
- **Deduplication** — articles are tracked to avoid repeat notifications
- **Customizable schedule** — daily hour or full cron expression
- **Docker deployment** — one command to run

## Installation

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A [Discord bot token](https://discord.com/developers/applications)
- A [SerpApi key](https://serpapi.com/)

### Quick start

1. Clone the repository:
   ```bash
   git clone https://github.com/EAnathos/scholarWatchForDiscord.git
   cd scholarwatchfordiscord
   ```

2. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

3. Fill in your credentials in `.env`:
   ```env
   DISCORD_TOKEN=your_discord_bot_token
   DISCORD_APP_ID=your_discord_application_id
   SERPAPI_KEY=your_serpapi_key
   DATABASE_URL=postgresql://bot:bot@db:5432/scholarwatch
   LOG_LEVEL=info
   ```

4. Start the bot:
   ```bash
   docker compose up -d --build
   ```

5. Register slash commands:
   ```bash
   npm run deploy:commands
   ```

### Bot invitation

Invite the bot with these scopes and permissions:
- **Scopes:** `bot`, `applications.commands`
- **Permissions:** `Send Messages`, `Embed Links`, `Use External Emojis`

## Commands

| Command | Description |
|---|---|
| `/keywords` | View and manage watch keywords (add/remove via buttons) |
| `/watch channel <#channel>` | Set the notification channel |
| `/watch schedule hour <0-23>` | Set daily check time (UTC) |
| `/watch schedule cron <expr>` | Set a custom cron schedule |
| `/watch language <en\|fr>` | Change bot language for this server |
| `/watch toggle` | Enable/disable the watch |
| `/watch status` | Show current configuration |
| `/watch run` | Force an immediate check (admin only) |

## Contributing

### Adding a new source

1. Create a new file in `src/sources/` implementing the `SourceAdapter` interface
2. Add a corresponding test in `tests/`
3. Wire it into `WatchService`

### Development

```bash
npm install
npm run dev
```

### Running tests

```bash
npm run test
```

## License

[MIT](LICENSE)
