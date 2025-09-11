import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import type { User } from '@shared/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';

export interface AuthRequest extends Request {
  user?: User;
}

export function generateTokens(user: User) {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await storage.getUser(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid or inactive user' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
}

export function requireRole(role: 'ADMIN' | 'MANAGER') {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role !== role && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}

export async function requireParkAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role === 'ADMIN') {
    return next();
  }

  const parkId = req.params.parkId || req.body.parkId;
  if (!parkId) {
    return res.status(400).json({ message: 'Park ID required' });
  }

  const assignments = await storage.getManagerAssignments(req.user.id, parkId);
  if (assignments.length === 0) {
    return res.status(403).json({ message: 'Access denied to this park' });
  }

  next();
}

export async function requireLotAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role === 'ADMIN') {
    return next();
  }

  const lotId = req.params.lotId || req.body.lotId;
  if (!lotId) {
    return res.status(400).json({ message: 'Lot ID required' });
  }

  const lot = await storage.getLot(lotId);
  if (!lot) {
    return res.status(404).json({ message: 'Lot not found' });
  }

  const assignments = await storage.getManagerAssignments(req.user.id, lot.parkId);
  if (assignments.length === 0) {
    return res.status(403).json({ message: 'Access denied to this lot' });
  }

  next();
}
