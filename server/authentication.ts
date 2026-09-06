import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { storage } from "./storage";

export const JWT_SIGNING_SECRET: string = process.env.JWT_SECRET || process.env.SESSION_SECRET || (() => {
  throw new Error("JWT_SECRET or SESSION_SECRET must be configured");
})();

export interface AuthRequest extends Request {
  userId?: number;
  isAdmin?: boolean;
  user?: {
    id: number;
    email: string;
    isAdmin?: boolean;
  };
}

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SIGNING_SECRET) as any;
        req.userId = decoded.id;
      } catch (err) {
        // Token invalid — continue as guest
      }
    }
    next();
  } catch (error) {
    next();
  }
};

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      console.log('❌ No token provided in Authorization header');
      return res.status(401).json({ message: "Access token required" });
    }

    console.log('🔍 Attempting to verify token:', token?.substring(0, 20) + '...');

    let decoded: any;
    let isAdminToken = false;

    // Try to decode as regular user token first
    try {
      decoded = jwt.verify(token, JWT_SIGNING_SECRET) as any;
      console.log('✅ Token decoded as user token:', { id: decoded.id, email: decoded.email });
    } catch (err) {
      // Try to decode as admin token
      try {
        decoded = jwt.verify(token, JWT_SIGNING_SECRET) as any;
        if (decoded.adminId) {
          isAdminToken = true;
          decoded.id = decoded.adminId; // Map adminId to id for consistency
        }
      } catch (adminErr) {
        console.log('❌ Token verification failed for both user and admin:', err);
        return res.status(403).json({ message: "Invalid token" });
      }
    }

    // Get user to check admin status
    const user = await storage.getUser(decoded.id);
    if (!user) {
      console.log('❌ User not found for id:', decoded.id);
      return res.status(401).json({ message: "Invalid token" });
    }

    console.log('✅ User found:', { id: user.id, email: user.email, isAdmin: user.isAdmin });
    req.userId = decoded.id;
    req.isAdmin = user.isAdmin || isAdminToken;
    req.user = { id: user.id, email: user.email, isAdmin: user.isAdmin || isAdminToken };
    next();
  } catch (error: any) {
    console.log('❌ Token verification failed:', error.message);
    return res.status(403).json({ message: "Invalid token" });
  }
};