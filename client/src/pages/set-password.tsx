import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "wouter";
import { usePageSeo } from "@/lib/use-page-seo";

type LinkState = "checking" | "valid" | "invalid" | "complete";

export default function SetPassword() {
  usePageSeo({
    title: "Choisir le mot de passe de votre compte — xHACCP",
    description: "Choisissez un mot de passe sécurisé pour votre compte client xHACCP.",
  });

  const [token] = useState(() => (
    new URLSearchParams(window.location.hash.slice(1)).get("token")
    || new URLSearchParams(window.location.search).get("token")
    || ""
  ));
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const cleanUrl = new URL(window.location.href);
    if (cleanUrl.searchParams.has("token")) {
      cleanUrl.searchParams.delete("token");
    }
    const cleanHash = new URLSearchParams(cleanUrl.hash.slice(1));
    cleanHash.delete("token");
    cleanUrl.hash = cleanHash.size > 0 ? cleanHash.toString() : "";
    window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    let active = true;
    if (!token) {
      setLinkState("invalid");
      return;
    }
    fetch("/api/auth/password-setup/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.valid) throw new Error(data.message || "Ce lien n'est plus valide.");
        if (active) setLinkState("valid");
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Ce lien n'est plus valide.");
          setLinkState("invalid");
        }
      });
    return () => { active = false; };
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 10 || password.length > 128) {
      setError("Le mot de passe doit contenir entre 10 et 128 caractères.");
      return;
    }
    if (password !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/password-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Le mot de passe n'a pas pu être enregistré.");
      setLinkState("complete");
      setPassword("");
      setConfirmation("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le mot de passe n'a pas pu être enregistré.");
      setLinkState("invalid");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative isolate min-h-[70vh] overflow-hidden bg-[#f3f5ef] px-4 py-10 sm:py-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-24 -top-36 h-96 w-96 rounded-full border border-[#d9e3d8]" />
        <div className="absolute -right-12 -top-24 h-72 w-72 rounded-full border border-[#d9e3d8]/80" />
        <div className="absolute bottom-0 left-0 h-48 w-48 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#e7ede4]" />
      </div>

      <section className="mx-auto grid max-w-5xl overflow-hidden rounded-[1.75rem] border border-[#dce3da] bg-[#fffefa] shadow-[0_24px_70px_-38px_rgba(20,54,48,0.35)] md:grid-cols-[0.82fr_1.18fr]">
        <aside className="relative flex min-h-56 flex-col justify-between overflow-hidden bg-[#174c43] px-7 py-8 text-white sm:px-10 sm:py-10 md:min-h-[590px]">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-20 h-64 w-64 rounded-full border border-white/10">
            <div className="absolute inset-7 rounded-full border border-white/10" />
            <div className="absolute inset-14 rounded-full border border-white/10" />
          </div>
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/10">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                  <path d="M12 3.5 19 6v5.4c0 4.3-2.8 7.8-7 9.1-4.2-1.3-7-4.8-7-9.1V6l7-2.5Z" stroke="currentColor" strokeWidth="1.6" />
                  <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-[1.35rem] font-bold tracking-[-0.055em]">xHACCP</span>
            </div>

            <p className="mt-12 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#c7d9a8]">Votre espace client</p>
            <h2 className="mt-3 max-w-xs text-3xl font-semibold leading-[1.12] tracking-[-0.04em] sm:text-[2.6rem]">
              Un compte simple.
              <span className="mt-1 block text-[#d6e4bc]">Des achats sereins.</span>
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-[#d5e2dc]">
              Retrouvez vos commandes et utilisez votre code de réduction en toute sécurité.
            </p>
          </div>

          <div className="relative mt-10 border-t border-white/15 pt-5">
            <div className="flex items-start gap-3 text-sm leading-5 text-[#d5e2dc]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-[#d6e4bc]" fill="none">
                <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="12" cy="15" r="1" fill="currentColor" />
              </svg>
              <span>Un accès personnel, protégé et réservé à votre activité.</span>
            </div>
            <p className="mt-7 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-white/55">
              Équipement et étiquetage alimentaire · France
            </p>
          </div>
        </aside>

        <div className="px-6 py-8 sm:px-10 sm:py-11 lg:px-14">
          <div className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#54746b]">
            <span className="h-px w-6 bg-[#a7b79a]" />
            Activation du compte
          </div>
          <h1 className="mt-4 text-[1.8rem] font-semibold leading-tight tracking-[-0.045em] text-[#193d36] sm:text-4xl">
            Choisir votre mot de passe
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-[#64736e]">
            Créez un mot de passe pour sécuriser votre compte client xHACCP.
          </p>

          {linkState === "checking" && (
            <div className="mt-9 space-y-5" role="status" aria-label="Vérification du lien">
              <div className="flex items-center gap-3 rounded-xl border border-[#e2e8df] bg-[#f7f8f4] px-4 py-3.5">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#8da56f]" />
                <span className="text-sm font-medium text-[#49645a]">Vérification du lien sécurisé…</span>
              </div>
              <div className="space-y-3" aria-hidden="true">
                <div className="h-3 w-36 animate-pulse rounded bg-[#e8ece5]" />
                <div className="h-12 animate-pulse rounded-xl border border-[#e8ece5] bg-[#f7f8f4]" />
                <div className="h-3 w-44 animate-pulse rounded bg-[#e8ece5]" />
                <div className="h-12 animate-pulse rounded-xl border border-[#e8ece5] bg-[#f7f8f4]" />
              </div>
            </div>
          )}

          {linkState === "invalid" && (
            <div className="mt-8 rounded-2xl border border-[#ead9ba] bg-[#fbf5e9] p-5 sm:p-6" role="alert">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f2e7cf] text-[#8b6333]">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                    <path d="M12 8v5m0 3h.01M10.3 4.9 2.9 18a1.5 1.5 0 0 0 1.3 2.2h15.6a1.5 1.5 0 0 0 1.3-2.2L13.7 4.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <p className="font-semibold text-[#5e4729]">Lien indisponible</p>
                  <p className="mt-1 text-sm leading-6 text-[#765f40]">
                    {error || "Ce lien n'est plus valide. Demandez un nouveau lien depuis votre inscription."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {linkState === "complete" && (
            <div className="mt-8 rounded-2xl border border-[#d5e3d3] bg-[#f0f5ed] p-5 sm:p-6" role="status">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#dce9d7] text-[#315c49]">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                    <path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <p className="font-semibold text-[#294c3d]">Votre compte est prêt</p>
                  <p className="mt-1 text-sm leading-6 text-[#527060]">
                    Votre mot de passe a été enregistré. Vous pouvez maintenant vous connecter.
                  </p>
                </div>
              </div>
              <Link href="/login" className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#174c43] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#103d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75956b] focus-visible:ring-offset-2 sm:w-auto">
                Se connecter
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                  <path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          )}

          {linkState === "valid" && (
            <form onSubmit={submit} className="mt-8 space-y-5">
              <label className="block text-sm font-semibold text-[#354d45]">
                Nouveau mot de passe
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 block min-h-12 w-full rounded-xl border border-[#cfd9d0] bg-[#fffefa] px-4 text-base font-normal text-[#203b34] shadow-sm outline-none transition focus:border-[#527c69] focus:ring-4 focus:ring-[#527c69]/10"
                />
              </label>
              <label className="block text-sm font-semibold text-[#354d45]">
                Confirmer le mot de passe
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="mt-2 block min-h-12 w-full rounded-xl border border-[#cfd9d0] bg-[#fffefa] px-4 text-base font-normal text-[#203b34] shadow-sm outline-none transition focus:border-[#527c69] focus:ring-4 focus:ring-[#527c69]/10"
                />
              </label>
              {error && (
                <p className="rounded-xl border border-[#ebd2ca] bg-[#fbf0ec] px-4 py-3 text-sm leading-5 text-[#8b4438]" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#174c43] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_18px_-10px_rgba(23,76,67,0.8)] transition-colors hover:bg-[#103d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75956b] focus-visible:ring-offset-2 disabled:cursor-wait disabled:bg-[#789087] disabled:shadow-none"
              >
                {submitting ? "Enregistrement…" : "Enregistrer le mot de passe"}
                {!submitting && (
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                    <path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <div className="flex items-start gap-2 border-t border-[#e8ebe4] pt-4 text-xs leading-5 text-[#75817a]">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-[#78916f]" fill="none">
                  <rect x="4" y="8" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M6.5 8V6a3.5 3.5 0 0 1 7 0v2" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                <span>Ce lien est à usage unique et expire après 24 heures.</span>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
