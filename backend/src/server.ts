/**
 * Eve Monolith Server
 * 
 * Unified server combining all Eve services into a single application
 * Feature flag: USE_MONOLITH=true
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';

// Shared infrastructure
import { connectDatabase, disconnectDatabase, checkDatabaseHealth } from './database/client.js';
import { setSocketIO, getStats } from './shared/state.ts';
import { errorHandler, notFoundHandler } from './shared/middleware.js';

// Initialize tracing if enabled
import { initTracing } from '@eve/shared';
if (process.env.ENABLE_TRACING === 'true') {
  initTracing('eve-monolith');
}

// Module routers
import { authRouter } from './modules/auth/routes.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create Express app
const app = express();

// Create HTTP server
const httpServer = createServer(app);

// Create Socket.IO server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Register Socket.IO in shared state
setSocketIO(io);

// Middleware
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbHealthy = await checkDatabaseHealth();
  const stats = getStats();

  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? 'ok' : 'degraded',
    service: 'eve-monolith',
    timestamp: new Date().toISOString(),
    uptime: stats.uptime,
    activeConnections: stats.activeConnections,
    database: dbHealthy ? 'connected' : 'disconnected',
  });
});

// Metrics endpoint (Prometheus)
app.get('/metrics', async (req, res) => {
  const { getMetrics } = await import('@eve/shared');
  const metrics = await getMetrics();
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

// Mount module routers
app.use('/api/auth', authRouter);
// app.use('/api/rider', rideRouter);
// app.use('/api/driver', rideRouter);
// app.use('/api/admin', adminRouter);
// app.use('/api/payment', paymentRouter);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`[socket.io] Client connected: ${socket.id}`);
  
  // Authenticate socket connection
  const token = socket.handshake.query.token as string;
  if (!token) {
    console.warn(`[socket.io] Connection ${socket.id} missing auth token`);
    socket.disconnect();
    return;
  }

  try {
    const { verifyAccessToken } = require('@eve/shared');
    const payload = verifyAccessToken(token);
    
    // Join user-specific room
    const userRoom = `${payload.role.toLowerCase()}:${payload.userId}`;
    socket.join(userRoom);
    console.log(`[socket.io] ${socket.id} joined room: ${userRoom}`);
    
    // Register in shared state
    const { registerConnection } = require('./shared/state.js');
    registerConnection(payload.userId, socket.id);

    socket.on('disconnect', () => {
      console.log(`[socket.io] Client disconnected: ${socket.id}`);
      const { unregisterConnection } = require('./shared/state.js');
      unregisterConnection(payload.userId);
    });
  } catch (error) {
    console.error(`[socket.io] Auth failed for ${socket.id}:`, error);
    socket.disconnect();
  }
});

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Connect to database
    await connectDatabase();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log('');
      console.log('╔═══════════════════════════════════════╗');
      console.log('║     Eve Monolith Server Started      ║');
      console.log('╚═══════════════════════════════════════╝');
      console.log('');
      console.log(`🚀 HTTP Server:    http://localhost:${PORT}`);
      console.log(`📡 Socket.IO:      http://localhost:${PORT}/socket.io`);
      console.log(`📊 Metrics:        http://localhost:${PORT}/metrics`);
      console.log(`❤️  Health:         http://localhost:${PORT}/health`);
      console.log(`🌍 Environment:    ${NODE_ENV}`);
      console.log(`📦 Version:        1.0.0`);
      console.log('');
      console.log('Feature Flags:');
      console.log(`  USE_MONOLITH:              true`);
      console.log(`  USE_DIRECT_NOTIFY:         ${process.env.USE_DIRECT_NOTIFY || 'false'}`);
      console.log(`  USE_CONSOLIDATED_LOCATION: ${process.env.USE_CONSOLIDATED_LOCATION || 'false'}`);
      console.log(`  ENABLE_TRACING:            ${process.env.ENABLE_TRACING || 'false'}`);
      console.log('');
    });
  } catch (error) {
    console.error('[server] Startup failed:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n[server] Received ${signal}, shutting down gracefully...`);
  
  // Stop accepting new connections
  httpServer.close(() => {
    console.log('[server] HTTP server closed');
  });

  // Close Socket.IO connections
  io.close(() => {
    console.log('[socket.io] All connections closed');
  });

  // Flush async writes
  const { flushWrites } = await import('@eve/shared');
  await flushWrites();
  console.log('[async-writer] Pending writes flushed');

  // Disconnect database
  await disconnectDatabase();

  console.log('[server] Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[server] Uncaught exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled rejection:', reason);
  shutdown('unhandledRejection');
});

// Start the server
start();
