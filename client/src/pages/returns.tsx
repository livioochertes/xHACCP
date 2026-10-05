import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  FileText,
  Mail,
  MapPin,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useLanguage } from "../contexts/language-context";
import { useCompanySettings } from "../hooks/useCompanySettings";
import {
  getReturnPolicyCopy,
  getReturnPolicySellerDetails,
} from "../content/return-policy";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import ContactModal from "../components/contact-modal";

interface WithdrawalReceipt {
  ticketId: string;
  submittedAt: string;
  receiptSent: boolean;
}

const SECTION_ICONS = [
  UserRound,
  CalendarClock,
  FileText,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
];

export default function Returns() {
  const { language } = useLanguage();
  const { contact, market } = useCompanySettings();
  const copy = getReturnPolicyCopy(language, market);
  const seller = getReturnPolicySellerDetails(market, contact);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [items, setItems] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [receipt, setReceipt] = useState<WithdrawalReceipt | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const submitWithdrawal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(false);
    setSubmitting(true);

    try {
      const response = await fetch("/api/consumer-withdrawal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Market": market,
        },
        body: JSON.stringify({ firstName, lastName, email, orderNumber, items }),
      });
      const result = await response.json().catch(() => ({}));
      if (result.noticeReceived && result.ticketId && result.submittedAt) {
        setReceipt({
          ticketId: result.ticketId,
          submittedAt: result.submittedAt,
          receiptSent: Boolean(result.receiptSent),
        });
      } else if (!response.ok || !result.success) {
        setError(true);
      } else {
        setReceipt({
          ticketId: result.ticketId,
          submittedAt: result.submittedAt,
          receiptSent: Boolean(result.receiptSent),
        });
      }
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setOrderNumber("");
    setItems("");
    setReceipt(null);
    setError(false);
  };

  const formattedReceiptTime = receipt
    ? new Intl.DateTimeFormat(language, {
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date(receipt.submittedAt))
    : "";

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="kitchen-pro-secondary py-14 md:py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
              <RotateCcw className="h-7 w-7 text-white" aria-hidden="true" />
            </div>
            <h1 className="mb-5 text-3xl font-bold text-white md:text-5xl">{copy.title}</h1>
            <p className="mx-auto mb-5 max-w-3xl text-lg leading-relaxed text-blue-100">
              {copy.subtitle}
            </p>
            <p className="mb-7 text-sm text-blue-100">{copy.updated}</p>
            <a
              href="#withdrawal-form"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-6 py-3 font-semibold text-primary shadow-sm transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            >
              {copy.withdrawalCta}
            </a>
          </div>
        </div>
      </section>

      <section id="withdrawal-form" className="scroll-mt-8 py-10 md:py-14">
        <div className="container mx-auto px-4">
          <Card className="mx-auto max-w-4xl border-blue-200 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl text-primary">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
                  <FileText className="h-6 w-6 text-secondary" aria-hidden="true" />
                </div>
                {copy.form.title}
              </CardTitle>
              <p className="text-slate-600 leading-relaxed">{copy.form.description}</p>
            </CardHeader>
            <CardContent>
              {receipt ? (
                <div
                  role="status"
                  aria-live="polite"
                  className={`rounded-lg border p-5 ${
                    receipt.receiptSent
                      ? "border-green-200 bg-green-50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    {receipt.receiptSent ? (
                      <CheckCircle2 className="h-6 w-6 text-green-700" aria-hidden="true" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-amber-700" aria-hidden="true" />
                    )}
                    <h2 className="text-lg font-semibold text-slate-900">
                      {receipt.receiptSent ? copy.form.successTitle : copy.form.receiptFailureTitle}
                    </h2>
                  </div>
                  <p className="mb-4 leading-relaxed text-slate-700">
                    {receipt.receiptSent ? copy.form.successText : copy.form.receiptFailureText}
                  </p>
                  <dl className="mb-5 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold">{copy.form.reference}</dt>
                      <dd>{receipt.ticketId}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">{copy.form.submittedAt}</dt>
                      <dd>{formattedReceiptTime}</dd>
                    </div>
                  </dl>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    {copy.form.newRequest}
                  </Button>
                </div>
              ) : (
                <>
                  {error && (
                    <div
                      role="alert"
                      className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900"
                    >
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                      <p>{copy.form.error}</p>
                    </div>
                  )}
                  <form onSubmit={submitWithdrawal} className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="withdrawal-first-name">{copy.form.firstName}</Label>
                        <Input
                          id="withdrawal-first-name"
                          autoComplete="given-name"
                          maxLength={100}
                          required
                          value={firstName}
                          onChange={(event) => setFirstName(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="withdrawal-last-name">{copy.form.lastName}</Label>
                        <Input
                          id="withdrawal-last-name"
                          autoComplete="family-name"
                          maxLength={100}
                          required
                          value={lastName}
                          onChange={(event) => setLastName(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="withdrawal-email">{copy.form.email}</Label>
                      <Input
                        id="withdrawal-email"
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="withdrawal-order">{copy.form.orderNumber}</Label>
                      <Input
                        id="withdrawal-order"
                        autoComplete="off"
                        maxLength={120}
                        required
                        value={orderNumber}
                        onChange={(event) => setOrderNumber(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="withdrawal-items">{copy.form.items}</Label>
                      <Textarea
                        id="withdrawal-items"
                        maxLength={2000}
                        value={items}
                        onChange={(event) => setItems(event.target.value)}
                      />
                      <p className="text-sm text-slate-500">{copy.form.itemsHint}</p>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">{copy.form.privacy}</p>
                    <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={submitting}>
                      {submitting ? copy.form.submitting : copy.form.submit}
                    </Button>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="pb-12 md:pb-16">
        <div className="container mx-auto space-y-6 px-4">
          {copy.sections.map((section, index) => {
            const Icon = SECTION_ICONS[index] || FileText;
            return (
              <Card key={section.title} className="mx-auto max-w-4xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-xl text-primary md:text-2xl">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
                      <Icon className="h-6 w-6 text-secondary" aria-hidden="true" />
                    </div>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-slate-700">
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph} className="leading-relaxed">{paragraph}</p>
                  ))}
                  {section.bullets && (
                    <ul className="list-disc space-y-3 pl-6 leading-relaxed">
                      {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                    </ul>
                  )}
                  {section.note && <p className="leading-relaxed">{section.note}</p>}
                </CardContent>
              </Card>
            );
          })}

          <Card className="mx-auto max-w-4xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl text-primary md:text-2xl">
                <MapPin className="h-6 w-6 text-secondary" aria-hidden="true" />
                {copy.sellerTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 text-slate-700 sm:grid-cols-2">
              {(seller.name || seller.postalAddress.length > 0) && (
                <div className="flex items-start gap-3">
                  <MapPin className="mt-1 h-5 w-5 shrink-0 text-secondary" aria-hidden="true" />
                  <div>
                    {seller.name && <p className="font-semibold text-primary">{seller.name}</p>}
                    {seller.postalAddress.length > 0 && (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {copy.sellerAddress}
                        </p>
                        {seller.postalAddress.map((line) => <p key={line}>{line}</p>)}
                      </>
                    )}
                    {seller.registrationNumber && (
                      <p className="mt-2">
                        <span className="font-medium">{copy.registrationNumberLabel}:</span>{" "}
                        {seller.registrationNumber}
                      </p>
                    )}
                    {seller.vatNumber && (
                      <p>
                        <span className="font-medium">{copy.vatNumberLabel}:</span>{" "}
                        {seller.vatNumber}
                      </p>
                    )}
                    {seller.returnAddress.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {copy.returnAddressTitle}
                        </p>
                        {seller.returnAddress.map((line) => <p key={line}>{line}</p>)}
                      </div>
                    )}
                    <p className="mt-3 text-sm text-slate-600">{copy.returnAddressNote}</p>
                  </div>
                </div>
              )}
              {contact.email && (
                <div className="flex items-start gap-3">
                  <Mail className="mt-1 h-5 w-5 shrink-0 text-secondary" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-primary">{copy.sellerEmail}</p>
                    <a className="text-secondary underline" href={`mailto:${contact.email}`}>
                      {contact.email}
                    </a>
                  </div>
                </div>
              )}
              {!contact.email && (
                <div className="flex items-start gap-3">
                  <Mail className="mt-1 h-5 w-5 shrink-0 text-secondary" aria-hidden="true" />
                  <div>
                    <ContactModal
                      triggerText={copy.form.sellerContact}
                      triggerVariant="link"
                      triggerSize="sm"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mx-auto max-w-4xl">
            <CardHeader>
              <CardTitle className="text-lg text-primary">{copy.sourcesTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-6 text-sm text-slate-600">
                {copy.sources.map((source, index) => (
                  <li key={source}>
                    <a
                      className="text-secondary underline"
                      href={copy.sourceUrls?.[index] ?? "https://europa.eu/youreurope/citizens/consumers/shopping/returns/index_en.htm"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {source}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-5 border-t border-slate-200 pt-4 text-sm text-slate-600">
                <Link className="text-secondary underline" href="/privacy">Privacy Policy</Link>
                {" · "}
                <Link className="text-secondary underline" href="/terms">Terms &amp; Conditions</Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
