export function formatCompanyPhone(phone: string | undefined, market: string): string {
  const original = phone?.trim() ?? "";
  if (!original || market !== "fr") return original;

  const digits = original.replace(/\D/g, "");
  let nationalNumber = "";

  if (digits.startsWith("0033")) {
    nationalNumber = digits.slice(4);
  } else if (digits.startsWith("33")) {
    nationalNumber = digits.slice(2);
  } else if (digits.startsWith("0")) {
    nationalNumber = digits.slice(1);
  } else {
    return original;
  }

  if (nationalNumber.length !== 9) return original;
  const pairs = nationalNumber.slice(1).match(/\d{2}/g);
  if (!pairs || pairs.length !== 4) return original;

  return `+33 ${nationalNumber[0]} ${pairs.join(" ")}`;
}

export function getTelHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
