/**
 * Auth Module Routes
 * 
 * Handles authentication and user management
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../database/client.js';
import { 
  createAccessToken, 
  hashPassword, 
  verifyPassword,
  fail 
} from '@eve/shared';
import { requireAuth, type AuthRequest } from '../../shared/middleware.js';
import { authLimiter, authenticatedLimiter } from '../../shared/rate-limit.js';
import { publishAuthEvent } from './events.js';

export const authRouter = Router();

/**
 * POST /api/auth/privy - Rider Privy authentication
 */
authRouter.post('/privy', authLimiter, async (req: Request, res: Response) => {
  try {
    const { identityToken } = req.body;
    
    if (!identityToken) {
      return res.status(400).json({ error: 'identityToken required' });
    }

    // Verify with Privy (simplified - actual implementation uses @privy-io/node)
    // const privyUser = await privyClient.users().get({ id_token: identityToken });
    
    // For now, create/find user
    let user = await prisma.user.findFirst({
      where: { email: req.body.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: req.body.email,
          role: 'RIDER',
          accountStatus: 'ACTIVE',
        },
      });

      await prisma.riderProfile.create({
        data: { userId: user.id },
      });

      await publishAuthEvent('auth:user.registered', user.id, {
        role: 'RIDER',
        email: user.email,
      });
    }

    const accessToken = createAccessToken({
      userId: user.id,
      role: user.role,
      session: 'rider',
    });

    res.json({ accessToken, user });
  } catch (error) {
    console.error('[auth] Privy auth failed:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * POST /api/auth/driver/privy - Driver Privy authentication
 */
authRouter.post('/driver/privy', authLimiter, async (req: Request, res: Response) => {
  try {
    const { identityToken } = req.body;
    
    if (!identityToken) {
      return res.status(400).json({ error: 'identityToken required' });
    }

    let user = await prisma.user.findFirst({
      where: { email: req.body.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: req.body.email,
          role: 'DRIVER',
          accountStatus: 'ACTIVE',
        },
      });

      await prisma.driverProfile.create({
        data: {
          userId: user.id,
          approvalStatus: 'PENDING',
          presence: 'OFFLINE',
        },
      });

      await publishAuthEvent('auth:user.registered', user.id, {
        role: 'DRIVER',
        email: user.email,
      });
    }

    const accessToken = createAccessToken({
      userId: user.id,
      role: user.role,
      session: 'driver',
    });

    res.json({ accessToken, user });
  } catch (error) {
    console.error('[auth] Driver Privy auth failed:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * POST /api/auth/admin/login - Admin email/password login
 */
authRouter.post('/admin/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { adminStaff: true },
    });

    if (!user || !user.adminStaff || !user.adminStaff.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await verifyPassword(password, user.adminStaff.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = createAccessToken({
      userId: user.id,
      role: user.role,
      session: 'admin',
    });

    res.json({ accessToken, user });
  } catch (error) {
    console.error('[auth] Admin login failed:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * GET /api/auth/me - Get current user
 */
authRouter.get('/me', authenticatedLimiter, requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        riderProfile: true,
        driverProfile: true,
        adminStaff: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('[auth] Get user failed:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * PATCH /api/auth/me - Update current user
 */
authRouter.patch('/me', authenticatedLimiter, requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { name, phone },
    });

    res.json({ user });
  } catch (error) {
    console.error('[auth] Update user failed:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});
