import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS vehicles (
  id           INTEGER PRIMARY KEY,
  plate_number VARCHAR(20)  NOT NULL UNIQUE,
  model_name   VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS pings (
  id          BIGSERIAL PRIMARY KEY,
  vehicle_id  INTEGER          NOT NULL REFERENCES vehicles(id),
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  speed       DOUBLE PRECISION NOT NULL,
  ignition    SMALLINT         NOT NULL,
  occurred_at TIMESTAMPTZ      NOT NULL
);

-- Unique index doubles as deduplication key for simulator retries:
-- the simulator sets occurred_at = new Date().toISOString() once per batch,
-- so a retry sends identical (vehicle_id, occurred_at) pairs.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pings_vehicle_occurred
  ON pings (vehicle_id, occurred_at);

-- Supports both the LATERAL latest-state query and ranged trace queries.
CREATE INDEX IF NOT EXISTS idx_pings_vehicle_occurred_desc
  ON pings (vehicle_id, occurred_at DESC);

INSERT INTO vehicles (id, plate_number, model_name) VALUES
  (1,  '01 A 123 AA', 'Chevrolet Cobalt'),
  (2,  '10 B 456 BB', 'Chevrolet Lacetti (Gentra)'),
  (3,  '30 C 789 CC', 'Chevrolet Damas'),
  (4,  '40 D 012 DD', 'Chevrolet Labo'),
  (5,  '60 E 345 EE', 'Isuzu NP 37 (Avtobus)'),
  (6,  '70 F 678 FF', 'Isuzu FVR (Yuk mashinasi)'),
  (7,  '80 G 901 GG', 'Chevrolet Tracker'),
  (8,  '90 H 234 HH', 'Chevrolet Onix'),
  (9,  '01 J 567 JJ', 'GAZ Gazelle Next'),
  (10, '10 K 890 KK', 'BYD Song Plus EV')
ON CONFLICT (id) DO NOTHING;
`;

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(MIGRATION_SQL);
  } finally {
    client.release();
  }
}
