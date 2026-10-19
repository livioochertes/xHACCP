import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  BarChart3,
  Check,
  Cookie,
  LockKeyhole,
  Settings2,
  ShoppingBasket,
  ShieldCheck,
  X,
} from "lucide-react";
import { Switch } from "./ui/switch";
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

const DEFAULT_PREFERENCES: CookiePreferences = { analytics: false, cartMonitoring: false };

const COPY = {
  en: {
    bannerTitle: "We use cookies to enhance your experience",
    bannerIntro: "Necessary cookies keep the site working. Optional cookies help us improve it and are used only with your choice.",
    bannerLink: "Cookie policy",
    necessaryBadge: "Necessary always active",
    controlBadge: "Your choice",
    reject: "Reject non-essential",
    accept: "Accept all",
    customize: "Customize",
    settings: "Cookie settings",
    close: "Close cookie notice",
    dialogTitle: "Cookie preferences",
    dialogIntro: "Manage your cookie preferences. Necessary cookies cannot be disabled because they are required for the website to work.",
    necessary: "Necessary cookies",
    alwaysActive: "Always active",
    necessaryDetail: "Required for security, language selection, cart and checkout. These cookies and storage cannot be switched off.",
    analytics: "Analytics",
    analyticsDetail: "Allows analytics events after consent. Google Tag Manager is loaded only on xhaccp.fr and only after you agree.",
    cart: "Internal cart monitoring",
    cartDetail: "With your consent, product IDs, quantities and activity times are stored for up to 90 days. After one hour without cart activity, our team receives one internal alert. Signed-in records may be linked to your account. We do not collect an anonymous visitor’s email or IP for this feature, and we do not send cart-recovery emails.",
    details: "Read privacy details",
    save: "Save my choices",
    cancel: "Cancel",
    deletionPending: "Your choice is saved. We could not confirm deletion of the existing cart record yet; it will be retried when your connection is available.",
  },
  fr: {
    bannerTitle: "Nous utilisons des cookies pour améliorer votre expérience",
    bannerIntro: "Les cookies nécessaires assurent le fonctionnement du site. Les cookies facultatifs ne sont utilisés qu’avec votre accord.",
    bannerLink: "Politique relative aux cookies",
    necessaryBadge: "Nécessaires toujours actifs",
    controlBadge: "Votre choix",
    reject: "Tout refuser",
    accept: "Tout accepter",
    customize: "Personnaliser",
    settings: "Paramètres des cookies",
    close: "Fermer l’information sur les cookies",
    dialogTitle: "Préférences relatives aux cookies",
    dialogIntro: "Gérez vos préférences. Les cookies nécessaires ne peuvent pas être désactivés, car ils sont indispensables au fonctionnement du site.",
    necessary: "Cookies nécessaires",
    alwaysActive: "Toujours actifs",
    necessaryDetail: "Nécessaires à la sécurité, au choix de la langue, au panier et au paiement. Ces cookies et stockages ne peuvent pas être désactivés.",
    analytics: "Mesure d’audience",
    analyticsDetail: "Autorise l’envoi d’événements de mesure après votre accord. Google Tag Manager est chargé uniquement sur xhaccp.fr et après votre accord.",
    cart: "Suivi interne des paniers",
    cartDetail: "Avec votre accord, les identifiants des produits, les quantités et les dates d’activité sont conservés pendant 90 jours maximum. Après une heure sans activité, notre équipe reçoit une alerte interne. Pour les utilisateurs connectés, l’enregistrement peut être associé à leur compte. Nous ne collectons ni l’adresse e-mail ni l’adresse IP des visiteurs anonymes pour cette fonction et n’envoyons pas d’e-mail de relance.",
    details: "Lire les détails sur la confidentialité",
    save: "Enregistrer mes choix",
    cancel: "Annuler",
    deletionPending: "Votre choix est enregistré. La suppression de l’enregistrement du panier n’a pas encore été confirmée ; elle sera réessayée lorsque votre connexion sera disponible.",
  },
  ro: {
    bannerTitle: "Folosim cookie-uri pentru o experiență mai bună",
    bannerIntro: "Cookie-urile necesare mențin site-ul funcțional. Cookie-urile opționale ne ajută să-l îmbunătățim și se folosesc numai dacă alegi asta.",
    bannerLink: "Politica privind cookie-urile",
    necessaryBadge: "Necesare, mereu active",
    controlBadge: "Tu alegi",
    reject: "Respinge opționalele",
    accept: "Acceptă tot",
    customize: "Personalizează",
    settings: "Setări cookie-uri",
    close: "Închide informarea despre cookie-uri",
    dialogTitle: "Preferințe pentru cookie-uri",
    dialogIntro: "Gestionează preferințele pentru cookie-uri. Cookie-urile necesare nu pot fi dezactivate, fiind necesare pentru funcționarea site-ului.",
    necessary: "Cookie-uri necesare",
    alwaysActive: "Mereu active",
    necessaryDetail: "Sunt necesare pentru securitate, alegerea limbii, coș și plată. Aceste cookie-uri și stocări nu pot fi dezactivate.",
    analytics: "Analiză de trafic",
    analyticsDetail: "Permite trimiterea evenimentelor de analiză după acordul tău. Google Tag Manager se încarcă numai pe xhaccp.fr și numai după acord.",
    cart: "Monitorizare internă a coșurilor",
    cartDetail: "Cu acordul tău, păstrăm ID-urile produselor, cantitățile și datele activității cel mult 90 de zile. După o oră fără activitate, echipa primește o alertă internă. Înregistrările utilizatorilor autentificați pot fi asociate cu ID-ul contului. Pentru vizitatorii anonimi nu colectăm e-mailul sau IP-ul în acest scop și nu trimitem e-mailuri de recuperare a coșului.",
    details: "Citește detaliile despre confidențialitate",
    save: "Salvează opțiunile",
    cancel: "Anulează",
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
  const [draft, setDraft] = useState<CookiePreferences>(() => readCookiePreferences() || DEFAULT_PREFERENCES);

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
      setCustomizing(false);
      if (next) setDraft(next);
      if (next?.cartMonitoring !== true) void removeCartMonitoringData();
      if (event?.type === "storage" && hadActiveGtm && next?.analytics !== true) {
        window.location.reload();
      }
    };
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);

    const openSettings = () => {
      setDraft(readCookiePreferences() || DEFAULT_PREFERENCES);
      setDeletionPending(false);
      setCustomizing(true);
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

  const openSettings = () => {
    setDraft(readCookiePreferences() || DEFAULT_PREFERENCES);
    setDeletionPending(false);
    setCustomizing(true);
  };

  const save = async (next: CookiePreferences) => {
    const result = await saveCookiePreferences(next);
    setPreferences(next);
    setDeletionPending(result.cartDeletionPending);
    setIsOpen(result.cartDeletionPending);
    setCustomizing(result.cartDeletionPending);
    setDraft(next);
    if (result.reloadRequired) window.location.reload();
  };

  return (
    <>
      {isOpen && !customizing ? (
        <aside className="cookie-consent" aria-label={copy.bannerTitle}>
          <div className="cookie-consent__inner">
            <div className="cookie-consent__banner-main">
              <div className="cookie-consent__icon" aria-hidden="true">
                <Cookie size={21} strokeWidth={1.8} />
              </div>
              <div className="cookie-consent__banner-copy">
                <h2>{copy.bannerTitle}</h2>
                <p>
                  {copy.bannerIntro}{" "}
                  <a href="/privacy#cookie-details">{copy.bannerLink}</a>
                </p>
                <div className="cookie-consent__badges">
                  <span className="cookie-consent__badge cookie-consent__badge--necessary">
                    <LockKeyhole size={12} aria-hidden="true" />{copy.necessaryBadge}
                  </span>
                  <span className="cookie-consent__badge cookie-consent__badge--choice">
                    <ShieldCheck size={12} aria-hidden="true" />{copy.controlBadge}
                  </span>
                </div>
                <div className="cookie-consent__actions">
                  <button
                    type="button"
                    onClick={() => void save({ analytics: showAnalytics, cartMonitoring: true })}
                    className="cookie-consent__button cookie-consent__button--primary"
                  >
                    <Check size={15} aria-hidden="true" />{copy.accept}
                  </button>
                  <button
                    type="button"
                    onClick={() => void save({ analytics: false, cartMonitoring: false })}
                    className="cookie-consent__button cookie-consent__button--secondary"
                  >
                    {copy.reject}
                  </button>
                  <button
                    type="button"
                    onClick={openSettings}
                    className="cookie-consent__button cookie-consent__button--secondary"
                  >
                    <Settings2 size={15} aria-hidden="true" />{copy.customize}
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="cookie-consent__close"
                aria-label={copy.close}
                onClick={() => setIsOpen(false)}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          </div>
        </aside>
      ) : null}

      {!isOpen && !customizing ? (
        <button type="button" onClick={openSettings} className="cookie-settings-trigger">
          <Cookie size={15} aria-hidden="true" />
          {copy.settings}
        </button>
      ) : null}

      <DialogPrimitive.Root open={customizing} onOpenChange={setCustomizing}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="cookie-settings-overlay" />
          <DialogPrimitive.Content className="cookie-settings-dialog">
            <header className="cookie-settings-dialog__header">
              <div className="cookie-settings-dialog__title-icon" aria-hidden="true">
                <Settings2 size={24} />
              </div>
              <div>
                <DialogPrimitive.Title className="cookie-settings-dialog__title">
                  {copy.dialogTitle}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="cookie-settings-dialog__intro">
                  {copy.dialogIntro}
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close className="cookie-settings-dialog__close" aria-label={copy.close}>
                <X size={21} aria-hidden="true" />
              </DialogPrimitive.Close>
            </header>

            <div className="cookie-settings-dialog__rows">
              <section className="cookie-settings-row">
                <div className="cookie-settings-row__icon cookie-settings-row__icon--necessary">
                  <LockKeyhole size={19} aria-hidden="true" />
                </div>
                <div className="cookie-settings-row__copy">
                  <div className="cookie-settings-row__title">
                    <h3>{copy.necessary}</h3>
                    <span>{copy.alwaysActive}</span>
                  </div>
                  <p>{copy.necessaryDetail}</p>
                </div>
                <Switch checked disabled aria-label={copy.necessary} className="cookie-settings-row__switch" />
              </section>

              {showAnalytics && (
                <section className="cookie-settings-row">
                  <div className="cookie-settings-row__icon cookie-settings-row__icon--analytics">
                    <BarChart3 size={19} aria-hidden="true" />
                  </div>
                  <div className="cookie-settings-row__copy">
                    <h3>{copy.analytics}</h3>
                    <p>{copy.analyticsDetail}</p>
                  </div>
                  <Switch
                    checked={draft.analytics}
                    onCheckedChange={checked => setDraft(current => ({ ...current, analytics: checked }))}
                    aria-label={copy.analytics}
                    className="cookie-settings-row__switch"
                  />
                </section>
              )}

              <section className="cookie-settings-row">
                <div className="cookie-settings-row__icon cookie-settings-row__icon--cart">
                  <ShoppingBasket size={19} aria-hidden="true" />
                </div>
                <div className="cookie-settings-row__copy">
                  <h3>{copy.cart}</h3>
                  <p>{copy.cartDetail}</p>
                </div>
                <Switch
                  checked={draft.cartMonitoring}
                  onCheckedChange={checked => setDraft(current => ({ ...current, cartMonitoring: checked }))}
                  aria-label={copy.cart}
                  className="cookie-settings-row__switch"
                />
              </section>
            </div>

            {deletionPending && (
              <p className="cookie-settings-dialog__pending" role="status">{copy.deletionPending}</p>
            )}

            <footer className="cookie-settings-dialog__footer">
              <a href="/privacy#cookie-details">{copy.details}</a>
              <div>
                <button
                  type="button"
                  onClick={() => setCustomizing(false)}
                  className="cookie-consent__button cookie-consent__button--secondary"
                >
                  {copy.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => void save(draft)}
                  className="cookie-consent__button cookie-consent__button--primary"
                >
                  <Check size={15} aria-hidden="true" />{copy.save}
                </button>
              </div>
            </footer>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
