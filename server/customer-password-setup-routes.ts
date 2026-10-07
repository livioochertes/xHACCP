import type { Express } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcrypt";
import { and, eq, isNull } from "drizzle-orm";
import { customerPasswordSetupTokens, users } from "@shared/schema";
import { db } from "./db";
import {
  hashPasswordSetupToken,
  isPasswordSetupTokenUsable,
} from "./customer-password-setup";

const passwordSetupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password setup attempts. Please try again later." },
});

export function registerCustomerPasswordSetupRoutes(app: Express): void {
  app.post("/api/auth/password-setup/validate", passwordSetupLimiter, async (req, res) => {
    const hash = hashPasswordSetupToken(req.body?.token);
    if (!hash) return res.status(400).json({ valid: false, message: "This password link is invalid or expired." });
    try {
      const [record] = await db.select({
        expiresAt: customerPasswordSetupTokens.expiresAt,
        usedAt: customerPasswordSetupTokens.usedAt,
      })
        .from(customerPasswordSetupTokens)
        .where(and(
          eq(customerPasswordSetupTokens.tokenHash, hash),
          isNull(customerPasswordSetupTokens.usedAt),
        ))
        .limit(1);
      const valid = Boolean(record && isPasswordSetupTokenUsable(record));
      return res.status(valid ? 200 : 400).json({
        valid,
        message: valid ? undefined : "This password link is invalid or expired.",
      });
    } catch {
      console.error("Password setup link verification failed");
      return res.status(500).json({ valid: false, message: "Unable to verify this link right now." });
    }
  });

  app.post("/api/auth/password-setup", passwordSetupLimiter, async (req, res) => {
    const hash = hashPasswordSetupToken(req.body?.token);
    const password = req.body?.password;
    if (!hash || typeof password !== "string" || password.length < 10 || password.length > 128) {
      return res.status(400).json({ message: "Use a valid link and a password between 10 and 128 characters." });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const changed = await db.transaction(async (tx) => {
        const [record] = await tx.select().from(customerPasswordSetupTokens)
          .where(eq(customerPasswordSetupTokens.tokenHash, hash))
          .limit(1)
          .for("update");
        const now = new Date();
        if (!record || !isPasswordSetupTokenUsable(record, now)) return false;

        const [consumed] = await tx.update(customerPasswordSetupTokens)
          .set({ usedAt: now })
          .where(and(
            eq(customerPasswordSetupTokens.id, record.id),
            isNull(customerPasswordSetupTokens.usedAt),
          ))
          .returning({ id: customerPasswordSetupTokens.id });
        if (!consumed) throw new Error("Password setup token could not be consumed");

        const [account] = await tx.update(users)
          .set({ password: hashedPassword, passwordSetupRequired: false, updatedAt: now })
          .where(eq(users.id, record.userId))
          .returning({ id: users.id });
        if (!account) throw new Error("Password setup account was not found");
        return true;
      });
      if (!changed) return res.status(400).json({ message: "This password link is invalid or expired." });
      return res.json({ success: true });
    } catch {
      console.error("Customer password could not be set");
      return res.status(500).json({ message: "Unable to set your password right now." });
    }
  });
}

