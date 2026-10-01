import assert from "node:assert/strict";
import express, { type RequestHandler } from "express";
import test from "node:test";
import {
  getAdminSuspensionError,
  isActiveAdminAccount,
  normalizeAdminEmail,
  normalizeAdminMarketAssignments,
} from "./admin-account-management";
import {
  createAdminLoginHandler,
  createAuthenticateAdmin,
} from "./admin-auth";
import {
  registerAdminAccountManagementRoutes,
  type AdminAccountManagementRouteDependencies,
} from "./admin-account-management-routes";

type FixtureAdmin = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  isAdmin: boolean;
  isSuspended: boolean;
  adminMarkets: string[];
  twoFactorEnabled: boolean;
  twoFactorSecret: string;
  twoFactorBackupCodes: string[];
};

const adminFixture = (overrides: Partial<FixtureAdmin> & Pick<FixtureAdmin, "id" | "email">): FixtureAdmin => ({
  id: overrides.id,
  email: overrides.email,
  firstName: overrides.firstName || "Admin",
  lastName: overrides.lastName || String(overrides.id),
  password: overrides.password || `password-hash-${overrides.id}`,
  isAdmin: overrides.isAdmin ?? true,
  isSuspended: overrides.isSuspended ?? false,
  adminMarkets: overrides.adminMarkets || [],
  twoFactorEnabled: overrides.twoFactorEnabled ?? true,
  twoFactorSecret: "private-2fa-secret",
  twoFactorBackupCodes: ["PRIVATE-BACKUP-CODE"],
});

function createAdminAccountHttpHarness(
  initialAdmins: FixtureAdmin[],
  options: { emailDeliverySucceeds?: boolean; emailDeliveryThrows?: boolean } = {},
) {
  const admins = new Map(initialAdmins.map((admin) => [admin.id, { ...admin }]));
  const calls = {
    list: 0,
    updates: [] as number[],
    suspensions: [] as number[],
    resets: [] as number[],
    emailedPasswords: [] as string[],
  };

  const authenticateAdmin: RequestHandler = (req, res, next) => {
    const id = Number(req.get("x-test-admin-id"));
    const admin = admins.get(id);
    if (!isActiveAdminAccount(admin)) {
      return res.status(401).json({ message: "Admin access denied" });
    }
    const adminMarkets = admin.adminMarkets;
    Object.assign(req, {
      adminId: id,
      admin,
      adminMarkets,
      isSuperAdmin: adminMarkets.length === 0,
    });
    return next();
  };

  const dependencies: AdminAccountManagementRouteDependencies = {
    authenticateAdmin,
    listAdminAccounts: async ({ isSuperAdmin, adminId }) => {
      calls.list++;
      const accounts = [...admins.values()].filter((account) => account.isAdmin);
      return isSuperAdmin ? accounts : accounts.filter((account) => account.id === adminId);
    },
    getAdminAccount: async (id) => admins.get(id),
    findAccountIdByEmail: async (email) => [...admins.values()]
      .find((admin) => admin.email.toLowerCase() === email.toLowerCase())?.id,
    updateAdminAccount: async (id, changes) => {
      const account = admins.get(id);
      if (!account) throw new Error("Fixture account does not exist");
      Object.assign(account, changes);
      calls.updates.push(id);
      return account;
    },
    suspendAdminAccount: async (targetId, callerId, isSuspended) => {
      const target = admins.get(targetId);
      if (!target) return { status: 404, message: "Admin account not found" };
      if (target.isSuspended === isSuspended) return { status: 200, account: target };
      const activeSuperAdminCount = [...admins.values()].filter((admin) =>
        admin.isAdmin && !admin.isSuspended && admin.adminMarkets.length === 0,
      ).length;
      const error = getAdminSuspensionError({
        targetId,
        callerId,
        targetMarkets: target.adminMarkets,
        activeSuperAdminCount,
        nextSuspended: isSuspended,
      });
      if (error === "cannot_suspend_self") {
        return { status: 400, message: "You cannot suspend your own account" };
      }
      if (error === "cannot_suspend_last_superadmin") {
        return { status: 409, message: "The last active superadmin cannot be suspended" };
      }
      target.isSuspended = isSuspended;
      calls.suspensions.push(targetId);
      return { status: 200, account: target };
    },
    hashPassword: async (password) => `hash:${password}`,
    comparePassword: async (password, hash) => hash === `hash:${password}`,
    replacePasswordIfUnchanged: async (id, previousHash, nextHash) => {
      const account = admins.get(id);
      if (!account || account.password !== previousHash) return false;
      account.password = nextHash;
      calls.resets.push(id);
      return true;
    },
    restorePasswordIfCurrent: async (id, temporaryHash, previousHash) => {
      const account = admins.get(id);
      if (account?.password === temporaryHash) account.password = previousHash;
    },
    sendTemporaryPasswordEmail: async (_req, _account, password) => {
      calls.emailedPasswords.push(password);
      if (options.emailDeliveryThrows) throw new Error("Email delivery failed");
      return options.emailDeliverySucceeds ?? true;
    },
  };

  const app = express();
  app.use(express.json());
  registerAdminAccountManagementRoutes(app, dependencies);
  const server = app.listen(0);
  const ready = new Promise<string>((resolve, reject) => {
    server.once("listening", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Test server did not bind to a TCP port"));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
    server.once("error", reject);
  });

  return {
    admins,
    calls,
    ready,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
    request: async (
      method: string,
      path: string,
      adminId: number,
      body?: unknown,
    ) => {
      const baseUrl = await ready;
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          "x-test-admin-id": String(adminId),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: response.status,
        headers: response.headers,
        body: await response.json() as Record<string, any>,
      };
    },
  };
}

