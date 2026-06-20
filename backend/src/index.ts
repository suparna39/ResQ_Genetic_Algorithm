// Must be set BEFORE any modules load — Supabase pooler uses a self-signed cert
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { env } from './config/env';
import { initSocket } from './sockets/socket';
import { errorHandler } from './middleware/errorHandler';

// ── Route Imports ──────────────────────────────────────────────────────────────
import authRoutes from './modules/auth/auth.routes';
import emergencyRoutes from './modules/emergency/emergency.routes';
import ambulanceRoutes from './modules/ambulance/ambulance.routes';
import assignmentRoutes from './modules/assignment/assignment.routes';
import trackingRoutes from './modules/tracking/tracking.routes';
import adminRoutes from './modules/admin/admin.routes';

const app = express();
const httpServer = http.createServer(app);

// ── Middleware ──────────────────────────────────────────────────────────────────
// Allow the configured frontend origin(s). Supports a comma-separated list so a
// Vercel production domain + preview deployments can all be permitted. Requests
// with no Origin header (curl, server-to-server, health checks) are also allowed.
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.FRONTEND_URLS.includes(origin.replace(/\/$/, ''))) {
        return callback(null, true);
      }
      // Allow any *.vercel.app preview deployment by default.
      if (/\.vercel\.app$/.test(new URL(origin).hostname)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Socket.IO ───────────────────────────────────────────────────────────────────
initSocket(httpServer);

// ── Health Check ────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/ambulance', ambulanceRoutes);
app.use('/api/assignment', assignmentRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/admin', adminRoutes);

// ── 404 Handler ─────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ── Global Error Handler ────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ────────────────────────────────────────────────────────────────
httpServer.listen(env.PORT, () => {
  console.log(`\n🚑 AI Ambulance Backend running on port ${env.PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   Health: http://localhost:${env.PORT}/health\n`);
});

export default app;
