import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import crypto from "node:crypto";
import {
  marketingProspectListContacts,
  marketingProspectLists,
  marketingProspects,
  marketingSegments,
  vouchers,
  type MarketingProspectList,
  type MarketingProspect,
} from "@shared/schema";
import { db } from "./db";
import type { ProspectCsvRow } from "./prospect-csv";

export const DOCUMENTED_B2B_CONTACT_BASIS = "documented_b2b_basis";

export type ProspectListSummary = Pick<
  MarketingProspectList,
  "id" | "name" | "market" | "sourceFile" | "contactBasis" | "totalContacts" | "createdAt"
> & {
  invitationEligible: number;
  newsletterSubscribers: number;
  unsubscribed: number;
};

export async function listProspectLists(market = "fr"): Promise<ProspectListSummary[]> {
  const rows = await db.select({
    id: marketingProspectLists.id,
    name: marketingProspectLists.name,
    market: marketingProspectLists.market,
    sourceFile: marketingProspectLists.sourceFile,
    contactBasis: marketingProspectLists.contactBasis,
    totalContacts: marketingProspectLists.totalContacts,
    createdAt: marketingProspectLists.createdAt,
    invitationEligible: sql<number>`count(*) filter (
      where ${marketingProspects.subscriptionStatus} = 'not_subscribed'
        and ${marketingProspects.invitationSentAt} is null
        and ${marketingProspects.unsubscribedAt} is null
    )::int`,
    newsletterSubscribers: sql<number>`count(*) filter (
      where ${marketingProspects.subscriptionStatus} = 'subscribed'
        and ${marketingProspects.newsletterConsentAt} is not null
        and ${marketingProspects.unsubscribedAt} is null
    )::int`,
    unsubscribed: sql<number>`count(*) filter (
      where ${marketingProspects.subscriptionStatus} = 'unsubscribed'
        or ${marketingProspects.unsubscribedAt} is not null
    )::int`,
  })
    .from(marketingProspectLists)
    .leftJoin(
      marketingProspectListContacts,
      eq(marketingProspectListContacts.listId, marketingProspectLists.id),
    )
    .leftJoin(
      marketingProspects,
      eq(marketingProspectListContacts.prospectId, marketingProspects.id),
    )
    .where(eq(marketingProspectLists.market, market))
    .groupBy(marketingProspectLists.id)
    .orderBy(desc(marketingProspectLists.createdAt));
  return rows.map((row) => ({
    ...row,
    invitationEligible: Number(row.invitationEligible || 0),
    newsletterSubscribers: Number(row.newsletterSubscribers || 0),
    unsubscribed: Number(row.unsubscribed || 0),
  }));
}

