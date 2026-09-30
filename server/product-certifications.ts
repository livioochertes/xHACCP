import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import type { RequestHandler } from "express";
import multer from "multer";
import type { ProductCertification } from "@shared/schema";
import { deleteRawFileFromR2, isR2Configured, uploadRawFileToR2 } from "./r2-storage";

const MAX_CERTIFICATIONS = 10;
const MAX_CERTIFICATION_BYTES = 10 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIME_DETAILS: Record<string, { mimeType: string; extension: string }> = {
  "application/pdf": { mimeType: "application/pdf", extension: "pdf" },
  "image/jpeg": { mimeType: "image/jpeg", extension: "jpg" },
  "image/jpg": { mimeType: "image/jpeg", extension: "jpg" },
  "image/png": { mimeType: "image/png", extension: "png" },
  "image/webp": { mimeType: "image/webp", extension: "webp" },
};

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_CERTIFICATION_BYTES,
    files: MAX_CERTIFICATIONS,
  },
  fileFilter: (_req, file, callback) => {
    if (!MIME_DETAILS[file.mimetype.toLowerCase()]) {
      callback(new Error("Only PDF, JPG, PNG, and WebP files are allowed."));
      return;
    }
    callback(null, true);
  },
});

export const uploadProductCertifications: RequestHandler = (req, res, next) => {
  multerUpload.array("certifications", MAX_CERTIFICATIONS)(req, res, (error) => {
    if (error) {
      res.status(400).json({ message: error.message || "Could not upload certificate files." });
      return;
    }
    next();
  });
};

function normalizedMimeType(mimeType: unknown): string | null {
  if (typeof mimeType !== "string") return null;
  return MIME_DETAILS[mimeType.toLowerCase()]?.mimeType || null;
}

export function isValidProductCertificationContent(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "application/pdf") {
    return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
  }
  if (mimeType === "image/webp") {
    return buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

function safeOriginalName(name: string): string {
  const baseName = path.basename(name.replace(/\\/g, "/"));
  const cleaned = baseName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255);
  return cleaned || "certificate";
}

function fileExtension(mimeType: string): string {
  const details = Object.values(MIME_DETAILS).find((item) => item.mimeType === mimeType);
  if (!details) throw new Error("Unsupported certificate file type.");
  return details.extension;
}

export function normalizeProductCertifications(value: unknown): ProductCertification[] {
  if (!Array.isArray(value)) {
    throw new Error("Certificate metadata must be a list.");
  }
  if (value.length > MAX_CERTIFICATIONS) {
    throw new Error(`A product can have up to ${MAX_CERTIFICATIONS} certificates.`);
  }

  const ids = new Set<string>();
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Invalid certificate metadata.");
    }
    const candidate = entry as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id : "";
    const mimeType = normalizedMimeType(candidate.mimeType);
    const name = typeof candidate.name === "string" ? safeOriginalName(candidate.name) : "";
    const url = typeof candidate.url === "string" ? candidate.url : "";
    const size = Number(candidate.size);

    if (!UUID_PATTERN.test(id) || ids.has(id)) {
      throw new Error("Invalid or duplicate certificate ID.");
    }
    if (!mimeType || !name || !Number.isSafeInteger(size) || size < 1 || size > MAX_CERTIFICATION_BYTES) {
      throw new Error("Invalid certificate metadata.");
    }
    const filename = `${id}.${fileExtension(mimeType)}`;
    if (
      url !== `/r2/certifications/${filename}` &&
      url !== `/uploads/certifications/${filename}`
    ) {
      throw new Error("Certificate file URL is not valid.");
    }

    ids.add(id);
    return { id, name, url, mimeType, size };
  });
}

export async function storeProductCertification(file: Express.Multer.File): Promise<ProductCertification> {
  const details = MIME_DETAILS[file.mimetype.toLowerCase()];
  if (!details || file.size < 1 || file.size > MAX_CERTIFICATION_BYTES ||
      !isValidProductCertificationContent(file.buffer, details.mimeType)) {
    throw new Error("The file content does not match a supported PDF or image.");
  }

  const id = randomUUID();
  const filename = `${id}.${details.extension}`;
  let url: string;

  if (isR2Configured()) {
    const uploaded = await uploadRawFileToR2(
      file.buffer,
      `certifications/${filename}`,
      details.mimeType,
    );
    if (!uploaded) throw new Error("Certificate storage is unavailable.");
    url = `/r2/certifications/${filename}`;
  } else {
    const directory = path.resolve(process.cwd(), "uploads", "certifications");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), file.buffer, { flag: "wx" });
    url = `/uploads/certifications/${filename}`;
  }

  return {
    id,
    name: safeOriginalName(file.originalname),
    url,
    mimeType: details.mimeType,
    size: file.size,
  };
}

export async function deleteProductCertification(file: ProductCertification): Promise<boolean> {
  let normalized: ProductCertification;
  try {
    normalized = normalizeProductCertifications([file])[0];
  } catch {
    return false;
  }

  const filename = `${normalized.id}.${fileExtension(normalized.mimeType)}`;
  if (normalized.url === `/r2/certifications/${filename}`) {
    return deleteRawFileFromR2(`certifications/${filename}`);
  }

  if (normalized.url === `/uploads/certifications/${filename}`) {
    const filePath = path.resolve(process.cwd(), "uploads", "certifications", filename);
    try {
      await unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
      throw error;
    }
  }

  return false;
}