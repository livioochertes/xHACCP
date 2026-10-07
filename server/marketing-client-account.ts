import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { customerPasswordSetupTokens, users, vouchers } from "@shared/schema";

const PASSWORD_SETUP_TTL_MS = 24 * 60 * 60 * 1000;

export function normalizeCustomerEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createOrFindMarketingClientAccount(
  tx: any,
  input: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  },
): Promise<{
  userId: number;
  email: string;
  passwordSetupToken: string | null;
  created: boolean;
}> {
  const email = normalizeCustomerEmail(input.email);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(
    hashtext('marketing-client-account'),
    hashtext(${email})
  )`);

  const [existing] = await tx.select().from(users)
    .where(sql`LOWER(${users.email}) = ${email}`)
    .limit(1)
    .for("update");

  let account = existing;
  let created = false;
  if (!account) {
    const unusablePassword = await bcrypt.hash(crypto.randomBytes(48).toString("base64url"), 10);
    [account] = await tx.insert(users).values({
      email,
      password: unusablePassword,
      passwordSetupRequired: true,
      firstName: input.firstName?.trim().slice(0, 100) || null,
      lastName: input.lastName?.trim().slice(0, 100) || null,
      isAdmin: false,
      isSuspended: false,
    }).returning();
    if (!account) throw new Error("Client account could not be created");
    created = true;
  }

  if (!account.passwordSetupRequired) {
    return { userId: account.id, email: account.email, passwordSetupToken: null, created };
  }

  const now = new Date();
  const passwordSetupToken = crypto.randomBytes(32).toString("base64url");
  await tx.update(customerPasswordSetupTokens)
    .set({ usedAt: now })
    .where(and(
      eq(customerPasswordSetupTokens.userId, account.id),
      isNull(customerPasswordSetupTokens.usedAt),
    ));
  await tx.insert(customerPasswordSetupTokens).values({
    userId: account.id,
    tokenHash: crypto.createHash("sha256").update(passwordSetupToken).digest("hex"),
    expiresAt: new Date(now.getTime() + PASSWORD_SETUP_TTL_MS),
  });

  return {
    userId: account.id,
    email: account.email,
    passwordSetupToken,
    created,
  };
}

export async function attachVoucherToMarketingClient(
  tx: any,
  voucherId: number,
  userId: number,
  ownerEmail: string,
): Promise<void> {
  const email = normalizeCustomerEmail(ownerEmail);
  const [voucher] = await tx.select().from(vouchers)
    .where(eq(vouchers.id, voucherId))
    .limit(1)
    .for("update");
  if (!voucher) throw new Error("Personal voucher was not found");
  if (voucher.ownerUserId !== null && voucher.ownerUserId !== userId) {
    throw new Error("Personal voucher is already assigned to another client");
  }
  if (voucher.ownerEmail && normalizeCustomerEmail(voucher.ownerEmail) !== email) {
    throw new Error("Personal voucher email does not match its client");
  }
  if (voucher.ownerUserId === null || !voucher.ownerEmail) {
    await tx.update(vouchers)
      .set({
        ownerUserId: userId,
        ownerEmail: email,
        updatedAt: new Date(),
      })
      .where(eq(vouchers.id, voucherId));
  }
}

