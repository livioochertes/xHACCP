import "./_group.css";
import { Cookie, Settings } from "lucide-react";

export function Current() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="p-8 text-slate-400">
        <div className="mb-4 h-5 w-40 rounded bg-slate-200" />
        <div className="h-3 w-72 rounded bg-slate-200" />
      </div>
      <aside className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white px-5 py-5 shadow-[0_-8px_32px_rgba(15,23,42,.16)]">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="mb-2 text-lg font-semibold text-slate-900">Vos choix de confidentialité</h2>
              <p className="text-sm leading-6 text-slate-600">
                Le stockage nécessaire assure le fonctionnement du site et du paiement. Les options restent désactivées jusqu’à votre choix.
              </p>
            </div>
            <a className="whitespace-nowrap text-sm text-teal-700 underline" href="#">Détails sur la confidentialité</a>
          </div>
          <p className="mb-4 mt-3 text-xs text-slate-500">
            Le stockage nécessaire au fonctionnement, à la sécurité, à la langue, au panier et au paiement reste actif.
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <strong>Mesure d’audience sur le site français</strong>
              <p className="mb-0 mt-1 text-xs leading-5 text-slate-600">Google Tag Manager n’est chargé sur xhaccp.fr qu’après votre accord.</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <strong>Suivi des paniers anonymes</strong>
              <p className="mb-0 mt-1 text-xs leading-5 text-slate-600">Un suivi interne peut déclencher une alerte à l’équipe après une heure d’inactivité.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Tout refuser</button>
            <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Tout accepter</button>
            <button className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              <Settings size={15} /> Personnaliser
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
