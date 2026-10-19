import { useEffect, useState } from "react";
import {
  applyStoredCookiePreferences,
  COOKIE_CONSENT_CHANGED_EVENT,
  readCookiePreferences,
  removeCartMonitoringData,
  saveCookiePreferences,
  shouldOfferAnalyticsConsent,
  type CookiePreferences,
} from "../lib/cookie-consent";
import { useLanguage } from "../contexts/language-context";
import { CART_MONITORING_CONSENT_STORAGE_KEY } from "@shared/cart-abandonment";

const COPY = {
  en: {
    title: "Your privacy choices",
    intro: "Essential storage keeps the site and checkout working. Optional cookies are off until you choose.",
    analytics: "Analytics",
    analyticsDetail: "Allows analytics events. Google Tag Manager loads only on xhaccp.fr after consent.",
    cart: "Anonymous cart monitoring",
    cartDetail: "Stores product IDs, quantities and timestamps for up to 90 days. After one hour without cart activity, our team receives one internal email alert. For signed-in users, the record can be linked to their account ID. We do not store an anonymous visitor’s email or IP for this feature, and we do not send cart-recovery emails.",
    essential: "Essential storage is always active for security, language, cart and checkout functions.",
    reject: "Reject optional",
    accept: "Accept all",
    customize: "Customize",
    settings: "Cookie settings",
    save: "Save choices",
    cancel: "Cancel",
    details: "Privacy details",
    deletionPending: "Your choice is saved. We could not confirm deletion of the existing cart record yet; it will be retried when your connection is available.",
  },
  fr: {
    title: "Vos choix de confidentialité",
    intro: "Le stockage nécessaire assure le fonctionnement du site et du paiement. Les options restent désactivées jusqu’à votre choix.",
    analytics: "Mesure d’audience sur le site français",
    analyticsDetail: "Autorise les événements d’analyse. Google Tag Manager n’est chargé sur xhaccp.fr qu’après votre accord.",
    cart: "Suivi des paniers anonymes",
    cartDetail: "Enregistre les identifiants des produits, les quantités et les dates pendant 90 jours maximum. Après une heure sans activité sur le panier, notre équipe reçoit une alerte interne par e-mail. Pour les utilisateurs connectés, l’enregistrement peut être associé à leur identifiant de compte. Nous ne stockons ni l’adresse e-mail ni l’adresse IP des visiteurs anonymes pour cette fonction et n’envoyons pas d’e-mail de relance.",
    essential: "Le stockage nécessaire au fonctionnement, à la sécurité, à la langue, au panier et au paiement reste actif.",
    reject: "Tout refuser",
    accept: "Tout accepter",
    customize: "Personnaliser",
    settings: "Paramètres des cookies",
    save: "Enregistrer mes choix",
    cancel: "Annuler",
    details: "Détails sur la confidentialité",
    deletionPending: "Votre choix est enregistré. La suppression de l’enregistrement du panier n’a pas encore été confirmée ; elle sera réessayée lorsque votre connexion sera disponible.",
  },
  ro: {
    title: "Opțiunile tale de confidențialitate",
    intro: "Stocarea necesară menține site-ul și plata funcționale. Cookie-urile opționale rămân dezactivate până alegi.",
    analytics: "Analiză pe magazinul francez",
    analyticsDetail: "Permite evenimentele de analiză. Google Tag Manager se încarcă pe xhaccp.fr numai după acord.",
    cart: "Monitorizarea coșurilor anonime",
    cartDetail: "Păstrăm ID-urile produselor, cantitățile și datele timp de cel mult 90 de zile. După o oră fără activitate în coș, echipa primește o alertă internă prin e-mail. Pentru utilizatorii autentificați, înregistrarea poate fi asociată cu ID-ul contului. Pentru vizitatorii anonimi nu salvăm e-mailul sau IP-ul în acest scop și nu trimitem e-mailuri de recuperare a coșului.",
    essential: "Stocarea necesară pentru securitate, limbă, coș și plată rămâne activă.",
    reject: "Respinge opționalele",
    accept: "Acceptă tot",
    customize: "Personalizează",
    settings: "Setări cookie-uri",
    save: "Salvează opțiunile",
    cancel: "Anulează",
    details: "Detalii despre confidențialitate",
    deletionPending: "Opțiunea a fost salvată. Ștergerea înregistrării existente a coșului nu a fost încă confirmată; vom reîncerca atunci când conexiunea este disponibilă.",
  },
} as const;