test("normalizes valid admin email addresses and rejects invalid input", () => {
  assert.equal(normalizeAdminEmail("  Admin@Example.test "), "admin@example.test");
  assert.equal(normalizeAdminEmail("not-an-email"), null);
  assert.equal(normalizeAdminEmail("a".repeat(256) + "@example.test"), null);
  assert.equal(normalizeAdminEmail(null), null);
});

test("validates and deduplicates admin market assignments", () => {
  assert.deepEqual(
    normalizeAdminMarketAssignments(["RO", "fr", "ro"]),
    ["ro", "fr"],
  );
  assert.equal(normalizeAdminMarketAssignments([]), null);
  assert.equal(normalizeAdminMarketAssignments(["global"]), null);
  assert.equal(normalizeAdminMarketAssignments(["fr", 2]), null);
});

test("prevents self-suspension and suspension of the last active superadmin", () => {
  assert.equal(getAdminSuspensionError({
    targetId: 4,
    callerId: 4,
    targetMarkets: [],
    activeSuperAdminCount: 2,
    nextSuspended: true,
  }), "cannot_suspend_self");

  assert.equal(getAdminSuspensionError({
    targetId: 5,
    callerId: 4,
    targetMarkets: [],
    activeSuperAdminCount: 1,
    nextSuspended: true,
  }), "cannot_suspend_last_superadmin");

  assert.equal(getAdminSuspensionError({
    targetId: 6,
    callerId: 4,
    targetMarkets: ["fr"],
    activeSuperAdminCount: 1,
    nextSuspended: true,
  }), null);
});

