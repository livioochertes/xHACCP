import { ArrowUpRight, Clock3, Mail, ShieldCheck, Sparkles } from "lucide-react";

const registrationUrl = "https://xhaccp.fr/chef-event";

function Detail({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[clamp(11px,1.05vw,15px)] font-medium text-slate-300">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-cyan-300">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </span>
      <span>{children}</span>
    </div>
  );
}

export function ChefEventQrCard() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#071728] text-white">
      <style>{`
        @keyframes chef-card-glow {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: .55; }
          50% { transform: translate3d(3%, -2%, 0) scale(1.08); opacity: .8; }
        }
        .chef-card-glow { animation: chef-card-glow 11s ease-in-out infinite; }
        @media (max-width: 860px) {
          .chef-card-content { grid-template-columns: minmax(0, 1fr) minmax(245px, .72fr); gap: 2rem; }
          .chef-card-title { font-size: clamp(2.5rem, 7vw, 4.5rem); }
        }
        @media (max-width: 640px) {
          .chef-card-content { grid-template-columns: 1fr; gap: 1.75rem; }
          .chef-card-qr { max-width: 275px; }
          .chef-card-details { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.08)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="chef-card-glow pointer-events-none absolute -right-[14%] -top-[35%] h-[90%] w-[65%] rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-[45%] -left-[12%] h-[85%] w-[55%] rounded-full bg-blue-700/20 blur-3xl" />
      <div className="pointer-events-none absolute right-[34%] top-[12%] h-px w-[16%] bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />

      <div className="relative mx-auto flex min-h-screen max-w-[1440px] flex-col px-[clamp(24px,5vw,72px)] py-[clamp(22px,4.2vw,56px)]">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex h-[clamp(42px,4.2vw,58px)] w-[clamp(132px,12vw,170px)] items-center overflow-hidden rounded-xl bg-white px-2 shadow-[0_0_30px_rgba(34,211,238,.12)]">
                <img
                  src="/__mockup/images/xhaccp-logo.png"
                  alt="xHACCP"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="mt-2.5 text-center text-[9px] font-semibold uppercase tracking-[.32em] text-cyan-300/80 [text-indent:.32em]">
                France
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-slate-300 sm:flex">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
            Offre spéciale chefs
          </div>
        </header>

        <div className="chef-card-content my-auto grid grid-cols-[minmax(0,1.1fr)_minmax(290px,.7fr)] items-center gap-[clamp(32px,6vw,96px)] py-6">
          <section className="max-w-[760px]">
            <p className="mb-5 text-[clamp(11px,1.1vw,15px)] font-bold uppercase tracking-[.28em] text-cyan-300">
              Pour les professionnels de la restauration
            </p>
            <h1 className="chef-card-title max-w-[780px] text-[clamp(3rem,5.6vw,5.4rem)] font-black leading-[.9] tracking-[-.065em] text-white">
              Votre cuisine.
              <br />
              <span className="text-cyan-300">Votre avantage.</span>
            </h1>
            <p className="mt-5 max-w-[650px] text-[clamp(15px,1.3vw,20px)] leading-[1.4] text-slate-300">
              Inscrivez-vous au Chef Event et recevez par email votre
              <strong className="font-semibold text-white"> code personnel de réduction de 20&nbsp;%</strong>
              {" "}sur tous les produits xHACCP France, pendant 1 an.
            </p>

            <div className="mt-5 flex max-w-[700px] items-start gap-3 rounded-2xl border-2 border-cyan-300/60 bg-cyan-300/10 px-4 py-3 shadow-[0_0_34px_rgba(34,211,238,.12)]">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-[#071728]">
                <Clock3 className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-[clamp(12px,1.05vw,15px)] font-black uppercase tracking-[.12em] text-cyan-200">
                  Important · activez vite votre compte
                </p>
                <p className="mt-1 text-[clamp(13px,1.15vw,17px)] font-semibold leading-[1.35] text-white">
                  Effectuez une première commande payée dans les 30 jours.
                </p>
                <p className="mt-1 text-[clamp(11px,1vw,14px)] leading-[1.4] text-slate-300">
                  Sans achat dans ce délai, le code devient invalide. Après activation, il reste valable 12 mois.
                </p>
              </div>
            </div>

            <div className="chef-card-details mt-6 grid max-w-[700px] grid-cols-3 gap-x-5 gap-y-4 border-t border-white/15 pt-4">
              <Detail icon={Mail}>Code envoyé par email</Detail>
              <Detail icon={Clock3}>Activation par achat sous 30 jours</Detail>
              <Detail icon={ShieldCheck}>Sans montant minimum</Detail>
            </div>
          </section>

          <aside className="chef-card-qr relative w-full max-w-[350px] justify-self-end">
            <div className="absolute -inset-3 rounded-[30px] bg-cyan-300/10 blur-2xl" />
            <div className="relative rounded-[26px] bg-white p-[clamp(18px,2vw,28px)] text-center shadow-[0_24px_90px_rgba(0,0,0,.38)]">
              <div className="mx-auto mb-4 flex aspect-square w-full max-w-[282px] items-center justify-center rounded-2xl bg-white p-3">
                <img
                  src="/__mockup/images/chef-event-qr.svg"
                  alt={`QR code vers ${registrationUrl}`}
                  className="h-full w-full"
                />
              </div>
              <div className="text-[clamp(13px,1.35vw,18px)] font-extrabold tracking-[-.02em] text-slate-900">
                Scannez pour vous inscrire
              </div>
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[clamp(10px,1vw,13px)] font-medium text-slate-500">
                Recevez votre code personnel par email
                <ArrowUpRight className="h-3.5 w-3.5 text-cyan-600" />
              </div>
            </div>
            <div className="relative mt-4 text-center">
              <div className="text-[9px] font-bold uppercase tracking-[.22em] text-slate-400">Ou rendez-vous sur</div>
              <div className="mt-1 text-[clamp(12px,1.25vw,17px)] font-bold tracking-[.03em] text-cyan-300">
                xhaccp.fr/chef-event
              </div>
            </div>
          </aside>
        </div>

      </div>
    </main>
  );
}