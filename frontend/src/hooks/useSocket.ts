'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    if (s.connected) setIsConnected(true);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  const joinRoom = useCallback((event: string, id: string) => {
    socketRef.current?.emit(event, id);
  }, []);

  const on = useCallback(<T = unknown>(event: string, cb: (data: T) => void) => {
    socketRef.current?.on(event, cb);
    return () => { socketRef.current?.off(event, cb); };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { isConnected, joinRoom, on, emit };
}
