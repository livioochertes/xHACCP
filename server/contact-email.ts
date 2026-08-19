export type ContactMarket = "ro" | "fr" | "com";

export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  category: string;
  message: string;
  orderNumber?: string;
}

export interface ContactCompanySettings {
  email?: string | null;
  logisticsEmail?: string | null;
}

interface ContactCopy {
  code: "ro" | "fr" | "en";
  label: string;
  locale: string;
  timeZone: string;
  businessTitle: string;
  details: string;
  ticket: string;
  date: string;
  name: string;
  email: string;
  phone: string;
  notProvided: string;
  category: string;
  subject: string;
  orderNumber: string;
  message: string;
  action: string;
  actionText: string;
  replyHint: string;
  customerTitle: string;
  greeting: string;
  confirmation: string;
  summary: string;
  closing: string;
}

const COPY: Record<"ro" | "fr" | "en", ContactCopy> = {
  ro: {
    code: "ro",
    label: "Română",
    locale: "ro-RO",
    timeZone: "Europe/Bucharest",
    businessTitle: "Mesaj nou de contact",
    details: "Detalii contact",
    ticket: "ID tichet",
    date: "Data",
    name: "Nume",
    email: "Email",
    phone: "Telefon",
    notProvided: "Nu a fost furnizat",
    category: "Categorie",
    subject: "Subiect",
    orderNumber: "Număr comandă",
    message: "Mesaj",
    action: "Acțiune necesară",
    actionText: "Răspundeți clientului în termen de 24 de ore.",
    replyHint: "Răspundeți direct la acest email pentru a contacta clientul.",
    customerTitle: "Am primit mesajul dumneavoastră",
    greeting: "Bună",
    confirmation: "Vă mulțumim că ne-ați contactat. Am primit mesajul și vă vom răspunde cât mai curând posibil, de obicei în 24 de ore.",
    summary: "Rezumatul mesajului trimis",
    closing: "Vă mulțumim că ați ales xHACCP!",
  },
  fr: {
    code: "fr",
    label: "Français",
    locale: "fr-FR",
    timeZone: "Europe/Paris",
    businessTitle: "Nouveau message de contact",
    details: "Coordonnées",
    ticket: "ID du ticket",
    date: "Date",
    name: "Nom",
    email: "E-mail",
    phone: "Téléphone",
    notProvided: "Non renseigné",
    category: "Catégorie",
    subject: "Objet",
    orderNumber: "Numéro de commande",
    message: "Message",
    action: "Action requise",
    actionText: "Répondez au client dans les 24 heures.",
    replyHint: "Répondez directement à cet e-mail pour contacter le client.",
    customerTitle: "Nous avons bien reçu votre message",
    greeting: "Bonjour",
    confirmation: "Merci de nous avoir contactés. Nous avons reçu votre message et nous vous répondrons dès que possible, généralement sous 24 heures.",
    summary: "Résumé du message envoyé",
    closing: "Merci d'avoir choisi xHACCP !",
  },
  en: {
    code: "en",
    label: "English",
    locale: "en-GB",
    timeZone: "UTC",
    businessTitle: "New contact message",
    details: "Contact details",
    ticket: "Ticket ID",
    date: "Date",
    name: "Name",
    email: "Email",
    phone: "Phone",
    notProvided: "Not provided",
    category: "Category",
    subject: "Subject",
    orderNumber: "Order number",
    message: "Message",
    action: "Action required",
    actionText: "Reply to the customer within 24 hours.",
    replyHint: "Reply directly to this email to contact the customer.",
    customerTitle: "We received your message",
    greeting: "Hello",
    confirmation: "Thank you for contacting us. We received your message and will reply as soon as possible, usually within 24 hours.",
    summary: "Summary of your message",
    closing: "Thank you for choosing xHACCP!",
  },
};

export function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function dedupeEmailAddresses(values: Array<string | null | undefined>): string[] {
  const unique = new Map<string, string>();

  for (const value of values) {
    if (!value) continue;
    for (const candidate of value.split(/[,;\n]+/)) {
      const trimmed = candidate.trim();
      if (!isValidEmailAddress(trimmed)) continue;
      const key = trimmed.toLowerCase();
      if (!unique.has(key)) unique.set(key, trimmed);
    }
  }

  return [...unique.values()];
}

export function collectContactRecipients(
  settings: ContactCompanySettings | null | undefined,
): string[] {
  if (!settings) return [];
  return dedupeEmailAddresses([settings.email, settings.logisticsEmail]);
}

export function getContactLanguages(market: ContactMarket): Array<"ro" | "fr" | "en"> {
  if (market === "ro") return ["ro", "en"];
  if (market === "fr") return ["fr", "en"];
  return ["en"];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeSubject(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 200);
}

