/**
 * migrate.ts — Run Better Auth + App schema migrations against Supabase
 *
 * Usage: npx ts-node src/migrate.ts
 */
import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const BETTER_AUTH_SQL = `
-- Better Auth core tables
CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  image TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'driver', 'admin')),
  phone TEXT
);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMP NOT NULL,
  token TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMP,
  "refreshTokenExpiresAt" TIMESTAMP,
  scope TEXT,
  password TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP,
  "updatedAt" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_session_user_id ON session("userId");
CREATE INDEX IF NOT EXISTS idx_account_user_id ON account("userId");
CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
`;

const APP_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ambulances (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  vehicle_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'busy', 'offline')),
  latitude FLOAT8 NOT NULL DEFAULT 0,
  longitude FLOAT8 NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hospitals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  latitude FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  contact_number TEXT,
  capacity INT DEFAULT 100
);

CREATE TABLE IF NOT EXISTS emergency_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  emergency_type TEXT NOT NULL CHECK (
    emergency_type IN ('cardiac_arrest','accident','stroke','respiratory','trauma','fire','drowning','other')
  ),
  description TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','assigned','accepted','en_route','picked_up','completed','cancelled')
  ),
  latitude FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id uuid NOT NULL REFERENCES emergency_requests(id) ON DELETE CASCADE,
  ambulance_id uuid NOT NULL REFERENCES ambulances(id),
  eta INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (
    status IN ('assigned','accepted','en_route','picked_up','completed','cancelled')
  ),
  ga_metrics jsonb,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Idempotent add for databases created before ga_metrics existed
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS ga_metrics jsonb;

CREATE TABLE IF NOT EXISTS tracking_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  latitude FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_requests_patient_id ON emergency_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_emergency_requests_status ON emergency_requests(status);
CREATE INDEX IF NOT EXISTS idx_assignments_request_id ON assignments(request_id);
CREATE INDEX IF NOT EXISTS idx_assignments_ambulance_id ON assignments(ambulance_id);
CREATE INDEX IF NOT EXISTS idx_tracking_logs_assignment_id ON tracking_logs(assignment_id);
CREATE INDEX IF NOT EXISTS idx_ambulances_status ON ambulances(status);

INSERT INTO ambulances (vehicle_number, status, latitude, longitude)
VALUES
  ('KA-01-AB-1234', 'available', 12.9716, 77.5946),
  ('KA-02-CD-5678', 'available', 12.9800, 77.6000),
  ('KA-03-EF-9012', 'available', 12.9650, 77.5800),
  ('KA-04-GH-3456', 'offline', 12.9900, 77.6100),
  ('KA-05-IJ-7890', 'available', 12.9600, 77.6200)
ON CONFLICT (vehicle_number) DO NOTHING;
`;

async function migrate() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL is not set in .env');
    process.exit(1);
  }

  // Supabase pooler has a self-signed cert — must disable strict TLS
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const cleanUrl = url.replace(/[?&]sslmode=[^&]*/g, '');
  const client = new Client({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected\n');

    console.log('📦 Running Better Auth migration...');
    await client.query(BETTER_AUTH_SQL);
    console.log('✅ Better Auth tables created\n');

    console.log('📦 Running app schema migration...');
    await client.query(APP_SCHEMA_SQL);
    console.log('✅ App tables created\n');

    console.log('🎉 Migration complete! You can now start the backend with: npm run dev');
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