test("a regular admin only lists and updates their own account and cannot manage others", async (t) => {
  const harness = createAdminAccountHttpHarness([
    adminFixture({ id: 1, email: "root@example.test" }),
    adminFixture({ id: 2, email: "market@example.test", adminMarkets: ["ro"] }),
    adminFixture({ id: 3, email: "other@example.test", adminMarkets: ["fr"] }),
  ]);
  t.after(() => harness.close());

  const listed = await harness.request("GET", "/admin/api/admin-users", 2);
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.admins.map((account) => account.id), [2]);
  assert.equal(listed.headers.get("cache-control"), "private, no-store");
  for (const forbiddenField of ["password", "twoFactorSecret", "twoFactorBackupCodes"]) {
    assert.equal(JSON.stringify(listed.body).includes(forbiddenField), false);
    assert.equal(JSON.stringify(listed.body).includes("private-2fa-secret"), false);
    assert.equal(JSON.stringify(listed.body).includes("PRIVATE-BACKUP-CODE"), false);
  }

  const ownAccountUpdate = await harness.request("PUT", "/admin/api/admin-users/2", 2, {
    firstName: "Updated from account management",
  });
  assert.equal(ownAccountUpdate.status, 200);
  assert.equal(ownAccountUpdate.body.admin.id, 2);
  assert.equal(harness.admins.get(2)?.firstName, "Updated from account management");

  const ownEmailWithoutPassword = await harness.request("PUT", "/admin/api/admin-users/2", 2, {
    email: "new-market@example.test",
  });
  assert.equal(ownEmailWithoutPassword.status, 400);
  assert.equal(harness.admins.get(2)?.email, "market@example.test");

  const ownProfileUpdate = await harness.request("PUT", "/admin/api/profile", 2, {
    firstName: "Updated from profile",
  });
  assert.equal(ownProfileUpdate.status, 200);
  assert.equal(ownProfileUpdate.body.admin.id, 2);
  assert.equal(harness.admins.get(2)?.firstName, "Updated from profile");
  assert.equal(harness.admins.get(3)?.firstName, "Admin");

  const ownProfile = await harness.request("GET", "/admin/api/profile", 2);
  assert.equal(ownProfile.status, 200);
  assert.equal(JSON.stringify(ownProfile.body).includes("password"), false);
  assert.equal(JSON.stringify(ownProfile.body).includes("private-2fa-secret"), false);
  assert.equal(JSON.stringify(ownProfile.body).includes("PRIVATE-BACKUP-CODE"), false);

  const editOther = await harness.request("PUT", "/admin/api/admin-users/3", 2, {
    firstName: "Changed by regular admin",
  });
  const suspendOther = await harness.request("PATCH", "/admin/api/admin-users/3/suspension", 2, {
    isSuspended: true,
  });
  const resetOther = await harness.request("POST", "/admin/api/admin-users/3/reset-password", 2);
  assert.deepEqual([editOther.status, suspendOther.status, resetOther.status], [403, 403, 403]);
  assert.equal(harness.admins.get(3)?.firstName, "Admin");
  assert.equal(harness.admins.get(3)?.isSuspended, false);
  assert.deepEqual(harness.calls.suspensions, []);
  assert.deepEqual(harness.calls.resets, []);
});

test("a superadmin can list and manage other admin accounts without exposing credentials", async (t) => {
  const harness = createAdminAccountHttpHarness([
    adminFixture({ id: 1, email: "root@example.test" }),
    adminFixture({ id: 2, email: "market@example.test", adminMarkets: ["ro"] }),
    adminFixture({ id: 3, email: "other@example.test", adminMarkets: ["fr"] }),
  ]);
  t.after(() => harness.close());

  const listed = await harness.request("GET", "/admin/api/admin-users", 1);
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.admins.map((account) => account.id), [1, 2, 3]);
  assert.equal(JSON.stringify(listed.body).includes("password-hash"), false);
  assert.equal(JSON.stringify(listed.body).includes("private-2fa-secret"), false);
  assert.equal(JSON.stringify(listed.body).includes("PRIVATE-BACKUP-CODE"), false);

  const updated = await harness.request("PUT", "/admin/api/admin-users/2", 1, {
    firstName: "Managed",
    adminMarkets: ["ro", "com"],
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.admin.firstName, "Managed");
  assert.deepEqual(updated.body.admin.adminMarkets, ["ro", "com"]);
  assert.equal(JSON.stringify(updated.body).includes("password"), false);

  const suspended = await harness.request("PATCH", "/admin/api/admin-users/2/suspension", 1, {
    isSuspended: true,
  });
  assert.equal(suspended.status, 200);
  assert.equal(suspended.body.admin.isSuspended, true);

  const reset = await harness.request("POST", "/admin/api/admin-users/3/reset-password", 1);
  assert.equal(reset.status, 200);
  assert.equal(JSON.stringify(reset.body).includes(harness.calls.emailedPasswords[0]), false);
  assert.equal(harness.calls.emailedPasswords.length, 1);
  assert.ok(harness.admins.get(3)?.password?.startsWith("hash:"));
  assert.equal(JSON.stringify(reset.body).includes("password-hash"), false);
  assert.equal(JSON.stringify(reset.body).includes("twoFactorSecret"), false);
  assert.equal(JSON.stringify(reset.body).includes("twoFactorBackupCodes"), false);
});

