import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchSendGridCampaignHistory } from "./sendgrid-campaign-history";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("historical SendGrid events require matching campaign, recipient ID, and email", async () => {
  let messagesFound = 0;
  const progressUpdates: Array<{ processedMessages: number; matchedMessages: number }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/v3/logs")) {
      return jsonResponse({
        messages: [
          { sg_message_id: "message-1", subject: "Campaign subject", to_email: "one@example.com" },
          { sg_message_id: "message-2", subject: "Campaign subject", to_email: "other@example.com" },
        ],
      });
    }
    if (url.endsWith("/message-1")) {
      return jsonResponse({
        subject: "Campaign subject",
        to_email: "one@example.com",
        custom_args: {
          marketing_campaign_id: "7",
          marketing_campaign_recipient_id: "72",
        },
        events: [
          { event: "processed", sg_event_id: "event-1", timestamp: 1791874000, email: "one@example.com" },
          { event: "delivered", sg_event_id: "event-2", timestamp: 1791874001, email: "one@example.com" },
          { event: "open", sg_event_id: "event-3", timestamp: 1791874002, email: "one@example.com" },
          { event: "received", sg_event_id: "ignored-event", timestamp: 1791874002, email: "one@example.com" },
          { event: "click", sg_event_id: "wrong-recipient", timestamp: 1791874003, email: "wrong@example.com" },
        ],
      });
    }
    return jsonResponse({
      subject: "Campaign subject",
      to_email: "other@example.com",
      custom_args: {
        marketing_campaign_id: "7",
        marketing_campaign_recipient_id: "72",
      },
      events: [{ event: "open", sg_event_id: "event-4", timestamp: 1791874004 }],
    });
  };

  const result = await fetchSendGridCampaignHistory({
    apiKey: "test-key",
    campaignId: 7,
    subject: "Campaign subject",
    from: new Date("2026-10-13T00:00:00.000Z"),
    to: new Date("2026-10-14T00:00:00.000Z"),
    recipients: [{ id: 72, email: "one@example.com" }],
    fetchImpl,
    onMessagesFound: (count) => { messagesFound = count; },
    onProgress: (progress) => {
      progressUpdates.push({
        processedMessages: progress.processedMessages,
        matchedMessages: progress.matchedMessages,
      });
    },
  });

  assert.equal(messagesFound, 2);
  assert.deepEqual(progressUpdates, [{ processedMessages: 2, matchedMessages: 1 }]);
  assert.equal(result.providerMessages, 2);
  assert.equal(result.matchedMessages, 1);
  assert.equal(result.unmatchedMessages, 1);
  assert.equal(result.skippedEvents, 2);
  assert.deepEqual(result.events.map(({ eventId, recipientId, eventType }) => ({
    eventId,
    recipientId,
    eventType,
  })), [
    { eventId: "event-1", recipientId: 72, eventType: "processed" },
    { eventId: "event-2", recipientId: 72, eventType: "delivered" },
    { eventId: "event-3", recipientId: 72, eventType: "open" },
  ]);
});

test("historical SendGrid API errors do not leak response bodies", async () => {
  let requestCount = 0;
  const fetchImpl: typeof fetch = async () => {
    requestCount++;
    return jsonResponse({ errors: [{ message: "private provider detail" }] }, 403);
  };

  await assert.rejects(
    fetchSendGridCampaignHistory({
      apiKey: "test-key",
      campaignId: 7,
      subject: "Campaign subject",
      from: new Date("2026-10-13T00:00:00.000Z"),
      to: new Date("2026-10-14T00:00:00.000Z"),
      recipients: [],
      fetchImpl,
    }),
    /access denied \(HTTP 403\)/,
  );
  assert.equal(requestCount, 1);
});

test("historical SendGrid searches split capped windows because the API has no pagination", async () => {
  const queriedWindows: Array<{ from: string; to: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/v3/logs")) {
      const request = JSON.parse(String(init?.body)) as { query: string };
      const [fromClause, toClause] = request.query.split(" AND ");
      const from = fromClause.match(/TIMESTAMP "([^"]+)"/)?.[1] || "";
      const to = toClause.match(/TIMESTAMP "([^"]+)"/)?.[1] || "";
      queriedWindows.push({ from, to });
      if (queriedWindows.length === 1) {
        return jsonResponse({
          messages: Array.from({ length: 1_000 }, () => ({
            sg_message_id: "capped-placeholder",
            subject: "Campaign subject",
            to_email: "one@example.com",
          })),
        });
      }
      const id = queriedWindows.length === 2 ? "message-1" : "message-2";
      return jsonResponse({
        messages: [{ sg_message_id: id, subject: "Campaign subject", to_email: "one@example.com" }],
      });
    }
    return jsonResponse({
      subject: "Campaign subject",
      to_email: "one@example.com",
      custom_args: {
        marketing_campaign_id: "7",
        marketing_campaign_recipient_id: "72",
      },
      events: [{ event: "open", sg_event_id: `event-${url.endsWith("message-1") ? "1" : "2"}`, timestamp: 1791874000 }],
    });
  };

  const result = await fetchSendGridCampaignHistory({
    apiKey: "test-key",
    campaignId: 7,
    subject: "Campaign subject",
    from: new Date("2026-10-13T00:00:00.000Z"),
    to: new Date("2026-10-15T00:00:00.000Z"),
    recipients: [{ id: 72, email: "one@example.com" }],
    fetchImpl,
  });

  assert.equal(queriedWindows.length, 3);
  assert.equal(queriedWindows[1].to, queriedWindows[2].from);
  assert.equal(result.providerMessages, 2);
  assert.equal(result.events.length, 2);
});

test("historical SendGrid requests retry transient provider failures", async () => {
  let requestCount = 0;
  const fetchImpl: typeof fetch = async () => {
    requestCount++;
    return requestCount < 3
      ? jsonResponse({ errors: [] }, 500)
      : jsonResponse({ messages: [] });
  };

  const result = await fetchSendGridCampaignHistory({
    apiKey: "test-key",
    campaignId: 7,
    subject: "Campaign subject",
    from: new Date("2026-10-13T00:00:00.000Z"),
    to: new Date("2026-10-14T00:00:00.000Z"),
    recipients: [],
    fetchImpl,
  });

  assert.equal(requestCount, 3);
  assert.equal(result.providerMessages, 0);
});
