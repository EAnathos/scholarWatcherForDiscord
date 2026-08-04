import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(import.meta.dirname, 'schema.prisma'),
  migrate: {
    async development() {
      return {
        url: process.env.DATABASE_URL ?? 'postgresql://bot:bot@localhost:5432/veille',
      };
    },
  },
});
