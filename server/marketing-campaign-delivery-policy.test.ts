import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import {
  extractCampaignEventCorrelation,
  normalizeSendGridEvent,
  nextDeliveryStatus,
  PROSPECT_CLEANUP_SUPPRESSION_REASONS,
  shouldSuppressDroppedProspect,
  splitIntoBatches,
  verifySendGridEventSignature,
} from "./marketing-campaign-delivery-policy";

test("SendGrid campaign correlation avoids the reserved marketing_campaign_id property", () => {
  assert.deepEqual(extractCampaignEventCorrelation({
    custom_args: {
      marketing_campaign_id: "9001",
      xhaccp_campaign_id: "8",
      xhaccp_campaign_recipient_id: "1425",
    },
  }), { campaignId: 8, recipientId: 1425 });

  assert.deepEqual(extractCampaignEventCorrelation({
    unique_args: {
      marketing_campaign_id: "8",
      marketing_campaign_recipient_id: "1425",
    },
  }), { campaignId: 8, recipientId: 1425 });
});

test("marketing sends are divided into ordered batches of at most 500", () => {
  const recipients = Array.from({ length: 1201 }, (_, index) => index);
  const batches = splitIntoBatches(recipients, 500);

  assert.deepEqual(batches.map((batch) => batch.length), [500, 500, 201]);
  assert.deepEqual(batches.flat(), recipients);
});

test("delivery events advance recipient status without replacing stronger terminal states", () => {
  assert.equal(nextDeliveryStatus("accepted", "deferred"), "deferred");
  assert.equal(nextDeliveryStatus("deferred", "delivered"), "delivered");
  assert.equal(nextDeliveryStatus("delivered", "processed"), null);
  assert.equal(nextDeliveryStatus("bounced", "delivered"), null);
  assert.equal(nextDeliveryStatus("accepted", "bounce"), "bounced");
  assert.equal(nextDeliveryStatus("accepted", "spamreport"), "spam_report");
  assert.equal(nextDeliveryStatus("accepted", "group_unsubscribe"), "unsubscribed");
});

test("SendGrid blocked events remain temporary and machine opens are identified", () => {
  assert.deepEqual(normalizeSendGridEvent("bounce", "blocked"), {
    storedEventType: "blocked",
    deliveryEventName: "deferred",
  });
  assert.deepEqual(normalizeSendGridEvent("open", undefined, true), {
    storedEventType: "machine_open",
    deliveryEventName: "machine_open",
  });
  assert.deepEqual(normalizeSendGridEvent("click"), {
    storedEventType: "click",
    deliveryEventName: "click",
  });
  const cleanupReasons: readonly string[] = PROSPECT_CLEANUP_SUPPRESSION_REASONS;
  assert.equal(cleanupReasons.includes("deferred"), false);
  assert.equal(cleanupReasons.includes("sendgrid_dropped"), false);
});

test("only confirmed permanent address failures are removed from prospect lists", () => {
  assert.deepEqual(PROSPECT_CLEANUP_SUPPRESSION_REASONS, [
    "hard_bounce",
    "spam_report",
    "invalid_recipient",
  ]);
});

test("only permanent address-related SendGrid drops are eligible for suppression", () => {
  assert.equal(shouldSuppressDroppedProspect("Invalid Email Address"), true);
  assert.equal(shouldSuppressDroppedProspect("previously unsubscribed"), true);
  assert.equal(shouldSuppressDroppedProspect("Account not active"), false);
  assert.equal(shouldSuppressDroppedProspect(undefined), false);
});

test("SendGrid event signatures are verified against timestamp and exact raw payload", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const timestamp = "1791449880";
  const rawBody = Buffer.from('[{"event":"delivered","sg_event_id":"evt-1"}]', "utf8");
  const signedPayload = Buffer.concat([Buffer.from(timestamp, "utf8"), rawBody]);
  const signature = sign("sha256", signedPayload, privateKey).toString("base64");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const publicKeyBase64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");

  assert.equal(verifySendGridEventSignature(rawBody, signature, timestamp, publicKeyPem), true);
  assert.equal(verifySendGridEventSignature(rawBody, signature, timestamp, publicKeyBase64), true);
  assert.equal(verifySendGridEventSignature(Buffer.from(`${rawBody} `), signature, timestamp, publicKeyPem), false);
  assert.equal(verifySendGridEventSignature(rawBody, signature, "1791449881", publicKeyPem), false);
});

test("SendGrid base64 verification keys validate an official signed webhook fixture", () => {
  const publicKeyBase64 = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE83T4O/n84iotIvIW4mdBgQ/7dAfSmpqIM8kF9mN1flpVKS3GRqe62gw+2fNNRaINXvVpiglSI8eNEc6wEA3F+g==";
  const signature = "MEUCIGHQVtGj+Y3LkG9fLcxf3qfI10QysgDWmMOVmxG0u6ZUAiEAyBiXDWzM+uOe5W0JuG+luQAbPIqHh89M15TluLtEZtM=";
  const timestamp = "1600112502";
  const rawBody = Buffer.from(
    '[{"email":"hello@world.com","event":"dropped","reason":"Bounced Address","sg_event_id":"ZHJvcC0xMDk5NDkxOS1MUnpYbF9OSFN0T0doUTRrb2ZTbV9BLTA","sg_message_id":"LRzXl_NHStOGhQ4kofSm_A.filterdrecv-p3mdw1-756b745b58-kmzbl-18-5F5FC76C-9.0","smtp-id":"<LRzXl_NHStOGhQ4kofSm_A@ismtpd0039p1iad1.sendgrid.net>","timestamp":1600112492}]\r\n',
    "utf8",
  );

  assert.equal(verifySendGridEventSignature(rawBody, signature, timestamp, publicKeyBase64), true);
});
