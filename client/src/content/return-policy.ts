export interface ReturnPolicySection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  note?: string;
}

export interface ReturnPolicyCopy {
  title: string;
  subtitle: string;
  updated: string;
  withdrawalCta: string;
  sections: ReturnPolicySection[];
  form: {
    title: string;
    description: string;
    firstName: string;
    lastName: string;
    email: string;
    orderNumber: string;
    items: string;
    itemsHint: string;
    submit: string;
    submitting: string;
    successTitle: string;
    successText: string;
    reference: string;
    submittedAt: string;
    receiptFailureTitle: string;
    receiptFailureText: string;
    newRequest: string;
    error: string;
    privacy: string;
    sellerContact: string;
  };
  sellerTitle: string;
  sellerAddress: string;
  sellerEmail: string;
  registrationNumberLabel: string;
  vatNumberLabel: string;
  returnAddressTitle: string;
  returnAddressNote: string;
  sourcesTitle: string;
  sources: string[];
  sourceUrls?: string[];
}

const COPY: Record<"fr" | "ro" | "en", ReturnPolicyCopy> = {
  fr: {
    title: "Politique de retour et de remboursement",
    subtitle:
      "Cette page résume le droit légal de rétractation applicable aux achats à distance des consommateurs en France et dans l’Union européenne. Elle ne limite aucun droit impératif prévu par la loi applicable.",
    updated: "Dernière mise à jour : 5 octobre 2026",
    withdrawalCta: "Exercer votre droit de rétractation",
    sections: [
      {
        title: "À qui s’applique cette politique ?",
        paragraphs: [
          "Le droit légal de rétractation décrit ici concerne les consommateurs qui concluent un contrat à distance sur le site. Un consommateur est une personne physique qui agit à des fins étrangères à son activité professionnelle.",
          "Les achats effectués par une entreprise pour les besoins de son activité professionnelle ne bénéficient en principe pas du délai légal de rétractation réservé aux consommateurs. Cette distinction ne supprime aucune garantie légale applicable."
        ]
      },
      {
        title: "Délai légal de rétractation : 14 jours",
        bullets: [
          "Biens : vous pouvez notifier votre rétractation dans les 14 jours calendaires suivant la réception du bien. Pour une commande livrée en plusieurs fois ou composée de plusieurs biens livrés séparément, le délai court à partir de la réception du dernier bien ou lot.",
          "Services et abonnements : le délai de 14 jours court à compter de la conclusion du contrat.",
          "Vous n’avez pas à justifier votre décision. Si la date d’échéance tombe un samedi, un dimanche ou un jour férié, les règles légales de prorogation s’appliquent."
        ],
        paragraphs: [
          "Si nous ne vous avons pas informé de votre droit de rétractation comme la loi l’exige, le délai peut être prolongé de 12 mois au-delà du délai initial. Si l’information vous est communiquée pendant cette période, vous disposez alors de 14 jours à compter de sa réception pour vous rétracter."
        ]
      },
      {
        title: "Comment exercer votre droit ?",
        paragraphs: [
          "Pour les contrats conclus en ligne, vous pouvez utiliser le formulaire de rétractation sur cette page. Indiquez votre nom et prénom, la référence de commande permettant d’identifier le contrat et l’adresse e-mail à laquelle recevoir l’accusé de réception, puis sélectionnez « Confirmer la rétractation ». Aucun motif n’est demandé.",
          "Vous pouvez également nous notifier votre décision par une déclaration claire envoyée à l’adresse e-mail ou à l’adresse postale du vendeur indiquée ci-dessous. L’envoi du formulaire en ligne constitue une notification de rétractation ; il ne déclenche pas automatiquement un remboursement."
        ]
      },
      {
        title: "Retour des biens",
        bullets: [
          "Après avoir notifié votre rétractation, renvoyez les biens sans retard excessif et au plus tard dans les 14 jours calendaires suivant cette notification.",
          "Vous pouvez manipuler les biens dans la mesure nécessaire pour en vérifier la nature, les caractéristiques et le fonctionnement. Une dépréciation résultant de manipulations allant au-delà de cette vérification peut rester à votre charge dans les conditions prévues par la loi.",
          "Les frais directs de retour sont à votre charge si vous en avez été informé avant l’achat, sauf si nous acceptons de les prendre en charge ou si la loi nous impose de le faire. Si vous ne connaissez pas l’adresse de retour, contactez-nous immédiatement pour obtenir les instructions ; cela ne modifie pas le délai légal de renvoi."
        ]
      },
      {
        title: "Remboursement",
        bullets: [
          "Nous remboursons les sommes dues sans retard injustifié et au plus tard dans les 14 jours suivant la réception de votre notification de rétractation.",
          "Pour un achat de biens, nous pouvons différer le remboursement jusqu’à la récupération des biens ou jusqu’à ce que vous fournissiez une preuve de leur expédition, la première de ces dates étant retenue, sauf si nous proposons de récupérer les biens.",
          "Le remboursement est effectué avec le même moyen de paiement que celui utilisé lors de la commande, sans frais pour vous, sauf accord exprès pour un autre moyen.",
          "En cas de rétractation totale, les frais de livraison standard initiaux sont remboursés. Les frais supplémentaires résultant du choix d’une livraison plus coûteuse que l’option standard la moins chère ne sont pas remboursés. Pour une rétractation partielle, le remboursement des frais de livraison dépend des règles légales applicables."
        ],
        paragraphs: [
          "Pour un service ou un abonnement dont l’exécution a commencé pendant le délai de rétractation à votre demande expresse, un montant proportionnel au service déjà fourni peut être dû. Les conditions légales particulières sont décrites dans la section « Exceptions légales »."
        ]
      },
      {
        title: "Exceptions prévues par la loi",
        paragraphs: [
          "Le droit de rétractation ne s’applique pas à certaines catégories prévues par la loi, uniquement lorsque toutes les conditions légales correspondantes sont réunies. Les principales exceptions susceptibles de concerner des achats sur ce site sont :"
        ],
        bullets: [
          "Biens confectionnés selon vos spécifications ou clairement personnalisés.",
          "Biens susceptibles de se détériorer ou de se périmer rapidement.",
          "Biens scellés ne pouvant être renvoyés pour des raisons de santé ou d’hygiène lorsque vous les avez descellés après la livraison.",
          "Contenu numérique non fourni sur un support matériel dont l’exécution a commencé après votre consentement préalable exprès et la reconnaissance de la perte du droit de rétractation.",
          "Services pleinement exécutés avant la fin du délai, uniquement si vous avez demandé leur exécution immédiate et reconnu expressément que vous perdrez votre droit après leur exécution complète."
        ],
        note: "L’ouverture d’un emballage ne supprime pas automatiquement le droit de rétractation : l’exception d’hygiène ne concerne que les biens qui remplissent réellement les conditions légales ci-dessus. Les exceptions ne s’appliquent pas de manière générale à tous les produits."
      },
      {
        title: "Produit défectueux ou non conforme",
        paragraphs: [
          "Le droit de rétractation pour changement d’avis est distinct des garanties légales. En France, la garantie légale de conformité des biens de consommation s’exerce pendant au moins deux ans à compter de la délivrance du bien, sous réserve des conditions prévues par la loi. Certains pays de l’Union européenne peuvent accorder une protection plus longue.",
          "Si un produit est défectueux ou ne correspond pas au contrat, contactez-nous en décrivant le problème. Les recours et délais prévus par les garanties légales restent applicables indépendamment de cette politique."
        ]
      }
    ],
    form: {
      title: "Formulaire de rétractation en ligne",
      description:
        "Ce formulaire est accessible sans connexion à un compte et reste disponible sur cette page. Les champs servent à identifier le contrat et à vous envoyer l’accusé de réception.",
      firstName: "Prénom",
      lastName: "Nom",
      email: "Adresse e-mail pour l’accusé de réception",
      orderNumber: "Référence de commande",
      items: "Articles concernés, si votre demande est partielle (facultatif)",
      itemsHint: "Laissez ce champ vide si votre demande concerne toute la commande.",
      submit: "Confirmer la rétractation",
      submitting: "Envoi en cours…",
      successTitle: "Votre déclaration a été envoyée",
      successText:
        "Nous avons transmis votre déclaration au vendeur et envoyé un accusé de réception à l’adresse e-mail indiquée. Cet accusé reprend le contenu de la demande ainsi que sa date et son heure d’envoi. Il confirme la réception de la déclaration, pas l’exécution du remboursement.",
      reference: "Référence de suivi",
      submittedAt: "Date et heure d’envoi",
      receiptFailureTitle: "Déclaration transmise, accusé de réception non envoyé",
      receiptFailureText:
        "Votre déclaration a été transmise au vendeur, mais nous n’avons pas pu envoyer l’accusé de réception par e-mail. Contactez-nous avec les coordonnées ci-dessous en indiquant votre commande et l’heure d’envoi.",
      newRequest: "Envoyer une autre déclaration",
      error: "La déclaration n’a pas pu être transmise. Réessayez ou utilisez les coordonnées du vendeur ci-dessous.",
      privacy:
        "Les informations fournies sont utilisées pour traiter votre déclaration et vous envoyer une preuve de réception. Pour en savoir plus sur le traitement de vos données, consultez notre politique de confidentialité.",
      sellerContact: "Contacter le vendeur"
    },
    sellerTitle: "Coordonnées du vendeur",
    sellerAddress: "Adresse postale",
    sellerEmail: "E-mail",
    registrationNumberLabel: "SIRET",
    vatNumberLabel: "N° de TVA intracommunautaire",
    returnAddressTitle: "Adresse de retour",
    returnAddressNote:
      "Si les documents de votre commande ne précisent pas l’adresse de renvoi, contactez-nous avant l’expédition afin d’obtenir les instructions de retour. N’attendez pas pour notifier votre rétractation.",
    sourcesTitle: "Sources officielles",
    sources: [
      "Code de la consommation français, articles L. 221-18 à L. 221-28",
      "Code de la consommation français, article D. 221-5 (fonctionnalité de rétractation en ligne)",
      "Union européenne — Your Europe : Retours et droit de rétractation"
    ]
  },
  ro: {
    title: "Politica de retur și rambursare",
    subtitle:
      "Această pagină rezumă dreptul legal de retragere aplicabil achizițiilor la distanță făcute de consumatori în Franța și Uniunea Europeană. Nu limitează niciun drept obligatoriu prevăzut de legea aplicabilă.",
    updated: "Ultima actualizare: 5 octombrie 2026",
    withdrawalCta: "Exercitați dreptul de retragere",
    sections: [
      {
        title: "Cui i se aplică această politică?",
        paragraphs: [
          "Dreptul legal de retragere descris aici se aplică consumatorilor care încheie un contract la distanță pe site. Consumatorul este o persoană fizică ce acționează în afara activității sale profesionale.",
          "Achizițiile făcute de o companie pentru activitatea sa profesională nu beneficiază, în principiu, de termenul legal de retragere destinat consumatorilor. Această distincție nu elimină garanțiile legale aplicabile."
        ]
      },
      {
        title: "Termenul legal de retragere: 14 zile",
        bullets: [
          "Bunuri: puteți notifica retragerea în 14 zile calendaristice de la primirea bunului. Dacă o comandă este livrată în mai multe tranșe sau conține bunuri livrate separat, termenul începe de la primirea ultimului bun sau lot.",
          "Servicii și abonamente: termenul de 14 zile începe de la încheierea contractului.",
          "Nu trebuie să justificați decizia. Dacă termenul expiră într-o zi de weekend sau sărbătoare legală, se aplică regulile legale de prelungire."
        ],
        paragraphs: [
          "Dacă nu v-am informat despre dreptul de retragere așa cum cere legea, termenul poate fi prelungit cu 12 luni după expirarea termenului inițial. Dacă vă informăm în această perioadă, aveți 14 zile de la primirea informației pentru a vă retrage."
        ]
      },
      {
        title: "Cum vă exercitați dreptul?",
        paragraphs: [
          "Pentru contractele încheiate online, puteți folosi formularul de retragere de pe această pagină. Introduceți numele și prenumele, referința comenzii care identifică contractul și adresa de e-mail pentru confirmare, apoi apăsați „Confirmă retragerea”. Nu vi se cere un motiv.",
          "Ne puteți comunica decizia și printr-o declarație clară trimisă la adresa de e-mail sau poștală a vânzătorului de mai jos. Trimiterea formularului online notifică retragerea; nu declanșează automat rambursarea."
        ]
      },
      {
        title: "Returnarea bunurilor",
        bullets: [
          "După notificarea retragerii, trimiteți bunurile înapoi fără întârzieri nejustificate și cel târziu în 14 zile calendaristice de la notificare.",
          "Puteți manipula bunurile atât cât este necesar pentru a le verifica natura, caracteristicile și funcționarea. O diminuare a valorii cauzată de manipulări peste ceea ce este necesar poate rămâne în sarcina dumneavoastră în condițiile legii.",
          "Costurile directe de retur vă revin dacă ați fost informat despre ele înainte de cumpărare, cu excepția cazului în care acceptăm să le suportăm sau legea ne obligă. Dacă nu cunoașteți adresa de retur, contactați-ne imediat pentru instrucțiuni; termenul legal de expediere rămâne neschimbat."
        ]
      },
      {
        title: "Rambursarea",
        bullets: [
          "Rambursăm sumele datorate fără întârzieri nejustificate și cel târziu în 14 zile de la primirea notificării de retragere.",
          "Pentru bunuri, putem amâna rambursarea până când primim bunurile sau până când ne furnizați dovada expedierii lor, luându-se în calcul momentul care survine primul, cu excepția cazului în care oferim să recuperăm bunurile.",
          "Rambursarea se face prin aceeași metodă de plată folosită la comandă, fără costuri pentru dumneavoastră, cu excepția cazului în care acceptați în mod expres o altă metodă.",
          "La retragerea din întreaga comandă, rambursăm costul inițial al livrării standard. Costul suplimentar al unei livrări mai scumpe decât cea standard cea mai ieftină nu se rambursează. Pentru retragerea parțială, rambursarea livrării depinde de normele legale aplicabile."
        ],
        paragraphs: [
          "Dacă un serviciu sau abonament a început în perioada de retragere la cererea dumneavoastră expresă, se poate datora o sumă proporțională cu serviciul deja furnizat. Consultați secțiunea „Excepții legale”."
        ]
      },
      {
        title: "Excepții prevăzute de lege",
        paragraphs: [
          "Dreptul de retragere nu se aplică anumitor categorii prevăzute de lege, numai dacă sunt îndeplinite toate condițiile legale corespunzătoare. Principalele excepții care ar putea fi relevante pentru cumpărăturile de pe acest site sunt:"
        ],
        bullets: [
          "Bunuri realizate după specificațiile dumneavoastră sau personalizate clar.",
          "Bunuri care se pot deteriora sau expira rapid.",
          "Bunuri sigilate care nu pot fi returnate din motive de sănătate sau igienă, dacă au fost desigilate după livrare.",
          "Conținut digital fără suport material, a cărui furnizare a început după acordul expres prealabil și confirmarea pierderii dreptului de retragere.",
          "Servicii executate integral înainte de expirarea termenului numai dacă ați cerut începerea imediată și ați recunoscut expres că pierdeți dreptul după executarea completă."
        ],
        note: "Deschiderea unui ambalaj nu anulează automat dreptul de retragere: excepția de igienă se aplică numai bunurilor care îndeplinesc efectiv condițiile legale de mai sus. Excepțiile nu se aplică în bloc tuturor produselor."
      },
      {
        title: "Produse defecte sau neconforme",
        paragraphs: [
          "Dreptul de retragere pentru răzgândire este separat de garanțiile legale. În Franța, garanția legală de conformitate pentru bunuri de consum se aplică cel puțin doi ani de la livrare, în condițiile legii. Unele țări din Uniunea Europeană pot oferi o perioadă mai lungă.",
          "Dacă un produs este defect sau nu corespunde contractului, contactați-ne și descrieți problema. Remediile și termenele prevăzute de garanțiile legale rămân aplicabile independent de această politică."
        ]
      }
    ],
    form: {
      title: "Formular online de retragere",
      description:
        "Formularul este disponibil fără autentificare și rămâne accesibil pe această pagină. Câmpurile sunt necesare pentru identificarea contractului și trimiterea confirmării.",
      firstName: "Prenume",
      lastName: "Nume",
      email: "Adresa de e-mail pentru confirmare",
      orderNumber: "Referința comenzii",
      items: "Produsele vizate, dacă retragerea este parțială (opțional)",
      itemsHint: "Lăsați necompletat dacă solicitați retragerea din întreaga comandă.",
      submit: "Confirmă retragerea",
      submitting: "Se trimite…",
      successTitle: "Declarația a fost trimisă",
      successText:
        "Am transmis declarația vânzătorului și am trimis o confirmare la adresa de e-mail indicată. Confirmarea include conținutul cererii, data și ora trimiterii. Ea confirmă primirea declarației, nu efectuarea rambursării.",
      reference: "Referință de urmărire",
      submittedAt: "Data și ora trimiterii",
      receiptFailureTitle: "Declarație transmisă, confirmarea nu a putut fi trimisă",
      receiptFailureText:
        "Declarația a fost transmisă vânzătorului, dar nu am putut trimite confirmarea prin e-mail. Contactați-ne folosind datele de mai jos și menționați comanda și ora trimiterii.",
      newRequest: "Trimiteți o altă declarație",
      error: "Declarația nu a putut fi transmisă. Încercați din nou sau folosiți datele de contact ale vânzătorului de mai jos.",
      privacy:
        "Datele furnizate sunt folosite pentru procesarea declarației și trimiterea confirmării. Pentru detalii despre prelucrarea datelor, consultați politica noastră de confidențialitate.",
      sellerContact: "Contactați vânzătorul"
    },
    sellerTitle: "Datele vânzătorului",
    sellerAddress: "Adresă poștală",
    sellerEmail: "E-mail",
    registrationNumberLabel: "Număr de înregistrare",
    vatNumberLabel: "Cod de TVA",
    returnAddressTitle: "Adresa de retur",
    returnAddressNote:
      "Dacă documentele comenzii nu indică adresa de retur, contactați-ne înainte de expediere pentru instrucțiuni. Nu amânați notificarea retragerii.",
    sourcesTitle: "Surse oficiale",
    sources: [
      "Codul francez al consumului, articolele L. 221-18–L. 221-28",
      "Codul francez al consumului, articolul D. 221-5 (funcția online de retragere)",
      "Uniunea Europeană — Your Europe: Retururi și dreptul de retragere"
    ]
  },
  en: {
    title: "Return and Refund Policy",
    subtitle:
      "This page summarizes the statutory withdrawal right for consumers buying at a distance in France and the European Union. It does not limit any mandatory rights under the law that applies to you.",
    updated: "Last updated: 5 October 2026",
    withdrawalCta: "Exercise your right to withdraw",
    sections: [
      {
        title: "Who this policy applies to",
        paragraphs: [
          "The statutory withdrawal right described here applies to consumers who enter into a distance contract on this website. A consumer is a natural person acting outside their trade, business, craft or profession.",
          "Purchases made by a business for professional purposes are generally not covered by the consumer withdrawal period. This distinction does not remove any applicable statutory guarantees."
        ]
      },
      {
        title: "Statutory withdrawal period: 14 days",
        bullets: [
          "Goods: you may notify us that you are withdrawing within 14 calendar days after receiving the goods. For an order delivered in several parts or containing goods delivered separately, the period starts when you receive the last good or lot.",
          "Services and subscriptions: the 14-day period starts when the contract is concluded.",
          "You do not have to give a reason. If the deadline falls on a Saturday, Sunday or public holiday, the statutory rules for extending deadlines apply."
        ],
        paragraphs: [
          "If we did not give you the legally required information about the right to withdraw, the period may be extended by 12 months beyond the original period. If we provide the information during that extension, you then have 14 days from receiving it to withdraw."
        ]
      },
      {
        title: "How to exercise your right",
        paragraphs: [
          "For contracts made online, you can use the withdrawal form on this page. Provide your first and last name, the order reference that identifies the contract, and the email address where you want to receive the acknowledgement, then select “Confirm withdrawal”. You do not have to give a reason.",
          "You may also notify us with a clear statement sent to the seller’s email or postal address below. Submitting the online form notifies us of your withdrawal; it does not automatically issue a refund."
        ]
      },
      {
        title: "Returning goods",
        bullets: [
          "After notifying us that you are withdrawing, send the goods back without undue delay and no later than 14 calendar days after your notice.",
          "You may handle goods as needed to establish their nature, characteristics and functioning. You may be responsible, as provided by law, for any diminished value caused by handling beyond what is necessary for that inspection.",
          "You pay the direct return costs if you were told about them before purchase, unless we agree to pay or the law requires us to. If you do not know the return address, contact us immediately for instructions; the statutory return deadline still applies."
        ]
      },
      {
        title: "Refunds",
        bullets: [
          "We refund the amounts due without undue delay and no later than 14 days after receiving your withdrawal notice.",
          "For goods, we may withhold the refund until we receive them or you provide evidence that you sent them back, whichever happens first, unless we have offered to collect them.",
          "We use the same payment method you used for the order, without charging you a fee, unless you expressly agree to another method.",
          "For a full withdrawal, the original standard delivery cost is refunded. Any extra cost for choosing delivery more expensive than the least expensive standard option is not refunded. For a partial withdrawal, delivery-cost refunds depend on the applicable statutory rules."
        ],
        paragraphs: [
          "If a service or subscription starts during the withdrawal period at your express request, you may owe an amount proportionate to the service already supplied. See “Statutory exceptions” below."
        ]
      },
      {
        title: "Statutory exceptions",
        paragraphs: [
          "The right to withdraw does not apply to certain categories set by law, and only when all relevant legal conditions are met. The main exceptions that could be relevant to purchases on this website include:"
        ],
        bullets: [
          "Goods made to your specifications or clearly personalised.",
          "Goods that are liable to deteriorate or expire rapidly.",
          "Sealed goods that are not suitable for return for health or hygiene reasons, if you unseal them after delivery.",
          "Digital content not supplied on a tangible medium, where supply started after your express prior consent and acknowledgement that you would lose the right to withdraw.",
          "Services fully performed before the period ends, only if you expressly requested immediate performance and acknowledged that you would lose the right after full performance."
        ],
        note: "Opening packaging does not automatically remove the right to withdraw. The hygiene exception applies only to goods that actually meet the legal conditions above; it is not a blanket exclusion for all products."
      },
      {
        title: "Faulty or non-conforming goods",
        paragraphs: [
          "The right to withdraw because you changed your mind is separate from statutory guarantees. In France, the legal guarantee of conformity for consumer goods applies for at least two years from delivery, subject to the statutory conditions. Some EU countries may provide a longer period.",
          "If a product is faulty or does not match the contract, contact us and describe the issue. The remedies and deadlines under statutory guarantees apply independently of this policy."
        ]
      }
    ],
    form: {
      title: "Online withdrawal form",
      description:
        "This form is available without signing in and remains accessible on this page. The fields identify the contract and provide an email address for your acknowledgement.",
      firstName: "First name",
      lastName: "Last name",
      email: "Email address for acknowledgement",
      orderNumber: "Order reference",
      items: "Items concerned, if your request is partial (optional)",
      itemsHint: "Leave blank if you are withdrawing from the entire order.",
      submit: "Confirm withdrawal",
      submitting: "Submitting…",
      successTitle: "Your declaration has been sent",
      successText:
        "We sent your declaration to the seller and sent an acknowledgement to the email address you provided. The acknowledgement includes the contents of your notice and the date and time it was sent. It confirms receipt of your declaration, not that a refund has been completed.",
      reference: "Tracking reference",
      submittedAt: "Date and time submitted",
      receiptFailureTitle: "Declaration sent, acknowledgement not delivered",
      receiptFailureText:
        "Your declaration was sent to the seller, but we could not email the acknowledgement. Contact us using the details below and include your order reference and submission time.",
      newRequest: "Submit another declaration",
      error: "We could not send your declaration. Please try again or use the seller contact details below.",
      privacy:
        "We use the information you provide to process your declaration and send proof of receipt. See our Privacy Policy for more information about data processing.",
      sellerContact: "Contact the seller"
    },
    sellerTitle: "Seller contact details",
    sellerAddress: "Postal address",
    sellerEmail: "Email",
    registrationNumberLabel: "Company registration number",
    vatNumberLabel: "VAT number",
    returnAddressTitle: "Return address",
    returnAddressNote:
      "If your order documents do not show the return address, contact us before dispatch for instructions. Do not delay notifying us that you are withdrawing.",
    sourcesTitle: "Official sources",
    sources: [
      "French Consumer Code, Articles L. 221-18 to L. 221-28",
      "French Consumer Code, Article D. 221-5 (online withdrawal functionality)",
      "European Union — Your Europe: Returns and the right of withdrawal"
    ]
  }
};

