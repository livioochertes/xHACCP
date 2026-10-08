import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import {
  normalizeSendGridEvent,
  nextDeliveryStatus,
  shouldSuppressDroppedProspect,
  splitIntoBatches,
  verifySendGridEventSignature,
} from "./marketing-campaign-delivery-policy";

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

  assert.equal(verifySendGridEventSignature(rawBody, signature, timestamp, publicKeyPem), true);
  assert.equal(verifySendGridEventSignature(Buffer.from(`${rawBody} `), signature, timestamp, publicKeyPem), false);
  assert.equal(verifySendGridEventSignature(rawBody, signature, "1791449881", publicKeyPem), false);
});
