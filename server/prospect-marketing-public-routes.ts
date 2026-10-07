import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import {
  getProspectById,
  markProspectVoucherEmailSent,
  subscribeProspectAndCreateVoucher,
  unsubscribeProspect,
} from "./prospect-marketing-db";
import { verifyProspectMarketingToken } from "./prospect-marketing-security";
import { sendProspectNewsletterVoucherEmail } from "./email-service";
import { formatEventVoucherDiscount } from "./event-voucher";

const newsletterRegistrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function unsubscribePage(token: string): string {
  const safeToken = htmlEscape(token);
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Se désabonner — xHACCP</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#f5f7fa;color:#172033;margin:0;padding:32px}.card{max-width:560px;margin:10vh auto;background:white;padding:32px;border-radius:14px;box-shadow:0 8px 30px #0f172a14}button{background:#0f766e;color:white;border:0;border-radius:8px;padding:12px 18px;font:inherit;cursor:pointer}</style></head>
<body><main class="card"><h1>Se désabonner</h1><p>Confirmez que vous ne souhaitez plus recevoir les emails de prospection et newsletters xHACCP France.</p>
<form method="post" action="/api/marketing/prospect-unsubscribe?token=${safeToken}"><button type="submit">Confirmer le désabonnement</button></form></main></body></html>`;
}

export function registerProspectMarketingPublicRoutes(app: Express): void {
  app.get("/api/marketing/prospect-subscription", (req, res) => {
    const prospectId = verifyProspectMarketingToken("subscribe", req.query.token);
    if (!prospectId) return res.status(400).json({ message: "Ce lien d'inscription n'est pas valide." });

    void getProspectById(prospectId).then((prospect) => {
      if (!prospect) return res.status(404).json({ message: "Cette invitation n'est plus disponible." });
      if (prospect.subscriptionStatus === "unsubscribed" || prospect.unsubscribedAt) {
        return res.json({ status: "unsubscribed" });
      }
      if (prospect.newsletterConsentAt && prospect.newsletterVoucherId) {
        return res.json({ status: "subscribed", restaurantName: prospect.restaurantName });
      }
      res.json({
        status: "ready",
        restaurantName: prospect.restaurantName,
      });
    }).catch((error) => {
      console.error("Prospect newsletter preview failed");
      res.status(500).json({ message: "Impossible de charger cette invitation." });
    });
  });

  app.post("/api/marketing/prospect-subscription", newsletterRegistrationLimiter, async (req, res) => {
    try {
      const prospectId = verifyProspectMarketingToken("subscribe", req.body?.token);
      if (!prospectId) return res.status(400).json({ message: "Ce lien d'inscription n'est pas valide." });
      if (req.body?.consent !== true) {
        return res.status(400).json({ message: "Veuillez confirmer votre inscription à la newsletter." });
      }

      const result = await subscribeProspectAndCreateVoucher(prospectId);
      const shouldSendVoucher = !result.prospect.voucherEmailSentAt;
      if (shouldSendVoucher) {
        const sent = await sendProspectNewsletterVoucherEmail({
          prospectId,
          to: result.prospect.email,
          restaurantName: result.prospect.restaurantName || "votre restaurant",
          code: result.voucher.code,
          validUntil: result.voucher.validUntil || new Date(),
          activationDeadline: result.voucher.activationDeadline ?? undefined,
          discountType: result.voucher.discountType,
          discountValue: result.voucher.discountValue,
        });
        if (!sent) {
          return res.status(502).json({
            message: "Votre inscription est enregistrée, mais l'email du voucher n'a pas pu être envoyé. Réessayez dans quelques instants.",
          });
        }
        await markProspectVoucherEmailSent(prospectId);
      }

      res.json({
        success: true,
        alreadySubscribed: result.alreadySubscribed,
        message: `Votre inscription est confirmée. Votre code personnel de ${formatEventVoucherDiscount(result.voucher.discountType, result.voucher.discountValue)} vient d'être envoyé par email.`,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "This address has unsubscribed") {
        return res.status(410).json({ message: "Cette adresse est désabonnée de nos communications." });
      }
      console.error("Prospect newsletter registration failed");
      res.status(500).json({ message: "L'inscription n'a pas pu être enregistrée. Réessayez." });
    }
  });

  app.get("/api/marketing/prospect-unsubscribe", (req, res) => {
    const prospectId = verifyProspectMarketingToken("unsubscribe", req.query.token);
    if (!prospectId) return res.status(400).type("text").send("Lien de désabonnement invalide.");
    res.type("html").send(unsubscribePage(String(req.query.token)));
  });

  app.post("/api/marketing/prospect-unsubscribe", async (req: Request, res: Response) => {
    const prospectId = verifyProspectMarketingToken("unsubscribe", req.query.token);
    if (!prospectId) return res.status(400).type("text").send("Lien de désabonnement invalide.");
    try {
      const prospect = await getProspectById(prospectId);
      if (!prospect) return res.status(404).type("text").send("Cette adresse n'a pas été trouvée.");
      await unsubscribeProspect(prospectId);
      res.type("html").send("<!doctype html><html lang=\"fr\"><meta charset=\"utf-8\"><title>Désabonnement confirmé</title><body style=\"font:16px system-ui,sans-serif;max-width:560px;margin:12vh auto;padding:24px\"><h1>Désabonnement confirmé</h1><p>Vous ne recevrez plus les emails de prospection ou newsletters xHACCP France.</p></body></html>");
    } catch (error) {
      console.error("Prospect unsubscribe failed");
      res.status(500).type("text").send("Le désabonnement n'a pas pu être enregistré.");
    }
  });
}