test("self-suspension is rejected through the admin account HTTP route", async (t) => {
  const harness = createAdminAccountHttpHarness([
    adminFixture({ id: 1, email: "root@example.test" }),
    adminFixture({ id: 2, email: "market@example.test", adminMarkets: ["ro"] }),
  ]);
  t.after(() => harness.close());

  const response = await harness.request("PATCH", "/admin/api/admin-users/1/suspension", 1, {
    isSuspended: true,
  });
  assert.equal(response.status, 400);
  assert.equal(harness.admins.get(1)?.isSuspended, false);
});

test("failed temporary-password email delivery restores the prior credential", async (t) => {
  const previousHash = "previous-password-hash";
  for (const options of [{ emailDeliverySucceeds: false }, { emailDeliveryThrows: true }]) {
    const harness = createAdminAccountHttpHarness([
      adminFixture({ id: 1, email: "root@example.test" }),
      adminFixture({
        id: 2,
        email: "market@example.test",
        adminMarkets: ["ro"],
        password: previousHash,
      }),
    ], options);
    t.after(() => harness.close());

    const response = await harness.request("POST", "/admin/api/admin-users/2/reset-password", 1);
    assert.equal(response.status, 502);
    assert.equal(harness.admins.get(2)?.password, previousHash);
    assert.equal(JSON.stringify(response.body).includes(harness.calls.emailedPasswords[0]), false);
  }
});

test("suspension blocks existing authenticated requests and new sign-ins", async (t) => {
  const admin = adminFixture({
    id: 7,
    email: "admin@example.test",
    password: "password-hash",
    twoFactorEnabled: false,
  });
  const admins = new Map([[admin.id, admin]]);
  const issuedPayloads = new Map<string, Record<string, unknown>>();
  let tokenNumber = 0;
  let passwordChecks = 0;
  const app = express();
  app.use(express.json());
  app.post("/admin/api/login", createAdminLoginHandler({
    getAdminByEmail: async (email) => [...admins.values()].find((item) => item.email === email),
    comparePassword: async (_password, _hash) => {
      passwordChecks++;
      return true;
    },
    signToken: (payload) => {
      const token = `test-token-${++tokenNumber}`;
      issuedPayloads.set(token, payload);
      return token;
    },
  }));
  app.get("/protected", createAuthenticateAdmin({
    getAdmin: async (id) => admins.get(id),
    verifyToken: (token) => {
      const payload = issuedPayloads.get(token);
      if (!payload) throw new Error("Invalid test token");
      return payload;
    },
  }), (_req, res) => res.json({ ok: true }));

  const server = app.listen(0);
  const baseUrl = await new Promise<string>((resolve, reject) => {
    server.once("listening", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Test server did not bind to a TCP port"));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
    server.once("error", reject);
  });
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const login = await fetch(`${baseUrl}/admin/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "any-password" }),
  });
  assert.equal(login.status, 200);
  const { token } = await login.json() as { token: string };
  const authenticated = await fetch(`${baseUrl}/protected`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(authenticated.status, 200);

  admin.isSuspended = true;
  const nowBlocked = await fetch(`${baseUrl}/protected`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(nowBlocked.status, 401);

  const passwordChecksBeforeSignIn = passwordChecks;
  const suspendedLogin = await fetch(`${baseUrl}/admin/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "any-password" }),
  });
  assert.equal(suspendedLogin.status, 401);
  assert.equal(passwordChecks, passwordChecksBeforeSignIn);
});

test("login and authentication reject suspended or non-admin accounts", async () => {
  assert.equal(isActiveAdminAccount(adminFixture({ id: 1, email: "active@example.test" })), true);
  assert.equal(isActiveAdminAccount(adminFixture({
    id: 2,
    email: "suspended@example.test",
    isSuspended: true,
  })), false);
  assert.equal(isActiveAdminAccount(adminFixture({
    id: 3,
    email: "customer@example.test",
    isAdmin: false,
  })), false);
});