type PolicyLanguage = "fr" | "ro" | "en";
type PolicyMarket = "fr" | "ro" | "com";
type PolicySourceKey =
  | "frWithdrawal"
  | "frOnlineWithdrawal"
  | "roWithdrawal"
  | "roGuarantee"
  | "euConsumerRights"
  | "euGoodsGuarantee"
  | "euReturns";

const MARKET_POLICY: Record<PolicyMarket, {
  subtitle: Record<PolicyLanguage, string>;
  warrantyParagraphs: Record<PolicyLanguage, string[]>;
  onlineWithdrawalNotice?: Record<PolicyLanguage, string>;
  returnAddressNote?: Record<PolicyLanguage, string>;
  internationalScopeNote?: Record<PolicyLanguage, string>;
  withdrawalSectionTitle?: Record<PolicyLanguage, string>;
  sourceKeys: PolicySourceKey[];
}> = {
  fr: {
    subtitle: {
      fr: "Cette version s’applique aux commandes passées sur le domaine français, selon les règles françaises et européennes applicables. Elle ne limite aucun droit impératif supplémentaire.",
      ro: "Această versiune se aplică comenzilor plasate pe domeniul francez, potrivit normelor franceze și europene aplicabile. Nu limitează niciun drept obligatoriu suplimentar.",
      en: "This version applies to orders placed on the French storefront under applicable French and EU rules. It does not limit any additional mandatory rights.",
    },
    warrantyParagraphs: {
      fr: [
        "En France, la garantie légale de conformité des biens de consommation s’exerce pendant au moins deux ans à compter de leur délivrance, dans les conditions prévues par la loi.",
        "Si un produit est défectueux ou ne correspond pas au contrat, contactez-nous en décrivant le problème. Les recours et délais prévus par les garanties légales restent applicables indépendamment de cette politique.",
      ],
      ro: [
        "În Franța, garanția legală de conformitate pentru bunurile de consum se aplică cel puțin doi ani de la livrare, în condițiile prevăzute de lege.",
        "Dacă un produs este defect sau nu corespunde contractului, contactați-ne și descrieți problema. Remediile și termenele garanțiilor legale rămân aplicabile independent de această politică.",
      ],
      en: [
        "In France, the legal guarantee of conformity for consumer goods applies for at least two years from delivery, subject to statutory conditions.",
        "If a product is faulty or does not match the contract, contact us and describe the issue. Statutory remedies and deadlines apply independently of this policy.",
      ],
    },
    onlineWithdrawalNotice: {
      fr: "Depuis le 19 juin 2026, la loi française impose une fonctionnalité gratuite de rétractation en ligne pour les contrats conclus au moyen d’une interface en ligne. Le formulaire ci-dessus permet de transmettre votre déclaration.",
      ro: "Începând cu 19 iunie 2026, legislația franceză impune o funcție online gratuită de retragere pentru contractele încheiate printr-o interfață online. Formularul de mai sus permite transmiterea declarației.",
      en: "Since 19 June 2026, French law requires a free online withdrawal functionality for contracts concluded through an online interface. Use the form above to submit your declaration.",
    },
    returnAddressNote: {
      fr: "Après avoir notifié votre rétractation, renvoyez les biens à l’adresse de retour indiquée ci-dessous dans le délai légal de 14 jours.",
      ro: "După notificarea retragerii, trimiteți bunurile la adresa de retur afișată mai jos, în termenul legal de 14 zile.",
      en: "After notifying us of your withdrawal, send the goods to the return address shown below within the statutory 14-day period.",
    },
    sourceKeys: ["frWithdrawal", "frOnlineWithdrawal", "euReturns"],
  },
  ro: {
    subtitle: {
      fr: "Cette version s’applique aux commandes passées sur le domaine roumain, conformément au droit roumain et aux règles européennes applicables.",
      ro: "Această versiune se aplică comenzilor plasate pe domeniul românesc, potrivit legislației române și normelor europene aplicabile.",
      en: "This version applies to orders placed on the Romanian storefront under Romanian and applicable EU law.",
    },
    warrantyParagraphs: {
      fr: [
        "En Roumanie, la garantie légale de conformité des biens de consommation est régie notamment par l’ordonnance d’urgence nº 140/2021. Le vendeur répond des défauts de conformité qui apparaissent dans le délai légal de deux ans à compter de la livraison, sous réserve des conditions prévues par la loi.",
        "Si un produit est défectueux ou ne correspond pas au contrat, contactez-nous en décrivant le problème. Les recours et délais prévus par la législation roumaine restent applicables indépendamment de cette politique.",
      ],
      ro: [
        "În România, garanția legală de conformitate pentru bunurile de consum este reglementată, între altele, de OUG nr. 140/2021. Vânzătorul răspunde pentru neconformitățile care apar în termenul legal de doi ani de la livrare, cu respectarea condițiilor prevăzute de lege.",
        "Dacă un produs este defect sau nu corespunde contractului, contactați-ne și descrieți problema. Remediile și termenele din legislația română se aplică independent de această politică.",
      ],
      en: [
        "In Romania, the statutory conformity guarantee for consumer goods is governed in particular by Emergency Ordinance No. 140/2021. The seller is liable for lack of conformity that becomes apparent within the statutory two-year period from delivery, subject to the conditions set by law.",
        "If a product is faulty or does not match the contract, contact us and describe the issue. Remedies and deadlines under Romanian law apply independently of this policy.",
      ],
    },
    sourceKeys: ["roWithdrawal", "roGuarantee", "euReturns"],
  },
  com: {
    subtitle: {
      fr: "Cette version concerne les commandes passées sur le domaine .com. Elle résume les protections européennes lorsqu’elles s’appliquent et ne limite pas les droits impératifs prévus dans votre pays de résidence.",
      ro: "Această versiune se aplică comenzilor plasate pe domeniul .com. Rezumă protecțiile europene acolo unde se aplică și nu limitează drepturile obligatorii din țara dumneavoastră de reședință.",
      en: "This version covers orders placed through the .com storefront. It summarizes EU protections where they apply and does not limit mandatory consumer rights in your country of residence.",
    },
    warrantyParagraphs: {
      fr: [
        "Les garanties légales et les recours applicables dépendent du pays concerné. Cette politique ne limite pas les protections impératives accordées aux consommateurs par la loi applicable dans leur pays de résidence.",
        "Si un produit est défectueux ou ne correspond pas au contrat, contactez-nous en décrivant le problème. Les garanties légales applicables restent distinctes du droit de rétractation.",
      ],
      ro: [
        "Garanțiile legale și remediile disponibile depind de țara aplicabilă. Această politică nu limitează protecțiile obligatorii acordate consumatorilor de legea aplicabilă în țara lor de reședință.",
        "Dacă un produs este defect sau nu corespunde contractului, contactați-ne și descrieți problema. Garanțiile legale aplicabile sunt distincte de dreptul de retragere.",
      ],
      en: [
        "Statutory guarantees and available remedies depend on the applicable country law. This policy does not limit mandatory consumer protections in your country of residence.",
        "If a product is faulty or does not match the contract, contact us and describe the issue. Applicable statutory guarantees are separate from the right to withdraw.",
      ],
    },
    internationalScopeNote: {
      fr: "Les délais européens de 14 jours ci-dessous s’appliquent lorsque le droit européen régit la commande. La loi impérative du pays de résidence peut prévoir d’autres délais ou protections plus favorables.",
      ro: "Termenele europene de 14 zile de mai jos se aplică atunci când dreptul UE guvernează comanda. Legea obligatorie din țara de reședință poate prevedea termene diferite sau protecții suplimentare.",
      en: "The 14-day periods below describe the EU baseline and apply where EU consumer law governs the order. Mandatory law in your country of residence may provide different deadlines or additional rights.",
    },
    withdrawalSectionTitle: {
      fr: "Délais de rétractation applicables",
      ro: "Termene de retragere aplicabile",
      en: "Applicable withdrawal periods",
    },
    sourceKeys: ["euConsumerRights", "euGoodsGuarantee", "euReturns"],
  },
};

