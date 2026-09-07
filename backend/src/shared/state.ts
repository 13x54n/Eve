/**
 * Shared Application State
 * 
 * Single source of truth for shared state across monolith modules
 */

import type { Server as SocketIOServer } from 'socket.io';

interface AppState {
  io: SocketIOServer | null;
  activeConnections: Map<string, string>; // userId -> socketId
  startTime: Date;
}

/**
 * Global application state
 */
export const appState: AppState = {
  io: null,
  activeConnections: new Map(),
  startTime: new Date(),
};

/**
 * Set Socket.IO instance
 */
export function setSocketIO(io: SocketIOServer): void {
  appState.io = io;
  console.log('[state] Socket.IO instance registered');
}

/**
 * Get Socket.IO instance
 */
export function getSocketIO(): SocketIOServer | null {
  return appState.io;
}

/**
 * Register active connection
 */
export function registerConnection(userId: string, socketId: string): void {
  appState.activeConnections.set(userId, socketId);
}

/**
 * Unregister active connection
 */
export function unregisterConnection(userId: string): void {
  appState.activeConnections.delete(userId);
}

/**
 * Get connection for user
 */
export function getConnection(userId: string): string | undefined {
  return appState.activeConnections.get(userId);
}

/**
 * Get all active connections
 */
export function getAllConnections(): Map<string, string> {
  return appState.activeConnections;
}

/**
 * Get app uptime in seconds
 */
export function getUptime(): number {
  return Math.floor((Date.now() - appState.startTime.getTime()) / 1000);
}

/**
 * Get app statistics
 */
export function getStats() {
  return {
    uptime: getUptime(),
    activeConnections: appState.activeConnections.size,
    hasSocketIO: appState.io !== null,
    startTime: appState.startTime.toISOString(),
  };
}