type CopyLanguage = keyof typeof COPY;

export default function CookieConsentBanner() {
  const { language } = useLanguage();
  const copy = COPY[(language in COPY ? language : "en") as CopyLanguage];
  const showAnalytics = shouldOfferAnalyticsConsent();
  const [preferences, setPreferences] = useState<CookiePreferences | null>(() => readCookiePreferences());
  const [isOpen, setIsOpen] = useState(() => readCookiePreferences() === null);
  const [customizing, setCustomizing] = useState(false);
  const [deletionPending, setDeletionPending] = useState(false);
  const [draft, setDraft] = useState<CookiePreferences>({ analytics: false, cartMonitoring: false });

  useEffect(() => {
    applyStoredCookiePreferences();
    const sync = (event?: Event) => {
      if (event?.type === "storage" &&
          (event as StorageEvent).key !== CART_MONITORING_CONSENT_STORAGE_KEY) return;
      const hadActiveGtm = Boolean(document.getElementById("xhaccp-consented-gtm"));
      const next = readCookiePreferences();
      applyStoredCookiePreferences();
      setPreferences(next);
      setIsOpen(next === null);
      if (next) setDraft(next);
      if (next?.cartMonitoring !== true) void removeCartMonitoringData();
      if (event?.type === "storage" && hadActiveGtm && next?.analytics !== true) {
        window.location.reload();
      }
    };
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    const openSettings = () => {
      const current = readCookiePreferences();
      setDraft(current || { analytics: false, cartMonitoring: false });
      setCustomizing(true);
      setIsOpen(true);
    };
    window.addEventListener("xhaccp-open-cookie-settings", openSettings);
    const retryRemovalWhenOnline = () => {
      if (readCookiePreferences()?.cartMonitoring !== true) void removeCartMonitoringData();
    };
    window.addEventListener("online", retryRemovalWhenOnline);
    if (readCookiePreferences()?.cartMonitoring !== true) {
      void removeCartMonitoringData().catch(() => {});
    }
    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("xhaccp-open-cookie-settings", openSettings);
      window.removeEventListener("online", retryRemovalWhenOnline);
    };
  }, []);

  if (window.location.pathname.startsWith("/admin")) return null;

  const save = async (next: CookiePreferences) => {
    const result = await saveCookiePreferences(next);
    setPreferences(next);
    setDeletionPending(result.cartDeletionPending);
    setIsOpen(result.cartDeletionPending);
    setCustomizing(result.cartDeletionPending);
    setDraft(next);
    if (result.reloadRequired) window.location.reload();
  };

  if (!isOpen && preferences) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(preferences);
          setCustomizing(true);
          setIsOpen(true);
        }}
        style={settingsButtonStyle}
      >
        {copy.settings}
      </button>
    );
  }

  return (
    <aside
      role="dialog"
      aria-label={copy.title}
      aria-modal="false"
      style={bannerStyle}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: "0 0 7px", fontSize: 19, color: "#132b3c" }}>{copy.title}</h2>
            <p style={{ margin: 0, color: "#475569", fontSize: 14, lineHeight: 1.5 }}>{copy.intro}</p>
          </div>
          <a href="/privacy#cookie-details" style={{ color: "#087f78", fontSize: 13, whiteSpace: "nowrap" }}>
            {copy.details}
          </a>
        </div>

        <p style={{ margin: "10px 0 14px", fontSize: 12, color: "#64748b" }}>{copy.essential}</p>

        {customizing && (
          <div style={preferencesPanelStyle}>
            {showAnalytics && (
              <label style={toggleLabelStyle}>
                <input type="checkbox" checked={draft.analytics} onChange={event => setDraft(current => ({ ...current, analytics: event.target.checked }))} />
                <span><strong>{copy.analytics}</strong><small>{copy.analyticsDetail}</small></span>
              </label>
            )}
            <label style={toggleLabelStyle}>
              <input type="checkbox" checked={draft.cartMonitoring} onChange={event => setDraft(current => ({ ...current, cartMonitoring: event.target.checked }))} />
              <span><strong>{copy.cart}</strong><small>{copy.cartDetail}</small></span>
            </label>
          </div>
        )}

        {!customizing && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, margin: "14px 0" }}>
            {showAnalytics && <div style={choiceCardStyle}><strong>{copy.analytics}</strong><p>{copy.analyticsDetail}</p></div>}
            <div style={choiceCardStyle}><strong>{copy.cart}</strong><p>{copy.cartDetail}</p></div>
          </div>
        )}

        {deletionPending && (
          <p role="status" style={{ margin: "10px 0 0", color: "#9a4d3d", fontSize: 12, lineHeight: 1.5 }}>
            {copy.deletionPending}
          </p>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 14 }}>
          {customizing ? (
            <>
              <button type="button" onClick={() => void save(draft)} style={primaryButtonStyle}>{copy.save}</button>
              <button type="button" onClick={() => preferences ? (setIsOpen(false), setCustomizing(false)) : setCustomizing(false)} style={secondaryButtonStyle}>{copy.cancel}</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => void save({ analytics: false, cartMonitoring: false })} style={secondaryButtonStyle}>{copy.reject}</button>
              <button type="button" onClick={() => void save({ analytics: showAnalytics, cartMonitoring: true })} style={primaryButtonStyle}>{copy.accept}</button>
              <button type="button" onClick={() => { setDraft(preferences || { analytics: false, cartMonitoring: false }); setCustomizing(true); }} style={secondaryButtonStyle}>{copy.customize}</button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

const bannerStyle: React.CSSProperties = {
  position: "fixed",
  zIndex: 10000,
  inset: "auto 0 0",
  background: "#fff",
  borderTop: "1px solid #d7e0e8",
  boxShadow: "0 -8px 32px rgba(15, 23, 42, 0.16)",
  padding: "18px max(20px, calc((100vw - 1080px) / 2)) calc(18px + env(safe-area-inset-bottom))",
  maxHeight: "85vh",
  overflowY: "auto",
};

const preferencesPanelStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 14,
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#f8fafc",
};

const toggleLabelStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "20px 1fr",
  alignItems: "start",
  gap: 10,
  cursor: "pointer",
  color: "#1e293b",
  fontSize: 14,
};

const choiceCardStyle: React.CSSProperties = {
  padding: 12,
  border: "1px solid #e2e8f0",
  borderRadius: 9,
  color: "#1e293b",
  fontSize: 13,
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid #087f78",
  background: "#087f78",
  color: "white",
  borderRadius: 7,
  padding: "10px 15px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #94a3b8",
  background: "white",
  color: "#1e293b",
  borderRadius: 7,
  padding: "10px 15px",
  fontWeight: 600,
  cursor: "pointer",
};

const settingsButtonStyle: React.CSSProperties = {
  position: "fixed",
  zIndex: 9998,
  left: 12,
  bottom: "calc(12px + env(safe-area-inset-bottom))",
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  background: "white",
  color: "#334155",
  padding: "7px 11px",
  fontSize: 12,
  cursor: "pointer",
  boxShadow: "0 2px 10px rgba(15, 23, 42, .12)",
};
