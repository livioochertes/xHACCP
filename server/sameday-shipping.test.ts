import test from "node:test";
import assert from "node:assert/strict";
import { serializeSamedayPickupPoints } from "./sameday-shipping.js";

test("pickup point serialization keeps provider location objects renderable", () => {
  const [pickupPoint] = serializeSamedayPickupPoints([
    {
      id: 447249,
      name: undefined as never,
      county: { id: 10, name: "Ilfov" } as never,
      city: { id: 20, name: "București" } as never,
      address: "Strada Test 1",
      contactPersons: [],
    },
  ], 447249);

  assert.deepEqual(pickupPoint, {
    id: 447249,
    name: "Sameday #447249",
    county: "Ilfov",
    city: "București",
    address: "Strada Test 1",
    contactPersons: [],
    configured: true,
  });
});