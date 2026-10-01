import crypto from "node:crypto";
import type { Express, Request, RequestHandler, Response } from "express";
import {
  deliverTemporaryPasswordWithRollback,
  normalizeAdminEmail,
  normalizeAdminMarketAssignments,
} from "./admin-account-management";
import type { AdminAuthenticatedRequest } from "./admin-auth";

type AdminAccount = {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isAdmin?: boolean | null;
  isSuspended?: boolean | null;
  twoFactorEnabled?: boolean | null;
  adminMarkets?: string[] | null;
  password?: string;
  twoFactorSecret?: unknown;
  twoFactorBackupCodes?: unknown;
};

type AccountUpdate = {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  adminMarkets?: string[];
  password?: string;
};

export interface AdminAccountManagementRouteDependencies {
  authenticateAdmin: RequestHandler;
  listAdminAccounts: (scope: { isSuperAdmin: boolean; adminId: number }) => Promise<AdminAccount[]>;
  getAdminAccount: (id: number) => Promise<AdminAccount | undefined>;
  findAccountIdByEmail: (email: string) => Promise<number | undefined>;
  updateAdminAccount: (id: number, changes: AccountUpdate) => Promise<AdminAccount>;
  suspendAdminAccount: (
    targetId: number,
    callerId: number,
    isSuspended: boolean,
  ) => Promise<{ status: number; message?: string; account?: AdminAccount }>;
  hashPassword: (password: string) => Promise<string>;
  comparePassword: (password: string, hash: string) => Promise<boolean>;
  replacePasswordIfUnchanged: (
    id: number,
    previousHash: string,
    nextHash: string,
  ) => Promise<boolean>;
  restorePasswordIfCurrent: (
    id: number,
    temporaryHash: string,
    previousHash: string,
  ) => Promise<void>;
  sendTemporaryPasswordEmail: (
    req: Request,
    account: AdminAccount,
    password: string,
  ) => Promise<boolean>;
}

function publicAdminAccount(account: AdminAccount) {
  const adminMarkets = account.adminMarkets || [];
  return {
    id: account.id,
    email: account.email,
    firstName: account.firstName ?? null,
    lastName: account.lastName ?? null,
    adminMarkets,
    twoFactorEnabled: Boolean(account.twoFactorEnabled),
    isSuspended: Boolean(account.isSuspended),
    isSuperAdmin: adminMarkets.length === 0,
  };
}

function publicProfile(account: AdminAccount) {
  return {
    id: account.id,
    email: account.email,
    firstName: account.firstName ?? null,
    lastName: account.lastName ?? null,
    twoFactorEnabled: Boolean(account.twoFactorEnabled),
    adminMarkets: account.adminMarkets || [],
    isSuspended: Boolean(account.isSuspended),
  };
}

