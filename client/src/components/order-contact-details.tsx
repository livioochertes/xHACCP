import { useTranslation } from "@/hooks/useTranslation";

interface OrderContactDetailsProps {
  email?: string | null;
  phone?: string | null;
}

export default function OrderContactDetails({ email, phone }: OrderContactDetailsProps) {
  const { t } = useTranslation();
  const normalizedEmail = email?.trim();
  const normalizedPhone = phone?.trim();

  if (!normalizedEmail && !normalizedPhone) return null;

  return (
    <div className="border-t pt-3 mt-3 space-y-2">
      <h3 className="font-semibold text-sm">{t("checkout.contactInfo")}</h3>
      {normalizedEmail && (
        <div className="flex justify-between gap-4 text-sm">
          <span className="text-muted-foreground">{t("checkout.emailAddress")}:</span>
          <a className="font-medium text-right break-all hover:underline" href={`mailto:${normalizedEmail}`}>
            {normalizedEmail}
          </a>
        </div>
      )}
      {normalizedPhone && (
        <div className="flex justify-between gap-4 text-sm">
          <span className="text-muted-foreground">{t("checkout.phoneNumber")}:</span>
          <a className="font-medium text-right hover:underline" href={`tel:${encodeURIComponent(normalizedPhone)}`}>
            {normalizedPhone}
          </a>
        </div>
      )}
    </div>
  );
}