import { getMarketFromHostname } from "@/lib/queryClient";

export type NoriAiLanguage = "en" | "fr" | "ro";

export interface NoriAiCopy {
  language: NoriAiLanguage;
  subtitle: string;
  welcome: string;
  inputPlaceholder: string;
  connecting: string;
  connected: string;
  connectionFailed: string;
  retry: string;
  send: string;
  close: string;
  thinking: string;
  questions: string[];
}

const NORI_AI_COPY: Record<NoriAiLanguage, NoriAiCopy> = {
  en: {
    language: "en",
    subtitle: "Quick help with HACCP labels",
    welcome:
      "Hi, I’m Nori AI. Ask me about HACCP labels, food traceability, and choosing the right labels for your kitchen.",
    inputPlaceholder: "Ask about HACCP labels…",
    connecting: "Connecting…",
    connected: "Online",
    connectionFailed: "Nori AI is temporarily unavailable. Please try again.",
    retry: "Try again",
    send: "Send message",
    close: "Close Nori AI chat",
    thinking: "Nori AI is preparing a reply…",
    questions: [
      "Which HACCP labels should I use to date opened products?",
      "What information belongs on a food traceability label?",
      "How should I label prepared food and allergens in my kitchen?",
      "Which labels help record batch and temperature checks?",
    ],
  },
  fr: {
    language: "fr",
    subtitle: "Conseils rapides sur les étiquettes HACCP",
    welcome:
      "Bonjour, je suis Nori AI. Posez-moi vos questions sur les étiquettes HACCP, la traçabilité alimentaire et le choix des étiquettes adaptées à votre cuisine.",
    inputPlaceholder: "Posez une question sur les étiquettes HACCP…",
    connecting: "Connexion…",
    connected: "En ligne",
    connectionFailed: "Nori AI est temporairement indisponible. Veuillez réessayer.",
    retry: "Réessayer",
    send: "Envoyer le message",
    close: "Fermer la conversation Nori AI",
    thinking: "Nori AI prépare une réponse…",
    questions: [
      "Quelle étiquette HACCP utiliser pour dater les produits ouverts ?",
      "Quelles informations inscrire sur une étiquette de traçabilité ?",
      "Comment étiqueter les préparations et les allergènes en cuisine ?",
      "Quelles étiquettes utiliser pour noter les lots et les températures ?",
    ],
  },
  ro: {
    language: "ro",
    subtitle: "Ajutor rapid pentru etichete HACCP",
    welcome:
      "Bună, sunt Nori AI. Întreabă-mă despre etichetele HACCP, trasabilitatea alimentelor și alegerea etichetelor potrivite pentru bucătăria ta.",
    inputPlaceholder: "Întreabă despre etichetele HACCP…",
    connecting: "Se conectează…",
    connected: "Online",
    connectionFailed: "Nori AI nu este disponibil momentan. Încearcă din nou.",
    retry: "Încearcă din nou",
    send: "Trimite mesajul",
    close: "Închide conversația Nori AI",
    thinking: "Nori AI pregătește un răspuns…",
    questions: [
      "Ce etichete HACCP folosesc pentru datarea produselor deschise?",
      "Ce informații trebuie să apară pe o etichetă de trasabilitate?",
      "Cum etichetez preparatele și alergenii în bucătărie?",
      "Ce etichete mă ajută să notez loturile și temperaturile?",
    ],
  },
};

export function getNoriAiCopy(market = getMarketFromHostname()): NoriAiCopy {
  if (market === "fr") return NORI_AI_COPY.fr;
  if (market === "com") return NORI_AI_COPY.en;
  return NORI_AI_COPY.ro;
}