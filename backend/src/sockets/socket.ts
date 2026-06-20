import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';

let io: Server;

export const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || env.FRONTEND_URLS.includes(origin.replace(/\/$/, ''))) {
          return callback(null, true);
        }
        try {
          if (/\.vercel\.app$/.test(new URL(origin).hostname)) return callback(null, true);
        } catch {
          /* ignore malformed origin */
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── Room joining ────────────────────────────────────────────────
    // Patient joins their personal room to receive assignment updates
    socket.on('join:patient', (patient_id: string) => {
      socket.join(`patient:${patient_id}`);
      console.log(`Patient ${patient_id} joined room`);
    });

    // Driver joins their personal room by user_id (for direct notifications)
    socket.on('join:driver', (user_id: string) => {
      socket.join(`driver:${user_id}`);
      // Also join the global drivers room for broadcast fallback
      socket.join('drivers');
      console.log(`Driver ${user_id} joined room driver:${user_id} + drivers`);
    });

    // Both patient & driver join the assignment room for tracking
    socket.on('join:assignment', (assignment_id: string) => {
      socket.join(`assignment:${assignment_id}`);
      console.log(`User joined assignment room: ${assignment_id}`);
    });

    // Admin joins broadcast room
    socket.on('join:admin', () => {
      socket.join('admin');
      console.log(`Admin joined global room`);
    });

    // ── Driver location broadcast ───────────────────────────────────
    // Drivers can also emit location directly via socket (in addition to REST)
    socket.on(
      'driver:location_update',
      async (data: { assignment_id: string; latitude: number; longitude: number }) => {
        // Relay to room subscribers immediately (don't await DB)
        io.to(`assignment:${data.assignment_id}`).emit('driver:location_update', {
          ...data,
          timestamp: new Date().toISOString(),
        });
        io.to('admin').emit('driver:location_update', data);

        // Persist to ambulances table so patients who load the page AFTER the driver
        // shared their location can still see it via loadData (socket events are ephemeral).
        if (data.assignment_id && data.latitude && data.longitude) {
          try {
            const { data: asnRow } = await supabaseAdmin
              .from('assignments')
              .select('ambulance_id')
              .eq('id', data.assignment_id)
              .single();

            if (asnRow?.ambulance_id) {
              await supabaseAdmin
                .from('ambulances')
                .update({
                  latitude: data.latitude,
                  longitude: data.longitude,
                  last_updated: new Date().toISOString(),
                })
                .eq('id', asnRow.ambulance_id);
            }
          } catch {
            // Non-critical — relay already succeeded above
          }
        }
      }
    );

    // ── Status change relay ─────────────────────────────────────────
    socket.on(
      'request:status_change',
      (data: { assignment_id: string; status: string }) => {
        io.to(`assignment:${data.assignment_id}`).emit(
          'request:status_change',
          data
        );
        io.to('admin').emit('request:status_change', data);
      }
    );

    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIo = (): Server => {
  if (!io) throw new Error('Socket.IO not initialized — call initSocket() first');
  return io;
};
