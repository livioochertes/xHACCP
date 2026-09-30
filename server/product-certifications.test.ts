import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidProductCertificationContent,
  normalizeProductCertifications,
} from "./product-certifications";

const certificateId = "123e4567-e89b-42d3-a456-426614174000";

describe("product certification validation", () => {
  it("accepts supported file signatures and rejects MIME mismatches", () => {
    assert.equal(
      isValidProductCertificationContent(Buffer.from("%PDF-1.7\n"), "application/pdf"),
      true,
    );
    assert.equal(
      isValidProductCertificationContent(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"),
      true,
    );
    assert.equal(
      isValidProductCertificationContent(Buffer.from("not a PDF"), "application/pdf"),
      false,
    );
    assert.equal(
      isValidProductCertificationContent(Buffer.from("%PDF-1.7"), "image/png"),
      false,
    );
  });

  it("accepts only valid certificate metadata with local certificate URLs", () => {
    const certificate = {
      id: certificateId,
      name: "Food safety certificate.pdf",
      url: `/r2/certifications/${certificateId}.pdf`,
      mimeType: "application/pdf",
      size: 2048,
    };

    assert.deepEqual(normalizeProductCertifications([certificate]), [certificate]);
  });

  it("rejects external URLs, duplicate IDs, and more than ten files", () => {
    const certificate = {
      id: certificateId,
      name: "Certificate.pdf",
      url: `https://example.com/${certificateId}.pdf`,
      mimeType: "application/pdf",
      size: 2048,
    };

    assert.throws(() => normalizeProductCertifications([certificate]), /URL is not valid/);
    assert.throws(() => normalizeProductCertifications([
      { ...certificate, url: `/uploads/certifications/${certificateId}.pdf` },
      { ...certificate, url: `/uploads/certifications/${certificateId}.pdf` },
    ]), /duplicate certificate ID/);
    assert.throws(() => normalizeProductCertifications(
      Array.from({ length: 11 }, (_, index) => ({
        ...certificate,
        id: `123e4567-e89b-42d3-a456-${String(index).padStart(12, "0")}`,
        url: `/uploads/certifications/123e4567-e89b-42d3-a456-${String(index).padStart(12, "0")}.pdf`,
      })),
    ), /up to 10 certificates/);
  });
});