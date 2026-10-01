import type { NextFunction, Request, RequestHandler, Response } from "express";
import { isActiveAdminAccount } from "./admin-account-management";

export type AdminAuthAccount = {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isAdmin?: boolean | null;
  isSuspended?: boolean | null;
  adminMarkets?: string[] | null;
  twoFactorEnabled?: boolean | null;
  [key: string]: unknown;
};

export type AdminAuthenticatedRequest = Request & {
  adminId?: number;
  admin?: AdminAuthAccount;
  adminMarkets?: string[];
  isSuperAdmin?: boolean;
};

export type AdminTokenPayload = {
  id?: number;
  adminId?: number;
  [key: string]: unknown;
};

export function createAuthenticateAdmin(dependencies: {
  getAdmin: (id: number) => Promise<AdminAuthAccount | undefined>;
  verifyToken: (token: string) => AdminTokenPayload;
}): RequestHandler {
  return async (req: AdminAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) {
        return res.status(401).json({ message: "Admin authentication required" });
      }

      const decoded = dependencies.verifyToken(token);
      const userId = decoded.id || decoded.adminId;
      if (!userId) {
        return res.status(401).json({ message: "Invalid token structure" });
      }

      const admin = await dependencies.getAdmin(userId);
      if (!admin || !isActiveAdminAccount(admin)) {
        return res.status(401).json({ message: "Admin access denied" });
      }

      const adminMarkets = (admin.adminMarkets as string[] | null | undefined) || [];
      req.adminId = userId;
      req.admin = admin;
      req.adminMarkets = adminMarkets;
      req.isSuperAdmin = adminMarkets.length === 0;
      return next();
    } catch {
      return res.status(401).json({ message: "Invalid admin token" });
    }
  };
}

export function createAdminLoginHandler(dependencies: {
  getAdminByEmail: (email: string) => Promise<AdminAuthAccount | undefined>;
  comparePassword: (password: string, hash: string) => Promise<boolean>;
  signToken: (
    payload: Record<string, unknown>,
    options: { expiresIn: "10m" | "24h" },
  ) => string;
}): RequestHandler {
  return async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const admin = await dependencies.getAdminByEmail(email);
      if (!admin || !isActiveAdminAccount(admin)) {
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      if (!await dependencies.comparePassword(password, String(admin.password || ""))) {
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      if (admin.twoFactorEnabled) {
        const tempToken = dependencies.signToken(
          { adminId: admin.id, stage: "2fa_required" },
          { expiresIn: "10m" },
        );
        return res.json({
          message: "2FA verification required",
          tempToken,
          requiresTwoFactor: true,
        });
      }

      const token = dependencies.signToken(
        { adminId: admin.id, adminMarkets: admin.adminMarkets || [] },
        { expiresIn: "24h" },
      );
      return res.json({
        message: "Admin login successful",
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          twoFactorEnabled: admin.twoFactorEnabled,
          adminMarkets: admin.adminMarkets || [],
        },
      });
    } catch (error) {
      console.error("Admin login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
}