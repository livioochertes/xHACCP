import "./_group.css";
import { BarChart3, Check, Cookie, LockKeyhole, Settings2, ShieldCheck, ShoppingBasket } from "lucide-react";
import { useState } from "react";

export function ReferenceStyle() {
  const [settings, setSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [cart, setCart] = useState(false);

  return (
    <div className="min-h-screen bg-[#f0f4f5]">
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-7">
        <strong className="text-sm tracking-[.15em] text-[#0d4c52]">xHACCP</strong>
        <span className="text-xs text-slate-500">Votre boutique · France</span>
      </header>
      <main className="mx-auto max-w-5xl p-8">
        <div className="h-4 w-48 rounded-full bg-slate-200" />
        <div className="mt-4 h-3 w-80 rounded-full bg-slate-200" />
        <div className="mt-8 grid grid-cols-3 gap-4">
          {[1, 2, 3].map(item => <div key={item} className="h-32 rounded-xl border border-slate-200 bg-white shadow-sm" />)}
        </div>
      </main>

      <aside aria-label="Choix de confidentialité" className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white px-5 py-4 shadow-[0_-12px_40px_rgba(15,23,42,.16)]">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-start gap-4">
            <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e7f4f2] text-[#087f78]">
              <Cookie size={23} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                <h2 className="m-0 text-lg font-bold text-[#122d3b]">Vos choix de confidentialité</h2>
                <a href="/privacy#cookie-details" className="text-xs font-semibold text-[#087f78] underline underline-offset-2">En savoir plus</a>
              </div>
              <p className="mb-0 mt-1 max-w-4xl text-sm leading-5 text-slate-600">
                Les cookies nécessaires assurent le fonctionnement du site. Les mesures d’audience et le suivi interne des paniers restent désactivés jusqu’à votre choix.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-slate-500">
                <span className="inline-flex items-center gap-1.5"><LockKeyhole size={13} className="text-[#087f78]" /> Nécessaires toujours actifs</span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} className="text-[#087f78]" /> Vous pouvez modifier vos choix à tout moment</span>
              </div>
            </div>
          </div>

          {settings && (
            <div className="mt-4 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
                <input type="checkbox" checked={analytics} onChange={event => setAnalytics(event.target.checked)} className="mt-1 accent-[#087f78]" />
                <span><strong className="flex items-center gap-2 text-sm text-slate-800"><BarChart3 size={15} className="text-[#087f78]" /> Mesure d’audience</strong>
                  <small className="mt-1 block text-xs leading-5 text-slate-600">Sur xhaccp.fr, Google Tag Manager ne se charge qu’après votre accord. Les événements de mesure restent désactivés sans celui-ci.</small>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
                <input type="checkbox" checked={cart} onChange={event => setCart(event.target.checked)} className="mt-1 accent-[#087f78]" />
                <span><strong className="flex items-center gap-2 text-sm text-slate-800"><ShoppingBasket size={15} className="text-[#087f78]" /> Suivi interne des paniers</strong>
                  <small className="mt-1 block text-xs leading-5 text-slate-600">Après accord, les produits et quantités sont conservés jusqu’à 90 jours. Une alerte interne est envoyée après une heure sans activité. Aucun e-mail de relance n’est envoyé.</small>
                </span>
              </label>
            </div>
          )}

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button onClick={() => setSettings(value => !value)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Settings2 size={16} /> {settings ? "Masquer les options" : "Personnaliser"}
            </button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button className="min-h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Tout refuser</button>
              {settings && <button className="min-h-10 rounded-lg border border-[#087f78] bg-white px-5 text-sm font-semibold text-[#087f78]">Enregistrer mes choix</button>}
              <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#087f78] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#076e68]">
                <Check size={16} /> Tout accepter
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
