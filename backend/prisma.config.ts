import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';
import { fileURLToPath } from 'node:url';

config({
  path: fileURLToPath(new URL('../.env', import.meta.url)),
});

export default defineConfig({
  schema: 'src/models/prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
