/**
 * Shared Database Client
 * 
 * Single Prisma instance for all modules
 */

import { PrismaClient } from '@eve/db';

/**
 * Singleton Prisma client
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

/**
 * Connect to database
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('[database] Connected to PostgreSQL');
  } catch (error) {
    console.error('[database] Connection failed:', error);
    throw error;
  }
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('[database] Disconnected from PostgreSQL');
}

/**
 * Health check
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('[database] Health check failed:', error);
    return false;
  }
}