const SOURCE_URLS: Record<PolicySourceKey, string> = {
  frWithdrawal: "https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069565/LEGISCTA000032221365/",
  frOnlineWithdrawal: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053303365",
  roWithdrawal: "https://legislatie.just.ro/Public/DetaliiDocument/204058",
  roGuarantee: "https://legislatie.just.ro/Public/DetaliiDocument/268151",
  euConsumerRights: "https://eur-lex.europa.eu/eli/dir/2011/83/oj/eng",
  euGoodsGuarantee: "https://eur-lex.europa.eu/eli/dir/2019/771/oj/eng",
  euReturns: "https://europa.eu/youreurope/citizens/consumers/shopping/returns/index_en.htm",
};

const SOURCE_LABELS: Record<PolicyLanguage, Record<PolicySourceKey, string>> = {
  fr: {
    frWithdrawal: "Code de la consommation français — articles L. 221-18 à L. 221-28",
    frOnlineWithdrawal: "Code de la consommation français — article D. 221-5 (fonctionnalité en ligne depuis le 19 juin 2026)",
    roWithdrawal: "Roumanie — OUG nº 34/2014 sur les contrats de consommation",
    roGuarantee: "Roumanie — OUG nº 140/2021 sur les ventes de biens aux consommateurs",
    euConsumerRights: "Directive 2011/83/UE relative aux droits des consommateurs",
    euGoodsGuarantee: "Directive (UE) 2019/771 sur les contrats de vente de biens",
    euReturns: "Union européenne — Your Europe : retours et droit de rétractation",
  },
  ro: {
    frWithdrawal: "Codul francez al consumului — articolele L. 221-18–L. 221-28",
    frOnlineWithdrawal: "Codul francez al consumului — articolul D. 221-5 (funcție online din 19 iunie 2026)",
    roWithdrawal: "România — OUG nr. 34/2014 privind contractele încheiate cu consumatorii",
    roGuarantee: "România — OUG nr. 140/2021 privind contractele de vânzare de bunuri",
    euConsumerRights: "Directiva 2011/83/UE privind drepturile consumatorilor",
    euGoodsGuarantee: "Directiva (UE) 2019/771 privind contractele de vânzare de bunuri",
    euReturns: "Uniunea Europeană — Your Europe: retururi și dreptul de retragere",
  },
  en: {
    frWithdrawal: "French Consumer Code — Articles L. 221-18 to L. 221-28",
    frOnlineWithdrawal: "French Consumer Code — Article D. 221-5 (online feature effective 19 June 2026)",
    roWithdrawal: "Romania — Emergency Ordinance No. 34/2014 on consumer contracts",
    roGuarantee: "Romania — Emergency Ordinance No. 140/2021 on consumer sales",
    euConsumerRights: "Directive 2011/83/EU on consumer rights",
    euGoodsGuarantee: "Directive (EU) 2019/771 on contracts for the sale of goods",
    euReturns: "European Union — Your Europe: returns and the right of withdrawal",
  },
};

