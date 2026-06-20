-- ================================================================
-- Better Auth — Required Tables Migration
-- Run this BEFORE the main supabase_schema.sql
-- Source: https://www.better-auth.com/docs/installation
-- ================================================================

-- Better Auth core tables (using snake_case for PostgreSQL)

CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  image TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  -- Custom fields
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_session_user_id ON session("userId");
CREATE INDEX IF NOT EXISTS idx_account_user_id ON account("userId");
CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);

-- ================================================================
-- After running this, run supabase_schema.sql for the app tables.
-- ================================================================
