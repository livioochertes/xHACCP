import { FormEvent, useEffect, useState } from "react";
import { usePageSeo } from "@/lib/use-page-seo";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChefHat, Clock3, Mail, ShieldCheck, Tag } from "lucide-react";

type Campaign = {
  name: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  validMonths: number;
  activationDays: number;
  discountDisplay?: string;
};

type FormData = {
  firstName: string;
  lastName: string;
  restaurant: string;
  phone: string;
  email: string;
  consent: boolean;
};

const emptyForm: FormData = {
  firstName: "",
  lastName: "",
  restaurant: "",
  phone: "",
  email: "",
  consent: false,
};

export default function ChefEvent() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const discountDisplay = campaign?.discountDisplay || (campaign
    ? campaign.discountType === "percentage"
      ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(campaign.discountValue))} %`
      : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(campaign.discountValue))
    : "");
  const validityTerms = campaign
    ? `Le code est valable ${campaign.validMonths} mois à compter de votre inscription.`
    : "";
  const activationTerms = campaign
    ? `Une première commande payée doit être effectuée dans les ${campaign.activationDays} jours suivant votre inscription. Sans achat payé dans ce délai, le code devient invalide.`
    : "";

  usePageSeo({
    title: "Offre de bienvenue professionnelle | xHACCP France",
    description: "Inscrivez-vous pour recevoir par email votre offre de bienvenue personnalisée sur xHACCP France.",
    image: `${window.location.origin}/attached_assets/logo_xHACCP-S1_1772812623761.png`,
    url: `${window.location.origin.replace("://www.", "://")}/chef-event`,
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    fetch("/api/event-voucher/campaign", { headers: { "X-Market": "fr" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("campaign");
        return response.json();
      })
      .then(setCampaign)
      .catch(() => setError("Cette offre n'est pas disponible pour le moment."))
      .finally(() => setLoading(false));
  }, []);

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess(false);
    if (!form.consent) {
      setError("Veuillez accepter le traitement de vos données et l'envoi de votre offre.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/event-voucher/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Market": "fr" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Une erreur est survenue.");
      setSuccess(true);
      setForm(emptyForm);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="kitchen-pro-secondary overflow-hidden">
        <div className="container mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.05fr_0.95fr] md:items-center md:py-24">
          <div className="text-white">
            <Badge className="mb-5 bg-white/15 text-white hover:bg-white/20">
              Offre de bienvenue professionnelle
            </Badge>
            <h1 className="mb-6 text-4xl font-bold leading-tight md:text-6xl">
              L'équipement HACCP pensé pour votre cuisine.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-blue-100 md:text-xl">
              {campaign
                ? `Inscrivez-vous et recevez par email votre code personnel de ${discountDisplay} de réduction sur xHACCP France.`
                : "Inscrivez-vous pour recevoir par email votre code personnel associé à l'offre active."}
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 text-blue-50">
                <Tag className="h-5 w-5" />
                <span>{discountDisplay || "Offre personnalisée"}</span>
              </div>
              <div className="flex items-center gap-3 text-blue-50">
                <Mail className="h-5 w-5" />
                <span>Code envoyé par email</span>
              </div>
              <div className="flex items-center gap-3 text-blue-50">
                <ShieldCheck className="h-5 w-5" />
                <span>{campaign ? `Valable ${campaign.validMonths} mois` : "Conditions de l'offre"}</span>
              </div>
            </div>
          </div>

          <Card className="border-0 shadow-2xl">
            <CardContent className="p-6 sm:p-8">
              {loading ? (
                <div className="py-16 text-center text-slate-500">Chargement de l'offre…</div>
              ) : success ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="mx-auto mb-5 h-14 w-14 text-emerald-600" />
                  <h2 className="mb-3 text-2xl font-bold text-slate-900">Merci pour votre inscription !</h2>
                  <p className="text-slate-600">
                    Le formulaire est terminé. Vérifiez votre boîte email pour retrouver votre code personnel de réduction.
                  </p>
                   <div className="mt-5 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-left text-sm text-amber-950">
                     <div className="flex items-start gap-3">
                       <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                       <p>
                          <strong>Conditions :</strong> {activationTerms} {validityTerms}
                       </p>
                     </div>
                   </div>
                  <a
                    className="mt-5 inline-block font-medium text-blue-700 underline"
                    href="https://xhaccp.fr/products?category=etiquettes-alimentaires"
                  >
                    Découvrir les étiquettes alimentaires
                  </a>
                  <Button className="mt-7" onClick={() => setSuccess(false)}>
                    Inscrire une autre personne
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mb-7 flex items-start gap-4">
                    <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
                      <ChefHat className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Recevez votre code</h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Remplissez le formulaire pour recevoir votre offre par email.
                      </p>
                    </div>
                  </div>

                  {error && (
                    <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <form className="space-y-4" onSubmit={submit}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-1.5 text-sm font-medium text-slate-700">
                        Prénom *
                        <Input required value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} />
                      </label>
                      <label className="space-y-1.5 text-sm font-medium text-slate-700">
                        Nom *
                        <Input required value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} />
                      </label>
                    </div>
                    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                      Restaurant *
                      <Input required value={form.restaurant} onChange={(event) => updateField("restaurant", event.target.value)} />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-1.5 text-sm font-medium text-slate-700">
                        Téléphone *
                        <Input required type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
                      </label>
                      <label className="space-y-1.5 text-sm font-medium text-slate-700">
                        Adresse email *
                        <Input required type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
                      </label>
                    </div>
                    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm" role="note">
                      <div className="flex items-start gap-3">
                        <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                        <p>
                          <strong>Conditions :</strong> {activationTerms} {validityTerms}
                        </p>
                      </div>
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      <Checkbox checked={form.consent} onCheckedChange={(checked) => updateField("consent", checked === true)} />
                      <span>
                        J'accepte le traitement de mes données et la réception de cette offre promotionnelle. Consultez notre{" "}
                        <Link className="font-medium text-blue-700 underline" href="/privacy">politique de confidentialité</Link>.
                      </span>
                    </label>
                    <Button type="submit" className="w-full" disabled={submitting || !campaign}>
                      {submitting ? "Envoi en cours…" : "Recevoir mon offre"}
                    </Button>
                    <p className="text-center text-xs text-slate-500">
                      {activationTerms} {validityTerms}
                    </p>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
      <section className="bg-white py-10">
        <div className="container mx-auto max-w-3xl px-4 text-center text-sm text-slate-500">
          {campaign?.name || "Offre événement xHACCP France"} · Tous les produits · Sans montant minimum
        </div>
      </section>
    </main>
  );
}