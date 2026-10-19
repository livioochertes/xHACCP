import { useEffect, useState } from "react";
import {
  BarChart3,
  Check,
  Cookie,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  ShoppingBasket,
} from "lucide-react";
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
import "./cookie-consent-banner.css";

const COPY = {
  en: {
    title: "Your privacy choices",
    intro: "Necessary storage keeps the site and checkout working. Analytics and internal cart monitoring stay off until you choose.",
    essential: "Necessary storage is always active for security, language, cart and checkout.",
    essentialLabel: "Necessary · always active",
    changeAnytime: "You can change your choices at any time",
    analytics: "Analytics",
    analyticsDetail: "Analytics events are sent only after consent. Google Tag Manager loads only on xhaccp.fr after you agree.",
    cart: "Internal cart monitoring",
    cartDetail: "With your consent, product IDs, quantities and activity times are stored for up to 90 days. After one hour without cart activity, our team receives one internal alert. Signed-in records may be linked to your account. We do not collect an anonymous visitor’s email or IP for this feature, and we do not send cart-recovery emails.",
    reject: "Reject optional",
    accept: "Accept all",
    customize: "Customize",
    hideOptions: "Hide options",
    settings: "Cookie settings",
    save: "Save choices",
    cancel: "Cancel",
    details: "Privacy details",
    deletionPending: "Your choice is saved. We could not confirm deletion of the existing cart record yet; it will be retried when your connection is available.",
  },
  fr: {
    title: "Vos choix de confidentialité",
    intro: "Le stockage nécessaire assure le fonctionnement du site et du paiement. La mesure d’audience et le suivi interne des paniers restent désactivés jusqu’à votre choix.",
    essential: "Le stockage nécessaire au fonctionnement, à la sécurité, à la langue, au panier et au paiement reste actif.",
    essentialLabel: "Nécessaires · toujours actifs",
    changeAnytime: "Vous pouvez modifier vos choix à tout moment",
    analytics: "Mesure d’audience",
    analyticsDetail: "Les événements de mesure ne sont envoyés qu’après votre accord. Google Tag Manager est chargé uniquement sur xhaccp.fr et après votre accord.",
    cart: "Suivi interne des paniers",
    cartDetail: "Avec votre accord, les identifiants des produits, les quantités et les dates d’activité sont conservés pendant 90 jours maximum. Après une heure sans activité, notre équipe reçoit une alerte interne. Pour les utilisateurs connectés, l’enregistrement peut être associé à leur compte. Nous ne collectons ni l’adresse e-mail ni l’adresse IP des visiteurs anonymes pour cette fonction et n’envoyons pas d’e-mail de relance.",
    reject: "Tout refuser",
    accept: "Tout accepter",
    customize: "Personnaliser",
    hideOptions: "Masquer les options",
    settings: "Paramètres des cookies",
    save: "Enregistrer mes choix",
    cancel: "Annuler",
    details: "Détails sur la confidentialité",
    deletionPending: "Votre choix est enregistré. La suppression de l’enregistrement du panier n’a pas encore été confirmée ; elle sera réessayée lorsque votre connexion sera disponible.",
  },
  ro: {
    title: "Opțiunile tale de confidențialitate",
    intro: "Stocarea necesară menține site-ul și plata funcționale. Analiza de trafic și monitorizarea internă a coșurilor rămân oprite până alegi.",
    essential: "Stocarea necesară pentru securitate, limbă, coș și plată rămâne activă.",
    essentialLabel: "Necesare · mereu active",
    changeAnytime: "Poți modifica opțiunile oricând",
    analytics: "Analiză de trafic",
    analyticsDetail: "Evenimentele de analiză sunt trimise numai după acordul tău. Google Tag Manager se încarcă numai pe xhaccp.fr și numai după acord.",
    cart: "Monitorizare internă a coșurilor",
    cartDetail: "Cu acordul tău, păstrăm ID-urile produselor, cantitățile și datele activității cel mult 90 de zile. După o oră fără activitate, echipa primește o alertă internă. Înregistrările utilizatorilor autentificați pot fi asociate cu ID-ul contului. Pentru vizitatorii anonimi nu colectăm e-mailul sau IP-ul în acest scop și nu trimitem e-mailuri de recuperare a coșului.",
    reject: "Respinge opționalele",
    accept: "Acceptă tot",
    customize: "Personalizează",
    hideOptions: "Ascunde opțiunile",
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
      if (
        event?.type === "storage" &&
        (event as StorageEvent).key !== CART_MONITORING_CONSENT_STORAGE_KEY
      ) return;

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
        className="cookie-settings-trigger"
      >
        <Cookie size={15} aria-hidden="true" />
        {copy.settings}
      </button>
    );
  }

  return (
    <aside className="cookie-consent" role="dialog" aria-label={copy.title} aria-modal="false">
      <div className="cookie-consent__inner">
        <div className="cookie-consent__intro-row">
          <div className="cookie-consent__icon" aria-hidden="true">
            <Cookie size={24} strokeWidth={1.8} />
          </div>
          <div className="cookie-consent__intro">
            <div className="cookie-consent__heading-row">
              <h2>{copy.title}</h2>
              <a href="/privacy#cookie-details">{copy.details}</a>
            </div>
            <p>{copy.intro}</p>
            <div className="cookie-consent__trust">
              <span><LockKeyhole size={14} aria-hidden="true" />{copy.essentialLabel}</span>
              <span><ShieldCheck size={14} aria-hidden="true" />{copy.changeAnytime}</span>
            </div>
          </div>
        </div>

        {customizing ? (
          <div className="cookie-consent__options">
            {showAnalytics && (
              <label className="cookie-consent__option">
                <input
                  type="checkbox"
                  checked={draft.analytics}
                  onChange={event => setDraft(current => ({ ...current, analytics: event.target.checked }))}
                />
                <span className="cookie-consent__option-copy">
                  <strong><BarChart3 size={16} aria-hidden="true" />{copy.analytics}</strong>
                  <small>{copy.analyticsDetail}</small>
                </span>
              </label>
            )}
            <label className="cookie-consent__option">
              <input
                type="checkbox"
                checked={draft.cartMonitoring}
                onChange={event => setDraft(current => ({ ...current, cartMonitoring: event.target.checked }))}
              />
              <span className="cookie-consent__option-copy">
                <strong><ShoppingBasket size={16} aria-hidden="true" />{copy.cart}</strong>
                <small>{copy.cartDetail}</small>
              </span>
            </label>
          </div>
        ) : (
          <div className="cookie-consent__summary">
            {showAnalytics && (
              <div className="cookie-consent__summary-card">
                <strong><BarChart3 size={16} aria-hidden="true" />{copy.analytics}</strong>
                <p>{copy.analyticsDetail}</p>
              </div>
            )}
            <div className="cookie-consent__summary-card">
              <strong><ShoppingBasket size={16} aria-hidden="true" />{copy.cart}</strong>
              <p>{copy.cartDetail}</p>
            </div>
          </div>
        )}

        {deletionPending && (
          <p className="cookie-consent__deletion" role="status">{copy.deletionPending}</p>
        )}

        <div className={`cookie-consent__actions${customizing ? " cookie-consent__actions--editing" : ""}`}>
          {customizing ? (
            <>
              <button type="button" onClick={() => void save(draft)} className="cookie-consent__button cookie-consent__button--primary">
                <Check size={16} aria-hidden="true" />{copy.save}
              </button>
              <button
                type="button"
                onClick={() => preferences ? (setIsOpen(false), setCustomizing(false)) : setCustomizing(false)}
                className="cookie-consent__button cookie-consent__button--secondary"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={() => setCustomizing(false)}
                className="cookie-consent__button cookie-consent__button--text"
              >
                <Settings2 size={16} aria-hidden="true" />{copy.hideOptions}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void save({ analytics: false, cartMonitoring: false })}
                className="cookie-consent__button cookie-consent__button--secondary"
              >
                {copy.reject}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(preferences || { analytics: false, cartMonitoring: false });
                  setCustomizing(true);
                }}
                className="cookie-consent__button cookie-consent__button--secondary"
              >
                <Settings2 size={16} aria-hidden="true" />{copy.customize}
              </button>
              <button
                type="button"
                onClick={() => void save({ analytics: showAnalytics, cartMonitoring: true })}
                className="cookie-consent__button cookie-consent__button--primary"
              >
                <Check size={16} aria-hidden="true" />{copy.accept}
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
