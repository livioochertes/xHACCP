import { FormEvent, useEffect, useState } from "react";
import { usePageSeo } from "@/lib/use-page-seo";
import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";

type InvitationInfo = {
  status: "ready" | "subscribed" | "unsubscribed";
  restaurantName?: string | null;
};

type ActiveOffer = {
  discountType: "percentage" | "fixed";
  discountValue: string;
  discountDisplay: string;
  validMonths: number;
  activationDays: number;
};

export default function NewsletterSignup() {
  usePageSeo(
    {
      title: "Newsletter xHACCP France — Offre de bienvenue",
      description: "Inscrivez-vous à la newsletter xHACCP France et recevez l'offre de bienvenue actuellement configurée.",
    },
  );

  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [offer, setOffer] = useState<ActiveOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!token) {
      setError("Ce lien d'inscription n'est pas valide.");
      setLoading(false);
      return;
    }
    Promise.all([
      fetch(`/api/marketing/prospect-subscription?token=${encodeURIComponent(token)}`)
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || "Cette invitation n'est plus disponible.");
          return data;
        }),
      fetch("/api/event-voucher/campaign", { headers: { "X-Market": "fr" } })
        .then(async (response) => response.ok ? response.json() : null)
        .catch(() => null),
    ])
      .then(([infoData, offerData]) => {
        if (active) {
          setInfo(infoData);
          setOffer(offerData);
        }
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Impossible de charger cette invitation.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!consent) {
      setError("Cochez la case pour confirmer votre accord.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/marketing/prospect-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, consent }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "L'inscription n'a pas pu être enregistrée.");
      setMessage(data.message);
      setInfo((current) => current ? { ...current, status: "subscribed" } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L'inscription n'a pas pu être enregistrée.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[70vh] bg-slate-50 px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 text-white">
            <Mail className="h-7 w-7" aria-hidden="true" />
          </div>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
          <div className="mb-3 flex justify-center">
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-800">
              xHACCP France
            </span>
          </div>
          <h1 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Newsletter et voucher de bienvenue
          </h1>
          <p className="mt-3 text-center leading-7 text-slate-600">
            Recevez les actualités et offres xHACCP France ainsi que le code personnel correspondant à l'offre de bienvenue active.
          </p>

          {loading ? (
            <div className="py-10 text-center text-slate-500" role="status">Chargement de votre invitation…</div>
          ) : error && !info ? (
            <div className="mt-6 rounded-lg bg-red-50 p-4 text-center text-sm text-red-800" role="alert">{error}</div>
          ) : info?.status === "unsubscribed" ? (
            <div className="mt-6 rounded-lg bg-slate-100 p-5 text-center text-slate-700" role="status">
              Cette adresse est déjà désabonnée de nos communications.
            </div>
          ) : info?.status === "subscribed" ? (
            <div className="mt-6 rounded-lg bg-emerald-50 p-5 text-center text-emerald-800" role="status">
              <CheckCircle2 className="mx-auto mb-2 h-7 w-7" aria-hidden="true" />
              {message || "Votre inscription à la newsletter est déjà confirmée. Votre code personnel a été envoyé par email."}
            </div>
          ) : (
            <form onSubmit={submit} className="mt-7">
              {info?.restaurantName && (
                <p className="mb-4 text-center text-sm text-slate-600">
                  Invitation destinée à <strong>{info.restaurantName}</strong>
                </p>
              )}
              {offer ? (
                <p className="mb-4 rounded-lg bg-teal-50 p-3 text-center text-sm text-teal-900">
                  Offre active : <strong>{offer.discountDisplay}</strong>. Première commande payée sous {offer.activationDays} jours ; code valable {offer.validMonths} mois à compter de l'inscription.
                </p>
              ) : (
                <p className="mb-4 rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-900">
                  L'offre de bienvenue n'est pas disponible actuellement. Vous pourrez vous inscrire lorsque la promotion sera active.
                </p>
              )}
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  required
                  className="mt-1 h-4 w-4 shrink-0 accent-teal-700"
                />
                <span>
                  Oui, je souhaite recevoir par email la newsletter et les offres commerciales de xHACCP France.
                  Je peux me désabonner à tout moment. En validant mon inscription, je recevrai le code personnel correspondant à l'offre active.
                </span>
              </label>
              {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
              <button
                type="submit"
                disabled={!consent || submitting || !offer}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                {submitting ? "Inscription en cours…" : "Confirmer mon inscription et recevoir mon code"}
              </button>
              <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                Votre inscription est facultative. Votre email sera utilisé pour la newsletter, et vous pourrez vous désabonner depuis chaque message.
              </p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
