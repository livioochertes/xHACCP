import { extractCampaignEventCorrelation } from "./marketing-campaign-delivery-policy";

const SENDGRID_API_BASE_URL = "https://api.sendgrid.com/v3";
const SENDGRID_LOG_LIMIT = 1_000;
const SENDGRID_HISTORY_CONCURRENCY = 4;
const IMPORTABLE_EVENT_TYPES = new Set([
  "processed",
  "delivered",
  "deferred",
  "bounce",
  "blocked",
  "dropped",
  "spamreport",
  "unsubscribe",
  "group_unsubscribe",
  "group_resubscribe",
  "open",
  "click",
]);

export interface SendGridHistoryRecipient {
  id: number;
  email: string;
}

export interface SendGridHistoryEvent {
  eventId: string;
  recipientId: number;
  eventType: string;
  occurredAt: Date | null;
}

export interface SendGridCampaignHistoryResult {
  providerMessages: number;
  matchedMessages: number;
  unmatchedMessages: number;
  skippedEvents: number;
  events: SendGridHistoryEvent[];
}

export interface SendGridCampaignHistoryProgress {
  processedMessages: number;
  matchedMessages: number;
  unmatchedMessages: number;
  eventCount: number;
}

interface SendGridLogMessage {
  sg_message_id?: unknown;
  subject?: unknown;
  to_email?: unknown;
  sg_message_id_created_at?: unknown;
}

interface SendGridLogEvent {
  event?: unknown;
  sg_event_id?: unknown;
  timestamp?: unknown;
  type?: unknown;
  sg_machine_open?: unknown;
  email?: unknown;
  custom_args?: unknown;
  customArgs?: unknown;
}

interface SendGridLogDetails extends SendGridLogMessage {
  custom_args?: unknown;
  customArgs?: unknown;
  events?: unknown;
}

function quoteQueryString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function timestampQueryValue(date: Date): string {
  return `TIMESTAMP "${date.toISOString()}"`;
}

function getTimestamp(value: unknown): number | null {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 && timestamp < 4_102_444_800
    ? timestamp
    : null;
}

async function requestSendGridJson<T>(
  apiKey: string,
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(init.headers || {}),
        },
      });
    } catch {
      if (attempt === 3) throw new Error("SendGrid Email Logs could not be reached");
      await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
      continue;
    }

    if (response.ok) {
      try {
        return await response.json() as T;
      } catch {
        throw new Error("SendGrid Email Logs returned an invalid response");
      }
    }

    if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : 0;
      const delay = Math.min(30_000, Math.max(500 * (2 ** attempt), retryAfterMs));
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(`SendGrid Email Logs access denied (HTTP ${response.status})`);
    }
    if (response.status === 404) {
      throw new Error("SendGrid Email Logs did not find the requested message");
    }
    throw new Error(`SendGrid Email Logs request failed (HTTP ${response.status})`);
  }
  throw new Error("SendGrid Email Logs request failed");
}

