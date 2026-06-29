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

// POST /api/pings =============================================================

const pingItemSchema = {
  type: 'object',
  required: ['vehicle_id', 'lat', 'long', 'speed', 'ignition', 'occurred_at'],
  additionalProperties: false,
  properties: {
    vehicle_id:  { type: 'integer', minimum: 1, maximum: 10 },
    lat:         { type: 'number' },
    long:        { type: 'number' },
    speed:       { type: 'number', minimum: 0 },
    ignition:    { type: 'integer', enum: [0, 1] },
    occurred_at: { type: 'string' },
  },
} as const;

interface PingInput {
  vehicle_id:  number;
  lat:         number;
  long:        number;
  speed:       number;
  ignition:    0 | 1;
  occurred_at: string;
}

app.post<{ Body: PingInput[] }>(
  '/api/pings',
  {
    schema: {
      body: {
        type: 'array',
        minItems: 1,
        items: pingItemSchema,
      },
    },
  },
  async (request, reply) => {
    const pings = request.body;

    for (const p of pings) {
      if (isNaN(Date.parse(p.occurred_at))) {
        return reply.status(400).send({ error: `Invalid occurred_at: ${p.occurred_at}` });
      }
    }

    await pool.query(
      `INSERT INTO pings (vehicle_id, lat, lng, speed, ignition, occurred_at)
       SELECT * FROM unnest(
         $1::int[],
         $2::float8[],
         $3::float8[],
         $4::float8[],
         $5::int2[],
         $6::timestamptz[]
       )
       ON CONFLICT (vehicle_id, occurred_at) DO NOTHING`,
      [
        pings.map((p) => p.vehicle_id),
        pings.map((p) => p.lat),
        pings.map((p) => p.long),
        pings.map((p) => p.speed),
        pings.map((p) => p.ignition),
        pings.map((p) => p.occurred_at),
      ],
    );

    return { ok: true };
  },
);

// GET /api/vehicles ===========================================================

app.get('/api/vehicles', async () => {
  const result = await pool.query(`
    SELECT
      v.id,
      v.plate_number,
      v.model_name,
      p.lat,
      p.lng,
      p.speed,
      p.ignition,
      p.occurred_at
    FROM vehicles v
    LEFT JOIN LATERAL (
      SELECT lat, lng, speed, ignition, occurred_at
      FROM pings
      WHERE vehicle_id = v.id
      ORDER BY occurred_at DESC
      LIMIT 1
    ) p ON true
    ORDER BY v.id
  `);

  return result.rows.map((row) => ({
    id:           row.id,
    plate_number: row.plate_number,
    model_name:   row.model_name,
    lat:          row.lat   ?? null,
    lng:          row.lng   ?? null,
    speed:        row.speed ?? null,
    ignition:     row.ignition !== null ? Number(row.ignition) : null,
    occurred_at:  row.occurred_at ? (row.occurred_at as Date).toISOString() : null,
  }));
});

// GET /api/vehicles/:id/pings ==============================================

app.get<{
  Params: { id: string };
  Querystring: { from?: string; to?: string };
}>('/api/vehicles/:id/pings', async (request, reply) => {
  const id = parseInt(request.params.id, 10);
  if (isNaN(id) || id < 1 || id > 10) {
    return reply.status(404).send({ error: 'Vehicle not found' });
  }

  const { from, to } = request.query;
  if (!from || !to) {
    return reply.status(400).send({ error: '"from" and "to" query params are required' });
  }

  const fromMs = Date.parse(from);
  const toMs   = Date.parse(to);

  const fromDate = new Date(fromMs).toISOString();
  const toDate   = new Date(toMs).toISOString();

  const [traceResult, statsResult] = await Promise.all([
    pool.query(
      `SELECT lat, lng, speed, ignition, occurred_at
       FROM pings
       WHERE vehicle_id = $1 AND occurred_at >= $2 AND occurred_at <= $3
       ORDER BY occurred_at`,
      [id, fromDate, toDate],
    ),

    pool.query(
      `WITH ordered AS (
         SELECT
           ignition,
           speed,
           LAG(ignition) OVER (ORDER BY occurred_at) AS prev_ignition
         FROM pings
         WHERE vehicle_id = $1 AND occurred_at >= $2 AND occurred_at <= $3
       )
       SELECT
         COALESCE(
           SUM(CASE WHEN ignition = 1 AND prev_ignition = 0 THEN 1 ELSE 0 END),
           0
         )::int                      AS ignition_cycles,
         COALESCE(MAX(speed),  0)    AS max_speed,
         COALESCE(AVG(speed),  0)    AS avg_speed
       FROM ordered`,
      [id, fromDate, toDate],
    ),
  ]);

  const stats = statsResult.rows[0];

  return {
    vehicle_id:      id,
    trace:           traceResult.rows.map((r) => ({
      lat:         r.lat,
      lng:         r.lng,
      speed:       r.speed,
      ignition:    Number(r.ignition),
      occurred_at: (r.occurred_at as Date).toISOString(),
    })),
    ignition_cycles: stats.ignition_cycles,
    max_speed:       parseFloat(stats.max_speed),
    avg_speed:       parseFloat(stats.avg_speed),
  };
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