export function getReturnPolicyCopy(language: string, market?: string): ReturnPolicyCopy {
  const normalizedLanguage: PolicyLanguage =
    language === "fr" || language === "ro" || language === "en" ? language : "en";
  const inferredMarket = normalizedLanguage === "fr" || normalizedLanguage === "ro"
    ? normalizedLanguage
    : "com";
  const normalizedMarket: PolicyMarket =
    market === "fr" || market === "ro" || market === "com" ? market : inferredMarket;
  const localizedCopy = COPY[normalizedLanguage];
  const marketPolicy = MARKET_POLICY[normalizedMarket];
  const sections = localizedCopy.sections.map((section) => ({
    ...section,
    paragraphs: section.paragraphs ? [...section.paragraphs] : undefined,
    bullets: section.bullets ? [...section.bullets] : undefined,
  }));

  // The market's law determines the legal claims; the selected language only
  // determines how those claims and labels are presented.
  if (marketPolicy.withdrawalSectionTitle) {
    sections[1].title = marketPolicy.withdrawalSectionTitle[normalizedLanguage];
  }
  if (marketPolicy.internationalScopeNote) {
    const scopeNote = marketPolicy.internationalScopeNote[normalizedLanguage];
    sections[1].paragraphs = [scopeNote, ...(sections[1].paragraphs ?? [])];
  }
  sections[6].paragraphs = [...marketPolicy.warrantyParagraphs[normalizedLanguage]];
  const onlineNotice = marketPolicy.onlineWithdrawalNotice?.[normalizedLanguage];
  if (onlineNotice) {
    sections[2].paragraphs = [...(sections[2].paragraphs ?? []), onlineNotice];
  }

  const sources = marketPolicy.sourceKeys;
  return {
    ...localizedCopy,
    subtitle: marketPolicy.subtitle[normalizedLanguage],
    sections,
    returnAddressNote:
      marketPolicy.returnAddressNote?.[normalizedLanguage] ?? localizedCopy.returnAddressNote,
    sources: sources.map((key) => SOURCE_LABELS[normalizedLanguage][key]),
    sourceUrls: sources.map((key) => SOURCE_URLS[key]),
  };
}

