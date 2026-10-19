import { useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowUpRight,
  Building2,
  FileText,
  Globe2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";
import NotFound from "./not-found";
import { useCompanySettings } from "../hooks/useCompanySettings";
import { formatCompanyPhone, getTelHref } from "../lib/company-contact";
import { usePageSeo } from "../lib/use-page-seo";
import { FRENCH_LEGAL_NOTICE } from "@shared/french-legal-notice";

export default function MentionsLegales() {
  const { market } = useCompanySettings();
  if (market !== "fr") return <NotFound />;
  return <FrenchMentionsLegales />;
}

function FrenchMentionsLegales() {
  const { contact, market, isLoading } = useCompanySettings();
  const companyPhone = formatCompanyPhone(contact.phone, market);

  usePageSeo({
    title: "Mentions légales | xHACCP France",
    description:
      "Informations légales sur xHACCP France : identité de l’éditeur, coordonnées, direction de la publication et hébergement.",
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const hasAddress = Boolean(
    contact.address || contact.zipCode || contact.city || contact.country,
  );
  const addressLines = [
    contact.address,
    [contact.zipCode, contact.city].filter(Boolean).join(" "),
    contact.country,
  ].filter(Boolean);

  return (
    <main className="min-h-[100dvh] bg-slate-50 text-slate-800">
      <section className="relative overflow-hidden bg-[#12304b] text-white">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 hidden w-[42%] border-l border-white/10 md:block"
        >
          <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_48%,rgba(255,255,255,0.045)_49%,transparent_50%)] bg-[length:28px_28px]" />
          <div className="absolute right-[-4rem] top-[-7rem] h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute right-8 top-10 h-56 w-56 rounded-full border border-white/10" />
          <div className="absolute bottom-10 right-24 h-24 w-24 rounded-full bg-[#d7e7ed]/10" />
        </div>
        <div className="container relative mx-auto px-4 py-14 md:py-20">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#c8dce7]">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Informations de l’éditeur
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">
              Mentions légales
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#d4e0e8] md:text-lg">
              Retrouvez ici les informations permettant d’identifier
              l’exploitant du site xHACCP France et de le contacter.
            </p>
            <p className="mt-8 text-sm text-[#b9cbd7]">
              Site marchand destiné aux professionnels de la restauration.
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-16">
        <section
          aria-labelledby="publisher-heading"
          className="-mt-5 relative z-10 rounded-xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(23,46,67,0.08)] md:-mt-8"
        >
          <div className="grid md:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
            <div className="p-6 md:p-9">
              <div className="mb-6 flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#e8f0f3] text-[#17627a]">
                  <Building2 className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#53717f]">
                    Éditeur du site
                  </p>
                  <h2
                    id="publisher-heading"
                    className="mt-1 text-2xl font-semibold tracking-tight text-[#17364d]"
                  >
                    Identité et coordonnées
                  </h2>
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-4" aria-label="Chargement des coordonnées">
                  <div className="h-5 w-2/5 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
                </div>
              ) : (
                <div className="grid gap-7 sm:grid-cols-2">
                  <div className="space-y-5">
                    {contact.name && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Dénomination
                        </p>
                        <p className="mt-1 font-semibold text-[#17364d]">{contact.name}</p>
                      </div>
                    )}
                    {hasAddress && (
                      <div className="flex items-start gap-3">
                        <MapPin
                          className="mt-0.5 h-5 w-5 shrink-0 text-[#17627a]"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Adresse
                          </p>
                          {addressLines.map((line) => (
                            <p key={line} className="mt-1 leading-6 text-slate-700">
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-start gap-3">
                        <Mail
                          className="mt-0.5 h-5 w-5 shrink-0 text-[#17627a]"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Courriel
                          </p>
                          <a
                            className="mt-1 inline-block break-all font-medium text-[#17627a] underline decoration-[#a8c6d0] underline-offset-4 hover:text-[#12304b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17627a]"
                            href={`mailto:${contact.email}`}
                          >
                            {contact.email}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-5">
                    {companyPhone && (
                      <div className="flex items-start gap-3">
                        <Phone
                          className="mt-0.5 h-5 w-5 shrink-0 text-[#17627a]"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Téléphone
                          </p>
                          <a
                            className="mt-1 inline-block font-medium text-[#17627a] underline decoration-[#a8c6d0] underline-offset-4 hover:text-[#12304b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17627a]"
                            href={getTelHref(companyPhone)}
                          >
                            {companyPhone}
                          </a>
                        </div>
                      </div>
                    )}
                    {contact.vatNumber && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Numéro de TVA intracommunautaire
                        </p>
                        <p className="mt-1 font-medium text-slate-700">{contact.vatNumber}</p>
                      </div>
                    )}
                    {!isLoading &&
                      !contact.name &&
                      !hasAddress &&
                      !contact.email &&
                      !companyPhone &&
                      !contact.vatNumber &&
                      !contact.registrationNumber && (
                        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600 sm:col-span-2">
                          Les coordonnées de l’éditeur ne sont pas disponibles pour le moment.
                        </p>
                      )}
                  </div>
                </div>
              )}
            </div>
            <aside className="border-t border-slate-200 bg-[#f3f7f8] p-6 md:border-l md:border-t-0 md:p-9">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-[#17627a]" aria-hidden="true" />
                <h2 className="font-semibold text-[#17364d]">Informations légales</h2>
              </div>
              <dl className="mt-5 divide-y divide-slate-200 text-sm">
                <div className="py-3">
                  <dt className="text-slate-500">SIREN</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-[#17364d]">
                    {FRENCH_LEGAL_NOTICE.siren}
                  </dd>
                </div>
                <div className="py-3">
                  <dt className="text-slate-500">SIRET</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-[#17364d]">
                    {FRENCH_LEGAL_NOTICE.siret}
                  </dd>
                </div>
                <div className="py-3">
                  <dt className="text-slate-500">Immatriculation</dt>
                  <dd className="mt-1 font-semibold text-[#17364d]">
                    {FRENCH_LEGAL_NOTICE.rcsNumber} R.C.S.{" "}
                    {FRENCH_LEGAL_NOTICE.rcsCourt}
                  </dd>
                </div>
                <div className="py-3">
                  <dt className="text-slate-500">Capital social</dt>
                  <dd className="mt-1 font-semibold text-[#17364d]">
                    {FRENCH_LEGAL_NOTICE.shareCapital}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6 md:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#e8f0f3] text-[#17627a]">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#53717f]">
                  Responsabilité éditoriale
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[#17364d]">
                  Direction de la publication
                </h2>
                <p className="mt-4 leading-7 text-slate-700">
                  Directeur de la publication :{" "}
                  <span className="font-semibold text-[#17364d]">
                    {FRENCH_LEGAL_NOTICE.publicationDirector}
                  </span>
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 md:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#e8f0f3] text-[#17627a]">
                <Globe2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#53717f]">
                  Infrastructure
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[#17364d]">Hébergement</h2>
                <p className="mt-4 leading-7 text-slate-700">
                  Hébergeur :{" "}
                  <span className="font-semibold text-[#17364d]">
                    {FRENCH_LEGAL_NOTICE.hostingProvider}
                  </span>
                </p>
                <p className="mt-2 leading-7 text-slate-700">
                  Région des centres de données : {FRENCH_LEGAL_NOTICE.hostingRegion}.
                </p>
              </div>
            </div>
          </section>
        </div>

        <nav
          aria-label="Autres informations contractuelles"
          className="mt-10 flex flex-col justify-between gap-5 rounded-xl bg-[#e8f0f3] px-6 py-6 md:flex-row md:items-center md:px-8"
        >
          <div>
            <p className="font-semibold text-[#17364d]">Documents utiles</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Consultez les conditions applicables aux commandes et à vos données.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Link
              href="/terms"
              className="inline-flex items-center gap-1 font-semibold text-[#17627a] underline decoration-[#a8c6d0] underline-offset-4 hover:text-[#12304b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17627a]"
            >
              Conditions générales <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/privacy"
              className="inline-flex items-center gap-1 font-semibold text-[#17627a] underline decoration-[#a8c6d0] underline-offset-4 hover:text-[#12304b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17627a]"
            >
              Confidentialité <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/returns"
              className="inline-flex items-center gap-1 font-semibold text-[#17627a] underline decoration-[#a8c6d0] underline-offset-4 hover:text-[#12304b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17627a]"
            >
              Retours <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </nav>
      </div>
    </main>
  );
}
