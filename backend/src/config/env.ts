import dotenv from 'dotenv';
dotenv.config();

const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`⚠️  Missing env var: ${key}`);
  }
}

// FRONTEND_URL may be a single origin or a comma-separated list (prod + preview
// deployments on Vercel). We expose both the raw first value (legacy callers)
// and a parsed array for CORS / trustedOrigins.
const rawFrontend = process.env.FRONTEND_URL || 'http://localhost:3000';
const FRONTEND_URLS = rawFrontend
  .split(',')
  .map((s) => s.trim().replace(/\/$/, '')) // drop trailing slashes
  .filter(Boolean);

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  DATABASE_URL: process.env.DATABASE_URL!,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || 'http://localhost:5000',
  AI_ML_SERVICE_URL: process.env.AI_ML_SERVICE_URL || 'http://localhost:8000',
  // First origin (kept for any single-value consumer); FRONTEND_URLS is the full list.
  FRONTEND_URL: FRONTEND_URLS[0],
  FRONTEND_URLS,
};
