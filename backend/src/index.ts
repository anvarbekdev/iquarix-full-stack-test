import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { pool, runMigrations } from './db';

const app = Fastify({ logger: true });

app.register(fastifyCors, { origin: true });

app.get('/health', async () => {
  await pool.query('SELECT 1');
  return { status: 'ok' };
});

async function start(): Promise<void> {
  await runMigrations();

  const port = parseInt(process.env.PORT ?? '3000', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen({ port, host });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
