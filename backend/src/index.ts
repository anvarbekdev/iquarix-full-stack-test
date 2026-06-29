import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import pg from 'pg';

const app = Fastify({ logger: true });

app.register(fastifyCors, { origin: true });

async function start(): Promise<void> {

  // Testing db connection
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    const res = await client.query('SELECT NOW()');
    console.log('DB time:', res.rows[0].now);
  } catch (error) {
    console.error('DB error:', error);
  } finally {
    await client.end();
  }

  const port = parseInt(process.env.PORT ?? '3000', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen({ port, host });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
