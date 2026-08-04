# ScholarWatchForDiscord — Cahier des charges

**ScholarWatchForDiscord** est un bot Discord de veille bibliographique automatisée. Chaque serveur
définit sa propre liste de mots-clés ; le bot interroge périodiquement les sources
scientifiques configurées et publie les nouvelles publications correspondantes dans
le salon de son choix. Le domaine d'application n'est pas contraint : myrmécologie,
astrophysique, droit, veille économique — seuls les mots-clés changent.

## 1. Objectifs

- Générique : aucun domaine hardcodé, tout se pilote par la liste de mots-clés.
- Configurable via Discord uniquement (pas de frontend web).
- Multi-serveur : un serveur = son propre jeu de mots-clés, son propre salon cible.
- Interface bilingue : anglais par défaut, français activable par serveur.
- Déploiement Docker en une commande.
- Code propre, typé, testable.

## 2. Périmètre fonctionnel (MVP)

### 2.1 Source de données
- Google Scholar via **SerpApi** (moteur `google_scholar`).
- Fenêtre glissante hebdomadaire (`tbs=qdr:w`, tri par date).
- Architecture ouverte à d'autres sources (arXiv, Semantic Scholar, Crossref, AntCat)
  via une interface `SourceAdapter` — hors périmètre MVP.

### 2.2 Commandes Discord

| Commande                          | Rôle                                                                 |
| --------------------------------- | -------------------------------------------------------------------- |
| `/keywords`                       | Affiche la liste des mots-clés du serveur + boutons Ajouter/Supprimer |
| `/watch channel <#ch>`            | Définit le salon de destination des notifications                     |
| `/watch schedule hour <0-23>`     | Passage quotidien à l'heure UTC choisie (défaut `4` = `0 4 * * *`)   |
| `/watch schedule cron <expr>`     | Cron avancé (surcharge la config simple)                             |
| `/watch language <en\|fr>`        | Change la langue de l'interface pour le serveur (défaut `en`)         |
| `/watch toggle`                   | Active/désactive la veille pour le serveur                            |
| `/watch status`                   | Résume la config courante (salon, cron, langue, actif, nb mots-clés) |
| `/watch run`                      | Force une exécution immédiate (admin uniquement)                     |

### 2.3 Gestion des mots-clés

Flux ergonomique en une seule commande (`/keywords`) :

1. `/keywords` répond avec un embed listant les mots-clés numérotés (`1. Formicidae`,
   `2. Myrmicinae`, …) et deux boutons : **➕ Ajouter** et **➖ Supprimer**.
