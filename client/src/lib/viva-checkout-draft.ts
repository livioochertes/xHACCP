export interface VivaCheckoutDraftInput {
  step: number;
  formValues: Record<string, unknown>;
  voucherInput: string;
  appliedVoucherCode: string | null;
}

export interface VivaCheckoutDraft extends VivaCheckoutDraftInput {
  version: 1;
  market: string;
  savedAt: number;
}

const DRAFT_VERSION = 1;
export const VIVA_CHECKOUT_DRAFT_TTL_MS = 30 * 60 * 1000;

function getStorageKey(market: string) {
  return `xhaccp_viva_checkout_draft:${market}`;
}

export function saveVivaCheckoutDraft(market: string, input: VivaCheckoutDraftInput) {
  try {
    const formValues = { ...input.formValues };

    // Never retain account passwords or recurring-payment consent in browser storage.
    formValues.accountPassword = "";
    formValues.confirmAccountPassword = "";
    formValues.recurringConsent = false;

    const draft: VivaCheckoutDraft = {
      ...input,
      formValues,
      version: DRAFT_VERSION,
      market,
      savedAt: Date.now(),
    };
    window.sessionStorage.setItem(getStorageKey(market), JSON.stringify(draft));
  } catch {
    // Checkout remains usable when browser storage is unavailable.
  }
}

export function consumeVivaCheckoutDraft(market: string, now = Date.now()): VivaCheckoutDraft | null {
  const key = getStorageKey(market);
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    window.sessionStorage.removeItem(key);

    const parsed = JSON.parse(raw) as Partial<VivaCheckoutDraft>;
    if (
      parsed.version !== DRAFT_VERSION ||
      parsed.market !== market ||
      typeof parsed.savedAt !== "number" ||
      now < parsed.savedAt ||
      now - parsed.savedAt > VIVA_CHECKOUT_DRAFT_TTL_MS ||
      !parsed.formValues ||
      typeof parsed.formValues !== "object"
    ) {
      return null;
    }

    const formValues = { ...parsed.formValues };
    formValues.accountPassword = "";
    formValues.confirmAccountPassword = "";
    formValues.recurringConsent = false;

    return {
      version: DRAFT_VERSION,
      market,
      savedAt: parsed.savedAt,
      step: Number.isInteger(parsed.step) ? Number(parsed.step) : 3,
      formValues,
      voucherInput: typeof parsed.voucherInput === "string" ? parsed.voucherInput : "",
      appliedVoucherCode: typeof parsed.appliedVoucherCode === "string" ? parsed.appliedVoucherCode : null,
    };
  } catch {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore unavailable storage.
    }
    return null;
  }
}

export function clearVivaCheckoutDraft(market: string) {
  try {
    window.sessionStorage.removeItem(getStorageKey(market));
  } catch {
    // Ignore unavailable storage.
  }
}