function businessSection(
  copy: ContactCopy,
  data: ContactFormData,
  ticketId: string,
  createdAt: Date,
): { html: string; text: string } {
  const timestamp = new Intl.DateTimeFormat(copy.locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: copy.timeZone,
  }).format(createdAt);
  const orderHtml = data.orderNumber
    ? `<p><strong>${copy.orderNumber}:</strong> #${escapeHtml(data.orderNumber)}</p>`
    : "";
  const orderText = data.orderNumber ? `- ${copy.orderNumber}: #${data.orderNumber}` : "";

  return {
    html: `
      <section lang="${copy.code}" style="margin-bottom: 28px;">
        <p style="font-size: 12px; color: #667085; text-transform: uppercase;">${copy.label}</p>
        <h2 style="color: #c0392b;">${copy.businessTitle}</h2>
        <div style="background:#fff3cd;padding:18px;border-left:4px solid #ffc107;border-radius:6px;">
          <h3>${copy.details}</h3>
          <p><strong>${copy.ticket}:</strong> ${escapeHtml(ticketId)}</p>
          <p><strong>${copy.date}:</strong> ${escapeHtml(timestamp)}</p>
          <p><strong>${copy.name}:</strong> ${escapeHtml(data.name)}</p>
          <p><strong>${copy.email}:</strong> ${escapeHtml(data.email)}</p>
          <p><strong>${copy.phone}:</strong> ${escapeHtml(data.phone || copy.notProvided)}</p>
          <p><strong>${copy.category}:</strong> ${escapeHtml(data.category)}</p>
          <p><strong>${copy.subject}:</strong> ${escapeHtml(data.subject)}</p>
          ${orderHtml}
        </div>
        <div style="background:#f8f9fa;padding:18px;margin-top:14px;border-radius:6px;">
          <h3>${copy.message}</h3>
          <p style="white-space:pre-wrap;">${escapeHtml(data.message)}</p>
        </div>
        <p><strong>${copy.action}:</strong> ${copy.actionText}</p>
        <p style="color:#667085;">${copy.replyHint}</p>
      </section>`,
    text: `${copy.label.toUpperCase()}
${copy.businessTitle}
${copy.ticket}: ${ticketId}
${copy.date}: ${timestamp}
${copy.details}:
- ${copy.name}: ${data.name}
- ${copy.email}: ${data.email}
- ${copy.phone}: ${data.phone || copy.notProvided}
- ${copy.category}: ${data.category}
- ${copy.subject}: ${data.subject}
${orderText}

${copy.message}:
${data.message}

${copy.action}: ${copy.actionText}
${copy.replyHint}`,
  };
}

function customerSection(
  copy: ContactCopy,
  data: ContactFormData,
  ticketId: string,
): { html: string; text: string } {
  const orderHtml = data.orderNumber
    ? `<p><strong>${copy.orderNumber}:</strong> #${escapeHtml(data.orderNumber)}</p>`
    : "";
  const orderText = data.orderNumber ? `- ${copy.orderNumber}: #${data.orderNumber}` : "";

  return {
    html: `
      <section lang="${copy.code}" style="margin-bottom: 28px;">
        <p style="font-size: 12px; color: #667085; text-transform: uppercase;">${copy.label}</p>
        <h2 style="color:#218838;">${copy.customerTitle}</h2>
        <p><strong>${copy.greeting} ${escapeHtml(data.name)},</strong></p>
        <p>${copy.confirmation}</p>
        <p><strong>${copy.ticket}:</strong> ${escapeHtml(ticketId)}</p>
        <div style="background:#f8f9fa;padding:18px;border-radius:6px;">
          <h3>${copy.summary}</h3>
          <p><strong>${copy.category}:</strong> ${escapeHtml(data.category)}</p>
          <p><strong>${copy.subject}:</strong> ${escapeHtml(data.subject)}</p>
          ${orderHtml}
          <p><strong>${copy.message}:</strong></p>
          <p style="white-space:pre-wrap;">${escapeHtml(data.message)}</p>
        </div>
        <p>${copy.closing}</p>
      </section>`,
    text: `${copy.label.toUpperCase()}
${copy.customerTitle}

${copy.greeting} ${data.name},
${copy.confirmation}
${copy.ticket}: ${ticketId}

${copy.summary}:
- ${copy.category}: ${data.category}
- ${copy.subject}: ${data.subject}
${orderText}

${copy.message}:
${data.message}

${copy.closing}`,
  };
}

export interface ContactEmailTemplates {
  business: { subject: string; html: string; text: string };
  customer: { subject: string; html: string; text: string };
}

export function buildContactEmailTemplates(
  data: ContactFormData,
  market: ContactMarket,
  ticketId: string,
  createdAt = new Date(),
): ContactEmailTemplates {
  const languageCodes = getContactLanguages(market);
  const businessSections = languageCodes.map((language) =>
    businessSection(COPY[language], data, ticketId, createdAt),
  );
  const customerSections = languageCodes.map((language) =>
    customerSection(COPY[language], data, ticketId),
  );
  const primary = COPY[languageCodes[0]];
  const businessTitle =
    market === "ro"
      ? `${COPY.ro.businessTitle} / ${COPY.en.businessTitle}`
      : market === "fr"
        ? `${COPY.fr.businessTitle} / ${COPY.en.businessTitle}`
        : COPY.en.businessTitle;
  const customerTitle =
    market === "ro"
      ? `${COPY.ro.customerTitle} / ${COPY.en.customerTitle}`
      : market === "fr"
        ? `${COPY.fr.customerTitle} / ${COPY.en.customerTitle}`
        : COPY.en.customerTitle;
  const separator = '<hr style="border:0;border-top:2px solid #e5e7eb;margin:30px 0;">';
  const wrap = (title: string, sections: string[]) => `<!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
    <body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:680px;margin:0 auto;padding:20px;">
      <h1 style="text-align:center;color:#2c3e50;">xHACCP</h1>
      ${sections.join(separator)}
    </body></html>`;

  return {
    business: {
      subject: `📩 ${businessTitle} [${safeSubject(data.category)}] ${safeSubject(data.subject)} - ${safeSubject(data.name)}`,
      html: wrap(primary.businessTitle, businessSections.map((section) => section.html)),
      text: businessSections.map((section) => section.text).join("\n\n--------------------\n\n"),
    },
    customer: {
      subject: `${customerTitle} - xHACCP (${ticketId})`,
      html: wrap(primary.customerTitle, customerSections.map((section) => section.html)),
      text: customerSections.map((section) => section.text).join("\n\n--------------------\n\n"),
    },
  };
}