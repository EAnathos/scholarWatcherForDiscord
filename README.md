# ScholarWatchForDiscord

> Automated bibliographic monitoring bot for Discord — track new scientific publications across any field.

[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

ScholarWatchForDiscord monitors Google Scholar for new publications matching your keywords and delivers them as Discord notifications. Each server configures its own keywords, schedule, and notification channels. The bot works for any research domain, from myrmecology to astrophysics.

## Features

- **Generic** — no hardcoded domain, everything is driven by keywords
- **Multi-channel** — multiple watch channels per server, each with independent keywords
- **Multi-server** — each server has its own configuration
- **Bilingual** — English by default, French available per server
- **Deduplication** — articles are tracked to avoid repeat notifications
- **Customizable schedule** — daily hour or full cron expression
- **Docker deployment** — one command to run

![Keywords list](docs/screenshots/keywords-list.png)
![Notification embed](docs/screenshots/notification.png)

## Quick Start

See the **[Getting Started](https://github.com/EAnathos/scholarWatcherForDiscord/wiki/Getting-Started)** guide for full setup instructions.

1. Set your SerpApi key: `/watch apikey set`
2. Add a watch channel: `/watch channel add #channel`
3. Add keywords: `/keywords`
4. Enable the watch: `/watch toggle`

## Documentation

Full documentation is available on the **[Wiki](https://github.com/EAnathos/scholarWatcherForDiscord/wiki)**:

- [Getting Started](https://github.com/EAnathos/scholarWatcherForDiscord/wiki/Getting-Started) — setup guide
- [Commands](https://github.com/EAnathos/scholarWatcherForDiscord/wiki/Commands) — full command reference
- [Self-Hosting](https://github.com/EAnathos/scholarWatcherForDiscord/wiki/Self-Hosting) — Docker and manual deployment
- [FAQ](https://github.com/EAnathos/scholarWatcherForDiscord/wiki/FAQ) — frequently asked questions

## Legal

- [Privacy Policy](https://eanathos.github.io/scholarWatcherForDiscord/privacy.html)
- [Terms of Service](https://eanathos.github.io/scholarWatcherForDiscord/tos.html)

## License

[MIT](LICENSE)