export async function importProspectList(data: {
  name: string;
  sourceFile: string;
  rows: ProspectCsvRow[];
  adminId?: number;
}): Promise<{ list: MarketingProspectList; createdContacts: number; existingContacts: number }> {
  if (!data.rows.length) throw new Error("No valid email addresses were found");
  const now = new Date();

  return db.transaction(async (tx) => {
    const [list] = await tx.insert(marketingProspectLists).values({
      name: data.name.trim().slice(0, 160),
      market: "fr",
      sourceFile: data.sourceFile.replace(/[\r\n"]/g, "").slice(0, 255) || "contacts.csv",
      contactBasis: DOCUMENTED_B2B_CONTACT_BASIS,
      basisConfirmedAt: now,
      basisConfirmedBy: data.adminId ?? null,
      totalContacts: data.rows.length,
    }).returning();
    if (!list) throw new Error("Prospect list could not be created");

    let createdContacts = 0;
    for (let offset = 0; offset < data.rows.length; offset += 250) {
      const batch = data.rows.slice(offset, offset + 250);
      const emails = batch.map((row) => row.email);
      const existingRows = await tx.select({ email: marketingProspects.email })
        .from(marketingProspects)
        .where(and(
          eq(marketingProspects.market, "fr"),
          inArray(marketingProspects.email, emails),
        ));
      const existingEmails = new Set(existingRows.map((row) => row.email));
      createdContacts += batch.filter((row) => !existingEmails.has(row.email)).length;

      const prospects = await tx.insert(marketingProspects).values(batch.map((row) => ({
        email: row.email,
        market: "fr",
        restaurantName: row.restaurantName,
        city: row.city,
        address: row.address,
        phone: row.phone,
        website: row.website,
        foodSafetyNote: row.foodSafetyNote,
        legalRepresentative: row.legalRepresentative,
        siret: row.siret,
        source: row.source,
      }))).onConflictDoUpdate({
        target: [marketingProspects.email, marketingProspects.market],
        set: {
          restaurantName: sql`COALESCE(NULLIF(EXCLUDED.restaurant_name, ''), ${marketingProspects.restaurantName})`,
          city: sql`COALESCE(NULLIF(EXCLUDED.city, ''), ${marketingProspects.city})`,
          address: sql`COALESCE(NULLIF(EXCLUDED.address, ''), ${marketingProspects.address})`,
          phone: sql`COALESCE(NULLIF(EXCLUDED.phone, ''), ${marketingProspects.phone})`,
          website: sql`COALESCE(NULLIF(EXCLUDED.website, ''), ${marketingProspects.website})`,
          foodSafetyNote: sql`COALESCE(NULLIF(EXCLUDED.food_safety_note, ''), ${marketingProspects.foodSafetyNote})`,
          legalRepresentative: sql`COALESCE(NULLIF(EXCLUDED.legal_representative, ''), ${marketingProspects.legalRepresentative})`,
          siret: sql`COALESCE(NULLIF(EXCLUDED.siret, ''), ${marketingProspects.siret})`,
          source: sql`COALESCE(NULLIF(EXCLUDED.source, ''), ${marketingProspects.source})`,
          updatedAt: now,
        },
      }).returning({ id: marketingProspects.id });

      await tx.insert(marketingProspectListContacts).values(
        prospects.map((prospect) => ({ listId: list.id, prospectId: prospect.id })),
      ).onConflictDoNothing();
    }

    const invitationCriteria = {
      market: "fr" as const,
      prospectListId: list.id,
      prospectAudience: "invitation" as const,
    };
    const newsletterCriteria = {
      market: "fr" as const,
      prospectListId: list.id,
      prospectAudience: "newsletter" as const,
    };
    await tx.insert(marketingSegments).values([
      {
        name: `${list.name} — Invitation`,
        market: "fr",
        criteria: invitationCriteria,
        createdBy: data.adminId ?? null,
      },
      {
        name: `${list.name} — Newsletter`,
        market: "fr",
        criteria: newsletterCriteria,
        createdBy: data.adminId ?? null,
      },
    ]);

    return {
      list,
      createdContacts,
      existingContacts: data.rows.length - createdContacts,
    };
  });
}

export async function getProspectById(
  prospectId: number,
): Promise<MarketingProspect | undefined> {
  const [prospect] = await db.select().from(marketingProspects)
    .where(and(eq(marketingProspects.id, prospectId), eq(marketingProspects.market, "fr")))
    .limit(1);
  return prospect;
}

export async function markProspectInvitationSent(prospectId: number): Promise<void> {
  await db.update(marketingProspects)
    .set({ invitationSentAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(marketingProspects.id, prospectId),
      eq(marketingProspects.market, "fr"),
      eq(marketingProspects.subscriptionStatus, "not_subscribed"),
      isNull(marketingProspects.unsubscribedAt),
    ));
}

export async function unsubscribeProspect(prospectId: number): Promise<void> {
  await db.update(marketingProspects)
    .set({
      subscriptionStatus: "unsubscribed",
      unsubscribedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(
      eq(marketingProspects.id, prospectId),
      eq(marketingProspects.market, "fr"),
    ));
}

export async function subscribeProspectAndCreateVoucher(
  prospectId: number,
): Promise<{ prospect: MarketingProspect; voucher: typeof vouchers.$inferSelect; alreadySubscribed: boolean }> {
  return db.transaction(async (tx) => {
    const [prospect] = await tx.select().from(marketingProspects)
      .where(and(eq(marketingProspects.id, prospectId), eq(marketingProspects.market, "fr")))
      .limit(1)
      .for("update");
    if (!prospect) throw new Error("Prospect not found");
    if (prospect.subscriptionStatus === "unsubscribed" || prospect.unsubscribedAt) {
      throw new Error("This address has unsubscribed");
    }
    if (prospect.newsletterVoucherId) {
      const [existingVoucher] = await tx.select().from(vouchers)
        .where(eq(vouchers.id, prospect.newsletterVoucherId))
        .limit(1);
      if (!existingVoucher) throw new Error("Newsletter voucher was not found");
      return { prospect, voucher: existingVoucher, alreadySubscribed: true };
    }

    const now = new Date();
    const validUntil = new Date(now);
    validUntil.setMonth(validUntil.getMonth() + 12);
    let createdVoucher: typeof vouchers.$inferSelect | undefined;
    for (let attempt = 0; attempt < 5 && !createdVoucher; attempt++) {
      const code = `NEWS20-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
      const [inserted] = await tx.insert(vouchers).values({
        code,
        name: "Newsletter xHACCP France -20%",
        discountType: "percentage",
        discountValue: "20.00",
        minOrderAmount: null,
        maxUses: 1,
        isActive: true,
        validFrom: now,
        validUntil,
        marketCode: "fr",
      }).onConflictDoNothing({ target: vouchers.code }).returning();
      createdVoucher = inserted;
    }
    if (!createdVoucher) throw new Error("Could not create a unique newsletter voucher");

    const [updated] = await tx.update(marketingProspects).set({
      subscriptionStatus: "subscribed",
      newsletterConsentAt: now,
      newsletterConsentVersion: "fr-newsletter-v1",
      newsletterVoucherId: createdVoucher.id,
      updatedAt: now,
    }).where(eq(marketingProspects.id, prospectId)).returning();
    if (!updated) throw new Error("Newsletter subscription could not be saved");
    return { prospect: updated, voucher: createdVoucher, alreadySubscribed: false };
  });
}

export async function markProspectVoucherEmailSent(prospectId: number): Promise<void> {
  await db.update(marketingProspects)
    .set({ voucherEmailSentAt: new Date(), updatedAt: new Date() })
    .where(eq(marketingProspects.id, prospectId));
}

