import { useEffect } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { useLanguage } from "../contexts/language-context";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Link } from "wouter";
import { 
  Shield, 
  FileText, 
  User, 
  Database, 
  Clock, 
  Share2, 
  Lock, 
  UserCheck,
  MapPin,
  Mail,
  Phone
} from "lucide-react";
import { useCompanySettings } from "../hooks/useCompanySettings";
import { formatCompanyPhone, getTelHref } from "../lib/company-contact";
import {
  FRENCH_PRIVACY_COMPLAINT_URL,
  getPrivacyComplaintCopy,
} from "../content/market-legal-copy";

export default function Privacy() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { contact, market } = useCompanySettings();
  const companyName = contact.name || "NAMARTE";
  const companyPhone = formatCompanyPhone(contact.phone, market);
  const companyAddress = [
    contact.address,
    [contact.zipCode, contact.city].filter(Boolean).join(" "),
    contact.country,
  ].filter(Boolean).join(", ");
  const cookieDetails = language === "fr"
    ? {
        title: "Cookies et choix de confidentialité",
        intro: "Les fonctions nécessaires au site, à la sécurité, au panier et au paiement restent actives. Les fonctions facultatives ne sont activées qu’après votre choix dans le bandeau de consentement ; vous pouvez modifier ou retirer ce choix à tout moment avec le bouton « Paramètres des cookies ».",
        analytics: "Mesure d’audience : les événements d’analyse ne sont envoyés qu’après votre accord. Sur xhaccp.fr, Google Tag Manager (conteneur GTM-5WC2V3BF) n’est chargé qu’après cet accord. Les balises configurées dans ce conteneur peuvent traiter des informations de navigation. Les catégories publicitaires restent refusées par défaut.",
        cart: "Suivi interne des paniers : après votre accord, nous conservons un identifiant pseudonyme, le marché, les identifiants des produits, les quantités et les dates d’activité, pendant 90 jours maximum. Après une heure sans activité, une seule alerte interne est envoyée à notre équipe via SendGrid. Pour les utilisateurs connectés, l’enregistrement peut être associé à l’identifiant de leur compte. Nous ne collectons pas l’adresse e-mail ni l’adresse IP des visiteurs anonymes pour ce suivi et nous n’envoyons pas d’e-mail de relance aux clients.",
        withdrawal: "Vous pouvez retirer votre accord depuis « Paramètres des cookies ». Nous envoyons alors une demande de suppression du suivi de panier ; en cas de coupure temporaire, la suppression est réessayée au retour de la connexion. Le retrait n’annule pas les traitements effectués avant celui-ci.",
        settings: "Ouvrir les paramètres des cookies",
      }
    : language === "ro"
      ? {
          title: "Cookie-uri și opțiuni de confidențialitate",
          intro: "Funcțiile necesare site-ului, securității, coșului și plății rămân active. Funcțiile opționale se activează doar după alegerea ta în bannerul de consimțământ; poți modifica sau retrage alegerea oricând din butonul „Setări cookie-uri”.",
          analytics: "Analiză: evenimentele de analiză sunt trimise numai după acordul tău. Pe xhaccp.fr, Google Tag Manager (containerul GTM-5WC2V3BF) se încarcă numai după acest acord. Etichetele configurate în container pot procesa informații despre navigare. Categoriile de publicitate sunt refuzate implicit.",
          cart: "Monitorizare internă a coșurilor: după acord, păstrăm un identificator pseudonim, piața, ID-urile produselor, cantitățile și datele activității cel mult 90 de zile. După o oră fără activitate, echipa primește o singură alertă internă prin SendGrid. Pentru utilizatorii autentificați, înregistrarea poate fi asociată cu ID-ul contului. Pentru vizitatorii anonimi nu colectăm e-mailul sau IP-ul în acest scop și nu trimitem e-mailuri de recuperare către clienți.",
          withdrawal: "Poți retrage acordul din „Setări cookie-uri”. Trimitem o cerere de ștergere a înregistrării coșului; dacă apare o întrerupere temporară, reîncercăm după restabilirea conexiunii. Retragerea nu afectează prelucrările efectuate înainte de retragere.",
          settings: "Deschide setările cookie-urilor",
        }
      : {
          title: "Cookies and privacy choices",
          intro: "Storage required for the site, security, cart and checkout remains active. Optional functions are enabled only after you choose them in the consent banner. You can change or withdraw your choice at any time with the “Cookie settings” button.",
          analytics: "Analytics: analytics events are sent only after you consent. On xhaccp.fr, Google Tag Manager (container GTM-5WC2V3BF) loads only after that consent. Tags configured in the container may process browsing information. Advertising consent categories remain denied by default.",
          cart: "Internal cart monitoring: after consent, we retain a pseudonymous identifier, market, product IDs, quantities and activity timestamps for up to 90 days. After one hour without activity, one internal alert is sent to our team through SendGrid. For signed-in users, the record may be associated with their account ID. We do not collect anonymous visitors’ email addresses or IP addresses for this feature and do not send customer cart-recovery emails.",
          withdrawal: "You can withdraw consent using “Cookie settings”. We request deletion of the cart record; if there is a temporary connection failure, we retry when the connection returns. Withdrawal does not affect processing that took place before it.",
          settings: "Open cookie settings",
        };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    {
      id: "who-are-we",
      icon: User,
      title: "Who Are We?",
      content: [
        `${companyName} (hereinafter referred to as the "Company" or "We") provides software and services for the HORECA industry.`,
        "Our vision: a complete solution for restaurants is possible!",
        "We believe that food should be prepared using the best ingredients, be affordable, diverse, and served or delivered under the best conditions. Waste can be controlled and reduced through good supply chain management."
      ]
    },
    {
      id: "how-we-process",
      icon: Database,
      title: "How Do We Process Your Personal Data?",
      content: [
        `${companyName}, in its capacity as a Controller, processes personal data of candidates applying for available positions, employees, customers who are legal entities, contractual partners, collaborators, and other natural persons who interact with the Company.`,
        "Personal data are:",
        "• processed lawfully, fairly, and in a transparent manner in relation to the data subject;",
        "• collected for specified, explicit, and legitimate purposes and are not subsequently processed in a manner incompatible with those purposes;",
        "• adequate, relevant, and limited to what is necessary in relation to the purposes for which they are processed;",
        "• accurate and kept up to date;",
        "• stored in a form that permits the identification of data subjects for no longer than is necessary for the purposes for which the data are processed;",
        "• processed in a manner that ensures appropriate security of personal data, including protection against unauthorized or unlawful processing and against accidental loss, destruction, or damage, by using appropriate technical or organizational measures."
      ]
    },
    {
      id: "data-types",
      icon: FileText,
      title: "What Types of Personal Data Are Processed and For What Purpose?",
      content: [
        "When completing and submitting the contact form (\"Any Questions? Send Us a Message\") on the main page of the Company's website, we process the following types of personal data: first and last name, email address, phone number, as well as any other data provided at the data subject's initiative regarding the services marketed by the Company, in the \"Your message\" field.",
        "You must check the box stating \"I have read and agree to the Privacy Policy\" – and then click the \"Send message\" button.",
        "For visitors of the website, we may collect data through cookies or similar technologies, such as: IP address, internet browser, location, web pages accessed on our website, time spent on the website, internet network, and device used. For more details on this, please consult our Cookies Policy.",
        "We do not use your personal data to send you marketing communications, such as newsletters, unless you have given your explicit consent for such communications by ticking a corresponding consent box. In this respect, we only process your email address, and we ensure that you have a simple option to unsubscribe at any time, i.e., to withdraw your consent regarding these types of communications."
      ]
    },
    {
      id: "legal-grounds",
      icon: Shield,
      title: "What Are the Legal Grounds for Processing Personal Data?",
      content: [
        "Your personal data are processed in order to:",
        "• conclude and perform various contracts;",
        "• fulfill the legal obligations incumbent upon us;",
        "• do so based on the prior consent requested and/or provided (in the context of staff recruitment, for sending marketing communications, etc.);",
        `• pursue ${companyName}'s legitimate interests (e.g., taking measures to protect and secure our employees and exercising the Company's rights in contentious or non-contentious proceedings).`
      ]
    },
    {
      id: "retention-period",
      icon: Clock,
      title: "For How Long Do We Process Your Personal Data?",
      content: [
        "Personal data are stored and processed for the period necessary to achieve the processing purposes mentioned in this Policy or for the period required by law (e.g., for archiving, accounting purposes, etc.)."
      ]
    },
    {
      id: "data-sharing",
      icon: Share2,
      title: "Who Do We Disclose Your Personal Data To?",
      content: [
        "We will not disclose or transfer to any third party any personal data collected from or about you, except for:",
        "• Public authorities and institutions – when there is a legal obligation to do so or for a legitimate interest (including defending the Company's rights in contentious or non-contentious proceedings)",
        `• ${companyName}'s contractual partners or collaborators who provide services such as web hosting, website development and maintenance, online marketing, and marketing communications.`,
        "• Any third party – if you have given your explicit and specific consent for that particular situation and for the respective data.",
        "The personal data processed by the Company are not transferred by the Company (directly or through its contractual partners/collaborators) outside Romania or the European Economic Area (EEA)."
      ]
    },
    {
      id: "protection-measures",
      icon: Lock,
      title: "What Protection Measures and Guarantees Do We Take?",
      content: [
        "The Company implements appropriate technical and organizational measures to ensure a high level of security and protection of personal data. We use security methods and technologies, along with internal policies and procedures, including control and audit measures, to protect the personal data we collect, in accordance with the relevant legal provisions in force concerning data protection."
      ]
    },
    {
      id: "your-rights",
      icon: UserCheck,
      title: "What Are Your Rights as a Data Subject?",
      content: [
        "Any data subject may exercise the following rights, as provided by the General Data Protection Regulation:",
        "• The right of access;",
        "• The right to rectification;",
        "• The right to erasure;",
        "• The right to restrict processing;",
        "• The right to data portability;",
        "• The right to object to processing;",
        "• The right not to be subject to a decision based solely on automated processing, including profiling;",
        `• ${getPrivacyComplaintCopy(market, "The right to lodge a complaint with the National Supervisory Authority for Personal Data Processing (www.dataprotection.ro) and to refer the matter to the courts.")}`,
        `Individuals may exercise these rights by sending a written request to ${companyName}'s registered office${companyAddress ? ` (${companyAddress})` : ""}${contact.email ? `, by email at ${contact.email}` : ""}${companyPhone ? `, or by phone at ${companyPhone}` : ""}. The Data Protection Officer (DPO) services are outsourced and provided by GDPRComplet.`,
        "We will respond to your request within the legal timeframe of 30 days (with the possibility of extension if the request is complex, but we will inform you accordingly)."
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="kitchen-pro-secondary py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Privacy Policy
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              This Policy informs you about how we collect, use, transfer and protect your personal data.
            </p>
            <Badge variant="secondary" className="bg-white text-secondary px-4 py-2 text-sm font-semibold">
              Last updated: June 25, 2025
            </Badge>
          </div>
        </div>
      </section>

      {/* GDPR Compliance Notice */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start space-x-3">
                <Shield className="h-6 w-6 text-blue-600 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">GDPR Compliance</h3>
                  <p className="text-blue-800 leading-relaxed">
                    We process your personal data in accordance with the provisions of Regulation (EU) 2016/679 of the European Parliament and of the Council of April 27, 2016 on the protection of individuals with regard to the processing of personal data and on the free movement of such data, and repealing Directive 95/46/EC ("General Data Protection Regulation", hereinafter "GDPR") and relevant national legislation on the protection of personal data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="cookie-details" className="py-12 bg-slate-50 scroll-mt-24">
        <div className="container mx-auto px-4">
          <Card className="max-w-4xl mx-auto border-teal-200">
            <CardHeader>
              <CardTitle>{cookieDetails.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-slate-700 leading-relaxed">
              <p>{cookieDetails.intro}</p>
              <p>{cookieDetails.analytics}</p>
              <p>{cookieDetails.cart}</p>
              <p>{cookieDetails.withdrawal}</p>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("xhaccp-open-cookie-settings"))}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                {cookieDetails.settings}
              </button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Company Information */}
      <section className="py-16 kitchen-pro-muted">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-6 w-6 text-secondary" />
                  <span>Company Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {(contact.name || contact.address) && (
                      <div className="flex items-start space-x-3">
                        <MapPin className="h-5 w-5 text-secondary mt-1" />
                        <div>
                          {contact.name && <p className="font-semibold text-primary">{contact.name}</p>}
                          {contact.address && <p className="text-slate-600">{contact.address}</p>}
                          {(contact.city || contact.zipCode || contact.country) && (
                            <p className="text-slate-600">{[contact.zipCode, contact.city, contact.country].filter(Boolean).join(', ')}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {contact.vatNumber && (
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-secondary" />
                        <div>
                          <p className="text-slate-600">Tax Registration Number: {contact.vatNumber}</p>
                        </div>
                      </div>
                    )}
                    {contact.registrationNumber && (
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-secondary" />
                        <div>
                          <p className="text-slate-600">Reg. Com.: {contact.registrationNumber}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    {contact.email && (
                      <div className="flex items-center space-x-3">
                        <Mail className="h-5 w-5 text-secondary" />
                        <div>
                          <a className="text-slate-600 underline" href={`mailto:${contact.email}`}>{contact.email}</a>
                        </div>
                      </div>
                    )}
                    {companyPhone && (
                      <div className="flex items-center space-x-3">
                        <Phone className="h-5 w-5 text-secondary" />
                        <div>
                          <a className="text-slate-600 underline" href={getTelHref(companyPhone)}>{companyPhone}</a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Privacy Sections */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-8">
            {sections.map((section, index) => (
              <Card key={section.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                      <section.icon className="h-6 w-6 text-secondary" />
                    </div>
                    <div>
                      <span className="text-2xl font-bold text-primary">
                        {index + 1}. {section.title}
                      </span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {section.content.map((paragraph, pIndex) => (
                      <p key={pIndex} className="text-slate-700 leading-relaxed">
                        {market === "fr" && paragraph.includes(FRENCH_PRIVACY_COMPLAINT_URL) ? (
                          <>
                            {paragraph.slice(0, paragraph.indexOf(FRENCH_PRIVACY_COMPLAINT_URL))}
                            <a
                              href={FRENCH_PRIVACY_COMPLAINT_URL}
                              target="_blank"
                              rel="noreferrer"
                              className="text-secondary underline"
                            >
                              {FRENCH_PRIVACY_COMPLAINT_URL}
                            </a>
                            {paragraph.slice(paragraph.indexOf(FRENCH_PRIVACY_COMPLAINT_URL) + FRENCH_PRIVACY_COMPLAINT_URL.length)}
                          </>
                        ) : paragraph}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact for Privacy Questions */}
      <section className="py-16 kitchen-pro-secondary">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-6">
              Questions About Privacy?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              If you have any questions about this Privacy Policy, please contact us
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/ai-assistant" 
                className="bg-white text-secondary px-8 py-3 rounded-lg font-semibold hover:bg-slate-100 transition-colors"
              >
                Contact Support
              </Link>
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-secondary transition-colors"
                >
                  Email Us
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}