async function listMessagesForWindow(
  apiKey: string,
  subject: string,
  from: Date,
  to: Date,
  fetchImpl: typeof fetch,
): Promise<SendGridLogMessage[]> {
  const query = [
    `sg_message_id_created_at >= ${timestampQueryValue(from)}`,
    `sg_message_id_created_at < ${timestampQueryValue(to)}`,
    `subject = ${quoteQueryString(subject)}`,
  ].join(" AND ");
  const result = await requestSendGridJson<{ messages?: SendGridLogMessage[] }>(
    apiKey,
    `${SENDGRID_API_BASE_URL}/logs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: SENDGRID_LOG_LIMIT }),
    },
    fetchImpl,
  );
  const messages = Array.isArray(result.messages) ? result.messages : [];
  if (messages.length < SENDGRID_LOG_LIMIT) return messages;

  const midpoint = from.getTime() + Math.floor((to.getTime() - from.getTime()) / 2);
  if (midpoint <= from.getTime() || midpoint >= to.getTime()) {
    throw new Error("SendGrid history search reached the 1,000-message limit for a one-second window");
  }
  const split = new Date(midpoint);
  const [earlier, later] = await Promise.all([
    listMessagesForWindow(apiKey, subject, from, split, fetchImpl),
    listMessagesForWindow(apiKey, subject, split, to, fetchImpl),
  ]);
  return [...earlier, ...later];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let hasFailure = false;
  let failure: unknown;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      if (hasFailure) return;
      const index = nextIndex++;
      if (index >= items.length) return;
      try {
        results[index] = await mapper(items[index]);
      } catch (error) {
        if (!hasFailure) {
          hasFailure = true;
          failure = error;
        }
        return;
      }
    }
  }));
  if (hasFailure) throw failure;
  return results;
}

export async function fetchSendGridCampaignHistory(options: {
  apiKey: string;
  campaignId: number;
  subject: string;
  from: Date;
  to: Date;
  recipients: SendGridHistoryRecipient[];
  fetchImpl?: typeof fetch;
  onMessagesFound?: (count: number) => Promise<void> | void;
  onProgress?: (progress: SendGridCampaignHistoryProgress) => Promise<void> | void;
}): Promise<SendGridCampaignHistoryResult> {
  const { apiKey, campaignId, subject, from, to, recipients } = options;
  const fetchImpl = options.fetchImpl || fetch;
  if (!apiKey) throw new Error("SendGrid API key is not configured");
  if (!Number.isSafeInteger(campaignId) || campaignId <= 0 || !subject.trim()) {
    throw new Error("Invalid campaign history search");
  }
  if (!(from instanceof Date) || !(to instanceof Date) || from >= to) {
    throw new Error("Invalid campaign history date range");
  }

  const recipientById = new Map(recipients.map((recipient) => [
    recipient.id,
    recipient.email.trim().toLowerCase(),
  ]));
  const messageRows = await listMessagesForWindow(apiKey, subject, from, to, fetchImpl);
  const messages = [...new Map(messageRows
    .filter((message) => typeof message.sg_message_id === "string" && message.sg_message_id.length > 0)
    .map((message) => [message.sg_message_id as string, message])).values()];
  await options.onMessagesFound?.(messages.length);
  let matchedMessages = 0;
  let unmatchedMessages = 0;
  let skippedEvents = 0;
  let processedMessages = 0;
  let progressQueue = Promise.resolve();
  const eventsById = new Map<string, SendGridHistoryEvent>();
  const reportProgress = () => {
    const progress = {
      processedMessages,
      matchedMessages,
      unmatchedMessages,
      eventCount: eventsById.size,
    };
    progressQueue = progressQueue.then(async () => {
      await options.onProgress?.(progress);
    });
    return progressQueue;
  };

  await mapWithConcurrency(messages, SENDGRID_HISTORY_CONCURRENCY, async (message) => {
    try {
      const messageId = message.sg_message_id as string;
      const detail = await requestSendGridJson<SendGridLogDetails>(
        apiKey,
        `${SENDGRID_API_BASE_URL}/logs/${encodeURIComponent(messageId)}`,
        { method: "GET" },
        fetchImpl,
      );
      if (detail.subject !== subject) {
        unmatchedMessages++;
        return;
      }

      const correlation = extractCampaignEventCorrelation(detail);
      const recipientId = correlation.campaignId === campaignId ? correlation.recipientId : 0;
      const recipientEmail = recipientById.get(recipientId);
      const messageEmail = typeof detail.to_email === "string" ? detail.to_email.trim().toLowerCase() : "";
      if (!recipientEmail || !messageEmail || recipientEmail !== messageEmail) {
        unmatchedMessages++;
        return;
      }
      matchedMessages++;

      const messageEvents = Array.isArray(detail.events) ? detail.events as SendGridLogEvent[] : [];
      for (const event of messageEvents) {
        const eventType = typeof event.event === "string" ? event.event.trim().toLowerCase() : "";
        const eventId = typeof event.sg_event_id === "string" ? event.sg_event_id.trim() : "";
        const eventEmail = typeof event.email === "string" ? event.email.trim().toLowerCase() : messageEmail;
        const eventCorrelation = extractCampaignEventCorrelation(event);
        const timestamp = getTimestamp(event.timestamp);
        if (
          !IMPORTABLE_EVENT_TYPES.has(eventType)
          || !eventId
          || eventId.length > 255
          || eventEmail !== recipientEmail
          || (eventCorrelation.campaignId && eventCorrelation.campaignId !== campaignId)
          || (eventCorrelation.recipientId && eventCorrelation.recipientId !== recipientId)
        ) {
          skippedEvents++;
          continue;
        }
        const normalizedType = eventType === "bounce" && event.type === "blocked"
          ? "blocked"
          : eventType === "open" && event.sg_machine_open === true
            ? "machine_open"
            : eventType;
        eventsById.set(eventId, {
          eventId,
          recipientId,
          eventType: normalizedType,
          occurredAt: timestamp === null ? null : new Date(timestamp * 1000),
        });
      }
    } finally {
      processedMessages++;
      if (options.onProgress && (processedMessages % 100 === 0 || processedMessages === messages.length)) {
        await reportProgress();
      }
    }
  });
  await progressQueue;

  return {
    providerMessages: messages.length,
    matchedMessages,
    unmatchedMessages,
    skippedEvents,
    events: [...eventsById.values()],
  };
}
