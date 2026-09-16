import { eq } from "drizzle-orm";
import { db } from "./db";
import { wmsOriginAddresses } from "@shared/schema";
import type { SamedayAPI, SamedayPickupPoint } from "./sameday-api";

export interface RomanianSamedayShippingContext {
  origin: typeof wmsOriginAddresses.$inferSelect;
  pickupPoint: SamedayPickupPoint;
  contactPerson?: SamedayPickupPoint["contactPersons"][number];
}

/**
 * Resolve the Romanian WMS origin and the exact Sameday pickup point configured
 * for it. AWB creation must never silently choose another pickup point.
 */
export async function getRomanianSamedayShippingContext(
  samedayAPI: Pick<SamedayAPI, "getPickupPoints">,
): Promise<RomanianSamedayShippingContext> {
  const [origin] = await db.select().from(wmsOriginAddresses)
    .where(eq(wmsOriginAddresses.market, "ro"))
    .limit(1);

  if (!origin) {
    throw new Error("Sameday origin address is not configured for the Romanian logistics integration");
  }

  const pickupPointId = Number(origin.samedayPickupPointId);
  if (!Number.isInteger(pickupPointId) || pickupPointId <= 0) {
    throw new Error("Sameday pickup point ID is not configured for the Romanian logistics origin");
  }

  const pickupPoints = await samedayAPI.getPickupPoints();
  if (pickupPoints.length === 0) {
    throw new Error("No pickup points configured in the Sameday account");
  }

  const pickupPoint = pickupPoints.find(point => point.id === pickupPointId);
  if (!pickupPoint) {
    throw new Error(`Configured Sameday pickup point ${pickupPointId} is not available in the account`);
  }

  const normalizedEmail = origin.email.trim().toLowerCase();
  const normalizedPhone = origin.phone.replace(/\D/g, "");
  const contactPerson = pickupPoint.contactPersons?.find(contact => {
    const contactEmail = String(contact.email || "").trim().toLowerCase();
    const contactPhone = String(contact.phone || "").replace(/\D/g, "");
    return (
      (normalizedEmail && contactEmail === normalizedEmail) ||
      (normalizedPhone && contactPhone && contactPhone.endsWith(normalizedPhone.slice(-8)))
    );
  }) || pickupPoint.contactPersons?.find(contact => contact.default);

  return { origin, pickupPoint, contactPerson };
}

export function serializeSamedayPickupPoints(
  pickupPoints: SamedayPickupPoint[],
  configuredId?: number | null,
) {
  const displayValue = (value: unknown): string => {
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
    if (value && typeof value === "object") {
      const location = value as { name?: unknown; label?: unknown; title?: unknown; id?: unknown };
      for (const candidate of [location.name, location.label, location.title, location.id]) {
        if (typeof candidate === "string" || typeof candidate === "number") {
          return String(candidate);
        }
      }
    }
    return "";
  };

  return pickupPoints.map(point => ({
    id: point.id,
    name: displayValue(point.name) || `Sameday #${point.id}`,
    county: displayValue(point.county),
    city: displayValue(point.city),
    address: displayValue(point.address),
    contactPersons: point.contactPersons || [],
    configured: point.id === configuredId,
  }));
}