export interface ReturnPolicyContact {
  name?: string;
  address?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  registrationNumber?: string;
  vatNumber?: string;
}

export interface ReturnPolicySellerDetails {
  name: string;
  postalAddress: string[];
  registrationNumber: string;
  vatNumber: string;
  returnAddress: string[];
}

export function getReturnPolicySellerDetails(
  market: string,
  contact: ReturnPolicyContact,
): ReturnPolicySellerDetails {
  if (market === "fr") {
    return {
      name: "Yetique SAS",
      postalAddress: ["122 RUE AMELOT", "75011 PARIS", "France"],
      registrationNumber: "108 196 536 00016",
      vatNumber: "FR72108196536",
      returnAddress: [
        "Saint Laurent Logistic",
        "ZI SECTEUR D",
        "30 ALLEE DES GEOMETRES",
        "06700 SAINT-LAURENT-DU-VAR",
        "France",
      ],
    };
  }

  const locality = [contact.zipCode, contact.city].filter(Boolean).join(" ");
  return {
    name: contact.name ?? "",
    postalAddress: [contact.address, locality, contact.country].filter(
      (line): line is string => Boolean(line),
    ),
    registrationNumber: contact.registrationNumber ?? "",
    vatNumber: contact.vatNumber ?? "",
    returnAddress: [],
  };
}
