import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import { getMarketFromRequest } from "./market-routing";

function requestForMarket(
  host: string,
  options: { forwardedHost?: string; queryMarket?: string; headerMarket?: string } = {},
): Request {
  return {
    query: options.queryMarket ? { market: options.queryMarket } : {},
    headers: {
      host,
      ...(options.forwardedHost ? { "x-forwarded-host": options.forwardedHost } : {}),
      ...(options.headerMarket ? { "x-market": options.headerMarket } : {}),
    },
    get(name: string) {
      return this.headers[name.toLowerCase()];
    },
  } as unknown as Request;
}

test("a canonical FR domain cannot be overridden by public market inputs", () => {
  const req = requestForMarket("xhaccp.fr", {
    queryMarket: "ro",
    headerMarket: "com",
  });

  assert.equal(getMarketFromRequest(req), "fr");
});

test("uses the forwarded canonical domain before the internal proxy host", () => {
  const req = requestForMarket("internal-service", {
    forwardedHost: "www.xhaccp.fr",
    queryMarket: "ro",
  });

  assert.equal(getMarketFromRequest(req), "fr");
});

test("keeps explicit market selection available for local development", () => {
  const req = requestForMarket("localhost:5000", { headerMarket: "com" });

  assert.equal(getMarketFromRequest(req), "com");
});