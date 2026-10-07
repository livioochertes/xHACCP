import { test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { customerPasswordSetupTokens, users } from "../shared/schema";
import { createOrFindMarketingClientAccount } from "./marketing-client-account";

function makeTransaction(existingUser: any = null) {
  const state: {
    advisoryLocks: number;
    insertedUsers: any[];
    insertedTokens: any[];
    updates: Array<{ table: unknown; values: any }>;
  } = {
    advisoryLocks: 0,
    insertedUsers: [],
    insertedTokens: [],
    updates: [],
  };

  const tx: any = {
    execute: async () => { state.advisoryLocks++; },
    select: () => {
      let selectedTable: unknown;
      const query: any = {
        from(table: unknown) { selectedTable = table; return query; },
        where() { return query; },
        limit() { return query; },
        for: async () => selectedTable === users && existingUser ? [existingUser] : [],
      };
      return query;
    },
    insert: (table: unknown) => {
      let values: any;
      const query: any = {
        values(input: any) { values = input; return query; },
        returning: async () => {
          if (table !== users) return [];
          state.insertedUsers.push(values);
          return [{ id: 101, ...values }];
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve().then(() => {
            if (table === customerPasswordSetupTokens) state.insertedTokens.push(values);
          }).then(resolve, reject);
        },
      };
      return query;
    },
    update: (table: unknown) => ({
      set: (values: any) => ({
        where: async () => { state.updates.push({ table, values }); return []; },
      }),
    }),
  };
  return { tx, state };
}

test("creates a minimal Client account and stores only a hashed, expiring setup token", async () => {
  const { tx, state } = makeTransaction();
  const result = await createOrFindMarketingClientAccount(tx, {
    email: "  Avery.Example@Example.com ",
    firstName: " Avery ",
    lastName: " Martin ",
  });

  assert.equal(state.advisoryLocks, 1);
  assert.equal(result.created, true);
  assert.equal(result.userId, 101);
  assert.equal(result.email, "avery.example@example.com");
  assert.ok(result.passwordSetupToken);
  assert.match(result.passwordSetupToken, /^[A-Za-z0-9_-]{43}$/);

  const [createdUser] = state.insertedUsers;
  assert.equal(createdUser.email, "avery.example@example.com");
  assert.equal(createdUser.firstName, "Avery");
  assert.equal(createdUser.lastName, "Martin");
  assert.equal(createdUser.passwordSetupRequired, true);
  assert.equal(createdUser.isAdmin, false);
  assert.equal(createdUser.isSuspended, false);
  assert.equal(createdUser.companyAddress, undefined);
  assert.equal(createdUser.deliveryAddress, undefined);
  assert.notEqual(createdUser.password, "Avery.Example@Example.com");
  assert.equal(await bcrypt.compare("Avery.Example@Example.com", createdUser.password), false);

  assert.equal(state.insertedTokens.length, 1);
  assert.equal(
    state.insertedTokens[0].tokenHash,
    crypto.createHash("sha256").update(result.passwordSetupToken!).digest("hex"),
  );
  assert.notEqual(state.insertedTokens[0].tokenHash, result.passwordSetupToken);
  assert.ok(state.insertedTokens[0].expiresAt.getTime() > Date.now());
  assert.equal(state.updates.length, 1);
  assert.equal(state.updates[0].table, customerPasswordSetupTokens);
});

test("reuses an existing Client account without changing its password, data, rights, or tokens", async () => {
  const existingUser = {
    id: 54,
    email: "Existing.Client@example.com",
    password: "$2b$10$existing-password-hash",
    passwordSetupRequired: false,
    firstName: "Existing",
    lastName: "Client",
    isAdmin: true,
    isSuspended: true,
    companyName: "Existing Company",
  };
  const { tx, state } = makeTransaction(existingUser);
  const result = await createOrFindMarketingClientAccount(tx, {
    email: " existing.client@EXAMPLE.com ",
    firstName: "New",
    lastName: "Name",
  });

  assert.equal(state.advisoryLocks, 1);
  assert.deepEqual(result, {
    userId: existingUser.id,
    email: existingUser.email,
    passwordSetupToken: null,
    created: false,
  });
  assert.equal(state.insertedUsers.length, 0);
  assert.equal(state.insertedTokens.length, 0);
  assert.equal(state.updates.length, 0);
  assert.equal(existingUser.password, "$2b$10$existing-password-hash");
  assert.equal(existingUser.firstName, "Existing");
  assert.equal(existingUser.lastName, "Client");
  assert.equal(existingUser.isAdmin, true);
  assert.equal(existingUser.isSuspended, true);
  assert.equal(existingUser.companyName, "Existing Company");
});
