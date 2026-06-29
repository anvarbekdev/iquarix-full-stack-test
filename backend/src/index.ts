import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';

const app = Fastify({ logger: true });

app.register(fastifyCors, { origin: true });

async function start(): Promise<void> {

  const port = parseInt(process.env.PORT ?? '3000', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen({ port, host });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