function positiveAccountId(rawId: string): number | null {
  const id = Number.parseInt(rawId, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function registerAdminAccountManagementRoutes(
  app: Express,
  dependencies: AdminAccountManagementRouteDependencies,
): void {
  app.get("/admin/api/profile", dependencies.authenticateAdmin, async (req: AdminAuthenticatedRequest, res: Response) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "Admin authentication required" });
      }
      res.setHeader("Cache-Control", "private, no-store");
      return res.json(publicProfile(req.admin));
    } catch (error) {
      console.error("Get admin profile error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/admin/api/profile", dependencies.authenticateAdmin, async (req: AdminAuthenticatedRequest, res: Response) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "Admin authentication required" });
      }

      const body = req.body || {};
      const updateData: AccountUpdate = {};
      for (const field of ["firstName", "lastName"] as const) {
        if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
        const value = body[field];
        if (value !== null && typeof value !== "string") {
          return res.status(400).json({ message: `${field} must be text` });
        }
        const normalized = typeof value === "string" ? value.trim() : "";
        if (normalized.length > 100) {
          return res.status(400).json({ message: `${field} is too long` });
        }
        updateData[field] = normalized || null;
      }

      let emailChanged = false;
      if (body.email !== undefined) {
        const email = normalizeAdminEmail(body.email);
        if (!email) {
          return res.status(400).json({ message: "Enter a valid email address" });
        }
        emailChanged = email !== String(req.admin.email || "").toLowerCase();
        updateData.email = email;
      }

      const hasNewPassword = typeof body.newPassword === "string" && body.newPassword.length > 0;
      if (body.newPassword !== undefined && body.newPassword !== null
        && typeof body.newPassword !== "string") {
        return res.status(400).json({ message: "New password must be text" });
      }
      if (hasNewPassword && (body.newPassword.length < 12 || body.newPassword.length > 200)) {
        return res.status(400).json({ message: "New password must be between 12 and 200 characters" });
      }

      if (emailChanged || hasNewPassword) {
        if (typeof body.currentPassword !== "string" || !body.currentPassword) {
          return res.status(400).json({ message: "Enter your current password to change your email or password" });
        }
        if (!await dependencies.comparePassword(body.currentPassword, String(req.admin.password || ""))) {
          return res.status(400).json({ message: "Current password is incorrect" });
        }
      }

      if (emailChanged) {
        const existingId = await dependencies.findAccountIdByEmail(updateData.email!);
        if (existingId !== undefined && existingId !== req.admin.id) {
          return res.status(409).json({ message: "An account already uses this email address" });
        }
      }

      if (hasNewPassword) {
        updateData.password = await dependencies.hashPassword(body.newPassword);
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No profile changes were provided" });
      }

      const updatedAdmin = await dependencies.updateAdminAccount(req.admin.id, updateData);
      res.setHeader("Cache-Control", "private, no-store");
      return res.json({
        message: "Profile updated successfully",
        admin: publicProfile(updatedAdmin),
      });
    } catch (error) {
      if ((error as { code?: string })?.code === "23505") {
        return res.status(409).json({ message: "An account already uses this email address" });
      }
      console.error("Update admin profile error:", error);
      return res.status(500).json({ message: "Failed to update admin profile" });
    }
  });

  app.get("/admin/api/admin-users", dependencies.authenticateAdmin, async (req: AdminAuthenticatedRequest, res: Response) => {
    try {
      const accounts = await dependencies.listAdminAccounts({
        isSuperAdmin: req.isSuperAdmin === true,
        adminId: req.adminId ?? -1,
      });
      const visibleAccounts = req.isSuperAdmin
        ? accounts
        : accounts.filter((account) => account.id === req.adminId);
      res.setHeader("Cache-Control", "private, no-store");
      return res.json({ admins: visibleAccounts.map(publicAdminAccount) });
    } catch (error) {
      console.error("Get admin accounts error:", error);
      return res.status(500).json({ message: "Failed to fetch admin accounts" });
    }
  });

  app.put("/admin/api/admin-users/:id", dependencies.authenticateAdmin, async (req: AdminAuthenticatedRequest, res: Response) => {
    try {
      const userId = positiveAccountId(req.params.id);
      if (userId === null) {
        return res.status(400).json({ message: "Invalid admin account ID" });
      }
      if (!req.isSuperAdmin && userId !== req.adminId) {
        return res.status(403).json({ message: "Only superadmins can edit other admin accounts" });
      }

      const target = await dependencies.getAdminAccount(userId);
      if (!target || !target.isAdmin) {
        return res.status(404).json({ message: "Admin account not found" });
      }

      const body = req.body || {};
      const updateData: AccountUpdate = {};
      for (const field of ["firstName", "lastName"] as const) {
        if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
        const value = body[field];
        if (value !== null && typeof value !== "string") {
          return res.status(400).json({ message: `${field} must be text` });
        }
        const normalized = typeof value === "string" ? value.trim() : "";
        if (normalized.length > 100) {
          return res.status(400).json({ message: `${field} is too long` });
        }
        updateData[field] = normalized || null;
      }

      if (body.email !== undefined) {
        const email = normalizeAdminEmail(body.email);
        if (!email) {
          return res.status(400).json({ message: "Enter a valid email address" });
        }
        if (!req.isSuperAdmin) {
          if (typeof body.currentPassword !== "string" || !body.currentPassword) {
            return res.status(400).json({ message: "Enter your current password to change your email" });
          }
          if (!await dependencies.comparePassword(body.currentPassword, String(target.password || ""))) {
            return res.status(400).json({ message: "Current password is incorrect" });
          }
        }
        const existingId = await dependencies.findAccountIdByEmail(email);
        if (existingId !== undefined && existingId !== target.id) {
          return res.status(409).json({ message: "An account already uses this email address" });
        }
        updateData.email = email;
      }

      if (body.adminMarkets !== undefined) {
        if (!req.isSuperAdmin) {
          return res.status(403).json({ message: "Only superadmins can change admin market access" });
        }
        const currentMarkets = (target.adminMarkets as string[] | null) || [];
        if (currentMarkets.length === 0) {
          return res.status(400).json({ message: "Superadmin market access cannot be changed here" });
        }
        const adminMarkets = normalizeAdminMarketAssignments(body.adminMarkets);
        if (!adminMarkets) {
          return res.status(400).json({ message: "Select at least one valid market" });
        }
        updateData.adminMarkets = adminMarkets;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No account changes were provided" });
      }

      const updatedAccount = await dependencies.updateAdminAccount(userId, updateData);
      res.setHeader("Cache-Control", "private, no-store");
      return res.json({
        message: "Admin account updated successfully",
        admin: publicAdminAccount(updatedAccount),
      });
    } catch (error) {
      if ((error as { code?: string })?.code === "23505") {
        return res.status(409).json({ message: "An account already uses this email address" });
      }
      console.error("Update admin account error:", error);
      return res.status(500).json({ message: "Failed to update admin account" });
    }
  });

  app.patch("/admin/api/admin-users/:id/suspension", dependencies.authenticateAdmin, async (req: AdminAuthenticatedRequest, res: Response) => {
    try {
      if (!req.isSuperAdmin) {
        return res.status(403).json({ message: "Only superadmins can suspend admin accounts" });
      }
      const userId = positiveAccountId(req.params.id);
      const nextSuspended = req.body?.isSuspended;
      if (userId === null || typeof nextSuspended !== "boolean") {
        return res.status(400).json({ message: "A valid account ID and suspension state are required" });
      }

      const result = await dependencies.suspendAdminAccount(userId, req.adminId ?? -1, nextSuspended);
      if (!result.account) {
        return res.status(result.status).json({ message: result.message || "Admin account not found" });
      }
      res.setHeader("Cache-Control", "private, no-store");
      return res.status(result.status).json({
        message: result.account.isSuspended ? "Admin account suspended" : "Admin account reactivated",
        admin: publicAdminAccount(result.account),
      });
    } catch (error) {
      console.error("Change admin suspension error:", error);
      return res.status(500).json({ message: "Failed to change admin account status" });
    }
  });

  app.post("/admin/api/admin-users/:id/reset-password", dependencies.authenticateAdmin, async (req: AdminAuthenticatedRequest, res: Response) => {
    try {
      if (!req.isSuperAdmin) {
        return res.status(403).json({ message: "Only superadmins can reset admin passwords" });
      }
      const userId = positiveAccountId(req.params.id);
      if (userId === null) {
        return res.status(400).json({ message: "Invalid admin account ID" });
      }

      const target = await dependencies.getAdminAccount(userId);
      if (!target || !target.isAdmin) {
        return res.status(404).json({ message: "Admin account not found" });
      }

      const previousHash = String(target.password || "");
      const temporaryPassword = crypto.randomBytes(24).toString("base64url");
      const temporaryHash = await dependencies.hashPassword(temporaryPassword);
      const replaced = await dependencies.replacePasswordIfUnchanged(userId, previousHash, temporaryHash);
      if (!replaced) {
        return res.status(409).json({ message: "The account changed. Refresh and try again." });
      }

      const emailSent = await deliverTemporaryPasswordWithRollback(
        () => dependencies.sendTemporaryPasswordEmail(req, target, temporaryPassword),
        () => dependencies.restorePasswordIfCurrent(userId, temporaryHash, previousHash),
      );
      if (!emailSent) {
        return res.status(502).json({ message: "The temporary password could not be emailed; the previous password remains active" });
      }

      res.setHeader("Cache-Control", "private, no-store");
      return res.json({ message: "A temporary password was sent to the admin's email address" });
    } catch (error) {
      console.error("Reset admin password error:", error);
      return res.status(500).json({ message: "Failed to reset admin password" });
    }
  });
}