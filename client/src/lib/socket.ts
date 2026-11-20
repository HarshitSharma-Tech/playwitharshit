import { io, type Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;
let currentToken: string | null = null;

export function connectSocket(token: string): Socket {
  if (socketInstance && currentToken === token) {
    if (!socketInstance.connected) {
      socketInstance.connect();
    }
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
  }

  currentToken = token;
  socketInstance = io({
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 4000,
    transports: ['websocket', 'polling'],
  });

  return socketInstance;
}

export function getSocket(): Socket | null {
  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
    currentToken = null;
  }
}

export function emitAck<TRes = { ok: boolean; error?: string }>(
  event: string,
  payload: unknown = {}
): Promise<TRes> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    if (!s || !s.connected) {
      reject(new Error('Not connected to multiplayer server.'));
      return;
    }
    s.timeout(10000).emit(event, payload, (err: Error | null, response: TRes) => {
      if (err) {
        reject(new Error('Server request timed out. Please try again.'));
        return;
      }
      resolve(response);
    });
  });
}
