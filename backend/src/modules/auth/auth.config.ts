import { betterAuth, BetterAuthOptions } from 'better-auth';
import { Pool } from 'pg';
import { env } from '../../config/env';

// Create a pg Pool directly — the { provider, url } config format is NOT supported
// by better-auth v1.6. Pass the Pool instance instead.
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase pooler uses a self-signed cert
  max: 10,
  idleTimeoutMillis: 30000,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let auth: any;

try {
  auth = betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: pool, // ✅ Pass the Pool instance directly
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          defaultValue: 'patient',
          required: false,
        },
        phone: {
          type: 'string',
          required: false,
        },
      },
    },
    trustedOrigins: env.FRONTEND_URLS,
  });
  console.log('✅ Better Auth initialized');
} catch (err) {
  console.error('❌ Better Auth failed to initialize:', (err as Error).message);
  console.error('   → Run: npm run migrate\n   → Then restart: npm run dev');
  auth = {} as ReturnType<typeof betterAuth>;
}

export { auth };
