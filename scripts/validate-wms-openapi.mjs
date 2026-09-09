import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specPath = path.join(root, "docs", "openapi", "wms-v1.json");
const routesPath = path.join(root, "server", "wms-routes.ts");
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const routesSource = fs.readFileSync(routesPath, "utf8");

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const normalizeRoute = (route) => route.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
const routeKey = (method, route) => `${method.toUpperCase()} ${normalizeRoute(route)}`;

check(spec.openapi === "3.0.3", "OpenAPI document must use OpenAPI 3.0.3");
check(spec.info?.version === "1.0.0", "WMS contract version must remain 1.0.0 until a breaking API version is introduced");
check(spec.servers?.[0]?.url?.endsWith("/api/wms/v1"), "The server URL must point at the versioned WMS route");
check(spec.components?.securitySchemes?.bearerAuth?.type === "http", "bearerAuth security scheme is missing");

const expectedRoutes = new Map([
  [routeKey("GET", "/health"), null],
  [routeKey("GET", "/orders"), "orders:read"],
  [routeKey("GET", "/orders/{publicOrderRef}"), "orders:read"],
  [routeKey("POST", "/orders/{publicOrderRef}/ack"), "orders:ack"],
  [routeKey("POST", "/orders/{publicOrderRef}/events"), "orders:events"],
  [routeKey("POST", "/inventory"), "inventory:write"],
]);

const sourceRoutes = new Map();
for (const match of routesSource.matchAll(/app\.(get|post)\("\/api\/wms\/v1([^"]+)"/g)) {
  const [, method, route] = match;
  sourceRoutes.set(routeKey(method, route), true);
}
for (const key of expectedRoutes.keys()) check(sourceRoutes.has(key), `Expected route is not declared in wms-routes.ts: ${key}`);
for (const key of sourceRoutes.keys()) check(expectedRoutes.has(key), `Route is missing from the OpenAPI contract: ${key}`);

const specRoutes = new Map();
for (const [route, pathItem] of Object.entries(spec.paths || {})) {
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    if (pathItem[method]) specRoutes.set(routeKey(method, route), pathItem[method]);
  }
}
for (const key of expectedRoutes.keys()) {
  const operation = specRoutes.get(key);
  check(operation, `OpenAPI operation is missing: ${key}`);
  if (!operation) continue;
  const requiredScope = expectedRoutes.get(key);
  if (requiredScope) {
    check(operation["x-required-scope"] === requiredScope, `${key} must declare x-required-scope=${requiredScope}`);
    check(operation.security?.[0]?.bearerAuth?.includes(requiredScope), `${key} must require bearerAuth scope ${requiredScope}`);
  } else {
    check(Array.isArray(operation.security) && operation.security.length === 0, `${key} must be public`);
  }
}
for (const key of specRoutes.keys()) check(expectedRoutes.has(key), `OpenAPI operation has no matching route: ${key}`);

const responseCodes = (key) => new Set(Object.keys(specRoutes.get(key)?.responses || {}));
const requireResponses = (key, codes) => {
  const actual = responseCodes(key);
  for (const code of codes) check(actual.has(code), `${key} is missing documented response ${code}`);
};
requireResponses("GET /health", ["200"]);
requireResponses("GET /orders", ["200", "400", "401", "403", "429", "500"]);
requireResponses("GET /orders/{publicOrderRef}", ["200", "401", "403", "404", "429", "500"]);
requireResponses("POST /orders/{publicOrderRef}/ack", ["200", "400", "401", "403", "404", "409", "429", "500"]);
requireResponses("POST /orders/{publicOrderRef}/events", ["200", "400", "401", "403", "404", "409", "422", "429", "500"]);
requireResponses("POST /inventory", ["200", "400", "401", "403", "409", "422", "429", "500"]);

const schemas = spec.components?.schemas || {};
for (const name of [
  "HealthResponse",
  "OrderListResponse",
  "OrderResponse",
  "WmsOrder",
  "Pagination",
  "AcknowledgeRequest",
  "EventRequest",
  "InventoryRequest",
  "ErrorResponse",
]) check(schemas[name], `Required schema is missing: ${name}`);

const allJsonExamples = JSON.stringify(spec);
for (const value of [
  "UNAUTHENTICATED",
  "INSUFFICIENT_SCOPE",
  "MARKET_NOT_ALLOWED",
  "ORDER_NOT_FOUND",
  "IDEMPOTENCY_KEY_REQUIRED",
  "IDEMPOTENCY_IN_PROGRESS",
  "IDEMPOTENCY_KEY_REUSED",
  "INVALID_EVENT",
  "INVALID_INVENTORY_BATCH",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]) check(allJsonExamples.includes(value), `Error code is missing from the contract examples: ${value}`);

if (failures.length) {
  console.error("WMS OpenAPI validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`WMS OpenAPI contract is valid (${spec.info.version}; ${specRoutes.size} operations).`);