import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';
import { join } from 'node:path';

config({
  path: join(__dirname, '../.env'),
});

export default defineConfig({
  schema: 'src/models/prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
