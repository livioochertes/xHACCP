import type { Express, Request, RequestHandler, Response } from "express";
import multer from "multer";
import { authenticateAdmin, canAccessMarket } from "./admin-routes";
import { parseProspectCsv } from "./prospect-csv";
import {
  importProspectList,
  listProspectLists,
  removeUnsubscribedProspectsFromLists,
} from "./prospect-marketing-db";

type ProspectAdminRequest = Request & {
  adminId?: number;
};

const prospectCsvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

function parseCsvUpload(req: Request, res: Response, next: () => void): void {
  prospectCsvUpload.single("file")(req, res, (error) => {
    if (error) {
      res.status(400).json({
        message: error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
          ? "CSV file is too large; maximum size is 5 MB"
          : "Could not read the CSV file",
      });
      return;
    }
    next();
  });
}

function canManageFrenchProspects(req: Request, res: Response): boolean {
  if (!canAccessMarket(req as any, "fr")) {
    res.status(403).json({ message: "Access denied for the France market" });
    return false;
  }
  return true;
}

function parseUploadedCsv(req: Request) {
  if (!req.file || !req.file.originalname.toLowerCase().endsWith(".csv")) {
    throw new Error("Choose a CSV file");
  }
  return parseProspectCsv(req.file.buffer.toString("utf8"));
}

export function registerProspectMarketingAdminRoutes(
  app: Express,
  authenticate: RequestHandler = authenticateAdmin as RequestHandler,
): void {
  app.get("/admin/api/marketing/prospects/lists", authenticate, async (req, res) => {
    try {
      if (!canManageFrenchProspects(req, res)) return;
      res.json(await listProspectLists("fr"));
    } catch (error) {
      console.error("Prospect list query failed");
      res.status(500).json({ message: "Could not load prospect lists" });
    }
  });

  app.delete("/admin/api/marketing/prospects/unsubscribed-memberships", authenticate, async (req, res) => {
    try {
      if (!canManageFrenchProspects(req, res)) return;
      const removedMemberships = await removeUnsubscribedProspectsFromLists("fr");
      res.json({ removedMemberships });
    } catch (error) {
      console.error("Unsubscribed prospect list cleanup failed");
      res.status(500).json({ message: "Could not remove unsubscribed contacts from lists" });
    }
  });

  app.post(
    "/admin/api/marketing/prospects/preview",
    authenticate,
    (req, res, next) => {
      if (!canManageFrenchProspects(req, res)) return;
      next();
    },
    parseCsvUpload,
    (req, res) => {
      try {
        const result = parseUploadedCsv(req);
        res.json({
          totalRows: result.totalRows,
          validRows: result.rows.length,
          invalidRows: result.invalidRows,
          duplicateRows: result.duplicateRows,
          rows: result.rows.map(({ email, restaurantName, city, source }) => ({
            email,
            restaurantName,
            city,
            source,
          })),
        });
      } catch (error) {
        res.status(400).json({
          message: error instanceof Error ? error.message : "Could not preview the CSV file",
        });
      }
    },
  );

  app.post(
    "/admin/api/marketing/prospects/import",
    authenticate,
    (req, res, next) => {
      if (!canManageFrenchProspects(req, res)) return;
      next();
    },
    parseCsvUpload,
    async (req: ProspectAdminRequest, res: Response) => {
      try {
        if (req.body?.confirmB2bBasis !== "true") {
          return res.status(400).json({
            message: "Confirm that you have a documented B2B contact basis and the invitation is relevant to the recipients' professional activity.",
          });
        }
        const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
        if (!name || name.length > 160) {
          return res.status(400).json({ message: "Enter a list name up to 160 characters" });
        }
        const parsed = parseUploadedCsv(req);
        if (!parsed.rows.length) {
          return res.status(400).json({ message: "The CSV contains no valid email addresses" });
        }
        const result = await importProspectList({
          name,
          sourceFile: req.file?.originalname || "contacts.csv",
          rows: parsed.rows,
          adminId: req.adminId,
        });
        res.status(201).json({
          list: result.list,
          createdContacts: result.createdContacts,
          existingContacts: result.existingContacts,
          invalidRows: parsed.invalidRows,
          duplicateRows: parsed.duplicateRows,
        });
      } catch (error) {
        console.error("Prospect import failed");
        res.status(400).json({
          message: error instanceof Error ? error.message : "Could not import prospect list",
        });
      }
    },
  );
}