2. Bouton **Ajouter** → ouvre une modal avec un `TextInput` :
   - Label : « Nouveau mot-clé »
   - Placeholder : `ex: Formicidae OR "Camponotus"`
   - À la soumission : validation Zod (longueur, doublon), insertion en base, embed
     re-rendu (edit du message d'origine ou nouveau message éphémère).
3. Bouton **Supprimer** → ouvre une modal avec un `TextInput` :
   - Label : « ID à supprimer »
   - Placeholder : `1`
   - À la soumission : parsing en entier, suppression si l'ID appartient au serveur.

Toutes les réponses sont **éphémères** par défaut (visibles seulement du demandeur).
Permission requise sur les commandes de configuration : `ManageGuild`.

### 2.4 Notification

Toutes les publications trouvées sont dédupliquées (par `externalId` + titre + lien)
et poussées dans le salon configuré sous forme d'un embed unique regroupant jusqu'à
10 résultats. Aucun résultat = aucun message envoyé.

## 3. Stack technique

| Couche          | Choix                                             |
| --------------- | ------------------------------------------------- |
| Runtime         | Node.js 22 LTS                                    |
| Langage         | TypeScript (strict)                               |
| Bot             | `discord.js` v14                                  |
| ORM             | **Prisma** (client + migrations)                  |
| Base de données | SQLite (fichier montée sur volume Docker)         |
| Validation      | Zod                                               |
| i18n            | `i18next` (fichiers JSON `locales/en.json`, `locales/fr.json`) |
| Planification   | `node-cron`                                       |
| HTTP            | `undici` (fetch natif) + wrapper retry/rate-limit |
| Tests           | Vitest                                            |
| Lint / Format   | ESLint (`@typescript-eslint`) + Prettier          |
| Conteneur       | Docker multi-stage + `docker compose`             |

## 4. Arborescence

```
scholarwatchfordiscord/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── index.ts                    # bootstrap : client Discord + scheduler
│   ├── config/
│   │   └── env.ts                  # parsing Zod des variables d'env
│   ├── discord/
│   │   ├── client.ts               # instanciation Client + login
│   │   ├── commands/
│   │   │   ├── keywords.ts         # /keywords + interactions boutons/modals
│   │   │   └── veille.ts           # /veille (channel, schedule, toggle, …)
│   │   └── interactions/
│   │       ├── addKeywordModal.ts
│   │       └── removeKeywordModal.ts
│   ├── core/
│   │   ├── WatchService.ts         # orchestration cron → search → notify
│   │   ├── DedupService.ts         # existe déjà ? insert-or-skip
│   │   └── ConfigService.ts        # CRUD guild / keywords
│   ├── sources/
│   │   ├── SourceAdapter.ts        # interface { search(keywords, since) }
│   │   └── SerpApiScholar.ts
│   ├── prisma/
│   │   └── client.ts               # singleton PrismaClient
│   ├── locales/
│   │   ├── en.json                 # référence (défaut)
│   │   └── fr.json
│   ├── i18n/
│   │   └── index.ts                # init i18next + helper t(key, guild)
│   └── utils/
│       ├── logger.ts
│       └── embeds.ts               # helpers EmbedBuilder
├── tests/
├── docs/
│   └── screenshots/                # captures d'écran (README)
├── .husky/
│   ├── pre-commit
│   └── commit-msg
├── .eslintrc.cjs
├── .prettierrc
├── CLAUDE.md
├── README.md
├── tsconfig.json
├── package.json
├── Dockerfile
├── docker-compose.yml
└── LICENSE
```

## 5. Modèle de données (Prisma)

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Guild {
  id           String    @id                    // Discord guild ID
  channelId    String?
  cronSchedule String    @default("0 4 * * *")  // quotidien 4h UTC
  language     String    @default("en")         // "en" | "fr"
  enabled      Boolean   @default(true)
  keywords     Keyword[]
  articles     Article[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model Keyword {
  id        Int      @id @default(autoincrement())
  guildId   String
  value     String
  createdAt DateTime @default(now())
  guild     Guild    @relation(fields: [guildId], references: [id], onDelete: Cascade)

  @@unique([guildId, value])
}

model Article {
  id         Int      @id @default(autoincrement())
  guildId    String
  externalId String                              // ex: scholar/<hash>
  source     String                              // "serpapi" | "arxiv" | …
  title      String
  authors    String?
  year       Int?
  link       String
  doi        String?
  notifiedAt DateTime @default(now())
  guild      Guild    @relation(fields: [guildId], references: [id], onDelete: Cascade)

  @@unique([guildId, externalId])
  @@index([guildId, title])
}
```

## 5.bis Internationalisation

- Deux fichiers de traduction : `src/locales/en.json` (référence) et `src/locales/fr.json`.
- Clés organisées par contexte : `commands.keywords.title`, `embeds.notification.footer`, etc.
- La langue est résolue par `guild.language` en base pour chaque interaction/notification.
- Fallback : toute clé manquante en `fr` retombe sur l'anglais.
- Un test unitaire vérifie l'égalité des jeux de clés entre les deux fichiers.

## 6. Variables d'environnement

| Variable         | Rôle                                     |
| ---------------- | ---------------------------------------- |
| `DISCORD_TOKEN`  | Token du bot                             |
| `DISCORD_APP_ID` | Application ID (pour enregistrer les commandes) |
| `SERPAPI_KEY`    | Clé SerpApi                              |
| `DATABASE_URL`   | ex : `postgresql://bot:bot@db:5432/veille` |
| `LOG_LEVEL`      | `debug` \| `info` \| `warn` \| `error`   |

Validation via Zod dans `src/config/env.ts`, échec au démarrage si incomplet.

## 7. Déploiement Docker

### 7.1 `Dockerfile` (multi-stage)

```dockerfile
# --- Stage build ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# --- Stage runtime ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

### 7.2 `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: scholarwatch-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: bot
      POSTGRES_PASSWORD: bot
      POSTGRES_DB: veille
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bot -d veille"]
      interval: 5s
      timeout: 5s
      retries: 5

  bot:
    build: .
    container_name: scholarwatch
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    env_file: .env
    environment:
      DATABASE_URL: postgresql://bot:bot@db:5432/veille

volumes:
  db-data:
```

Déploiement : `docker compose up -d --build`.
En production, remplacer les credentials en dur par des secrets Docker ou un `.env`.

## 8. Qualité, conventions et documentation du dépôt

### 8.1 `.eslintrc.cjs`

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { project: './tsconfig.json' },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/consistent-type-imports': 'error',
  },
  ignorePatterns: ['dist', 'node_modules', 'prisma/migrations'],
};
```

### 8.2 `.prettierrc`

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

### 8.3 `package.json` — scripts clés

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "lint": "eslint 'src/**/*.ts'",
    "format": "prettier --write 'src/**/*.ts'",
    "test": "vitest run",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  }
}
```

### 8.4 Git hooks (Husky + lint-staged)

Pré-commit :
- `lint-staged` : Prettier puis ESLint --fix sur les fichiers TypeScript stagés.
- `tsc --noEmit` : vérification typage rapide sur l'ensemble du projet.

Commit-msg :
- `commitlint` (Conventional Commits) pour normaliser l'historique.

```json
// package.json — extrait
"lint-staged": {
  "*.ts": ["prettier --write", "eslint --fix"],
  "*.{json,md,yml}": "prettier --write"
}
```

```sh
# .husky/pre-commit
npx lint-staged
npx tsc --noEmit
```

```sh
# .husky/commit-msg
npx --no -- commitlint --edit "$1"
```

### 8.5 `CLAUDE.md` — instructions pour Claude Code

Fichier à la racine du dépôt, lu automatiquement par Claude Code lors des sessions
de développement assisté. Contenu attendu :

- Vue d'ensemble du projet (2-3 lignes).
- Commandes usuelles (`npm run dev`, `npm run test`, `npm run prisma:migrate`,
  `npm run deploy:commands`).
- Rappel de la structure en couches : `Discord → Core → Sources → Prisma`.
- Conventions strictes :
  - toute chaîne visible par l'utilisateur passe par `i18n.t(key)` — jamais de
    littéral dans les embeds ou les réponses de commande ;
  - toute nouvelle chaîne est ajoutée à `locales/en.json` (référence) avant
    utilisation ;
  - chaque nouveau `SourceAdapter` implémente l'interface et vient avec son test
    unitaire ;
  - pas de `any`, préférer les types issus de Prisma et Zod ;
  - imports triés (`@typescript-eslint/consistent-type-imports`).
- Point de vigilance sur les quotas SerpApi (voir §9.4) : toute modification du
  flux de recherche doit préserver le batching en une seule requête par run.

### 8.6 `README.md` — documentation utilisateur (GitHub)

Le README du dépôt sert de vitrine et de documentation utilisateur. Structure :

1. Titre + tagline
2. Badges (CI, licence, version Node)
3. Description
4. **Capture d'écran** — vue d'ensemble d'une notification
5. Installation via Docker (`docker compose up -d`)
6. Configuration (variables d'environnement, invitation du bot avec les scopes
   requis)
7. Commandes Discord — reprise du tableau §2.2
8. **Capture d'écran** — commande `/keywords` avec boutons
9. **Capture d'écran** — modal d'ajout de mot-clé
10. **Capture d'écran** — `/watch status`
11. Contribuer — ajouter une source, workflow PR
12. Licence

Emplacements d'images à préparer (fichiers à ajouter plus tard, laisser les
liens en placeholder markdown pour valider la structure) :

```markdown
![Notification embed](docs/screenshots/notification-embed.png)
![Liste des mots-clés](docs/screenshots/keywords-list.png)
![Ajout d'un mot-clé](docs/screenshots/keywords-add-modal.png)
![Statut](docs/screenshots/status-command.png)
```

Le dossier `docs/screenshots/` est créé vide au début du projet (avec un
`.gitkeep`), les captures sont ajoutées après la première version fonctionnelle.

## 9. Considérations opérationnelles

### 9.1 Enregistrement des slash commands
Script dédié `npm run deploy:commands` publiant les commandes via l'API Discord.
Global par défaut ; option `--guild <id>` pour un déploiement instantané en dev.

### 9.2 Onboarding
Sur `guildCreate`, création de l'entrée `Guild` en base et envoi d'un embed
d'accueil dans le premier salon textuel accessible (permission `SendMessages`)
listant les commandes principales.

### 9.3 Départ d'un serveur
Sur `guildDelete`, `enabled` passe à `false` sans suppression. Une éventuelle
réinvitation restaure la config à l'identique.

### 9.4 Quota SerpApi
- Une seule requête par run et par serveur — jointure `OR` de tous les mots-clés.
- Backoff exponentiel sur `429` et erreurs réseau (3 tentatives max).
- Compteur mensuel de requêtes en base ; avertissement à 80 % du quota.

### 9.5 Journalisation
`pino` en sortie JSON (`level`, `guildId`, `source`, `elapsed_ms`), niveau piloté
par `LOG_LEVEL`. Prêt pour agrégation ultérieure (Loki, Elastic).

### 9.6 Healthcheck bot
Le conteneur `bot` marque un fichier `/tmp/healthy` à chaque tick du client Discord
(`clientReady`, heartbeat). Le healthcheck Docker vérifie sa fraîcheur (<60 s).

### 9.7 Pagination
`/keywords` pagine à 25 éléments (limite Discord sur composants) avec boutons
◀ ▶ au-delà.

### 9.8 Rétention des articles
Aucune purge par défaut : la table `Article` sert de mémoire de déduplication.
Croissance ~1 Ko/article ; purge planifiée à prévoir uniquement en cas d'usage
multi-serveur intensif.

## 10. Roadmap post-MVP

- Adapters supplémentaires : arXiv, Semantic Scholar, Crossref, AntCat.
- Filtre par année / langue / journal.
- Export / import de profils de veille en JSON (partage entre serveurs).
- Fuseau horaire par serveur (aujourd'hui tout est en UTC).
- Langues supplémentaires (es, de, …) — l'archi i18next le permet sans refonte.
- Métriques (nb requêtes SerpApi, nb notifs envoyées) via Prometheus.
