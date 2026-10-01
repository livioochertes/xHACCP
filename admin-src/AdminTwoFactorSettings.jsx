import React, { useEffect, useState } from "react";
import { KeyRound, RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";
import AdminAccountManager from "./AdminAccountManager.jsx";
import AdminAccountProfile from "./AdminAccountProfile.jsx";

const panelStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
  marginTop: "24px",
  padding: "24px",
};

const buttonStyle = {
  alignItems: "center",
  border: 0,
  borderRadius: "7px",
  color: "#fff",
  cursor: "pointer",
  display: "inline-flex",
  fontSize: "14px",
  fontWeight: 600,
  gap: "8px",
  justifyContent: "center",
  minHeight: "38px",
  padding: "8px 14px",
};

async function readResponse(response, fallback) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallback);
  }
  return data;
}

export default function AdminTwoFactorSettings({ token, admin, market, t, onAdminUpdated }) {
  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [accountsError, setAccountsError] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(admin?.twoFactorEnabled));
  const [setup, setSetup] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    setTwoFactorEnabled(Boolean(admin?.twoFactorEnabled));
  }, [admin?.id, admin?.twoFactorEnabled]);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ market: market || "all" });

    setLoadingAccounts(true);
    setAccountsError("");
    fetch(`/admin/api/admin-users?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((response) => readResponse(response, t("dashboard.adminListFailed")))
      .then((data) => {
        if (!controller.signal.aborted) {
          setAccounts(Array.isArray(data.admins) ? data.admins : []);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setAccountsError(error.message || t("dashboard.adminListFailed"));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingAccounts(false);
        }
      });

    return () => controller.abort();
  }, [token, market, t]);

  const refreshAccounts = async () => {
    setAccountsError("");
    const query = new URLSearchParams({ market: market || "all" });
    const response = await fetch(`/admin/api/admin-users?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await readResponse(response, t("dashboard.adminListFailed"));
    setAccounts(Array.isArray(data.admins) ? data.admins : []);
  };

  const beginSetup = async () => {
    setBusy(true);
    setActionError("");
    setActionMessage("");
    setVerificationCode("");
    setBackupCodes([]);
    try {
      const response = await fetch("/admin/api/enable-2fa", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readResponse(response, t("dashboard.twoFactorActionFailed"));
      setSetup(data);
    } catch (error) {
      setActionError(error.message || t("dashboard.twoFactorActionFailed"));
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async (event) => {
    event.preventDefault();
    const code = verificationCode.replace(/\s/g, "");
    if (!code) {
      setActionError(t("dashboard.verificationCodeRequired"));
      return;
    }

    setBusy(true);
    setActionError("");
    setActionMessage("");
    try {
      const response = await fetch("/admin/api/confirm-2fa", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });
      const data = await readResponse(response, t("dashboard.twoFactorActionFailed"));
        setTwoFactorEnabled(true);
        onAdminUpdated?.({ ...admin, twoFactorEnabled: true });
      setSetup(null);
      setVerificationCode("");
      setBackupCodes(Array.isArray(data.backupCodes) ? data.backupCodes : []);
      setActionMessage(t("dashboard.twoFactorEnabledMessage"));
      await refreshAccounts();
    } catch (error) {
      setActionError(error.message || t("dashboard.twoFactorActionFailed"));
    } finally {
      setBusy(false);
    }
  };

  const disableTwoFactor = async (event) => {
    event.preventDefault();
    const enteredCode = verificationCode.trim();
    if (!enteredCode) {
      setActionError(t("dashboard.verificationCodeRequired"));
      return;
    }

    const payload = /^\d{6}$/.test(enteredCode)
      ? { code: enteredCode }
      : { backupCode: enteredCode.toUpperCase() };

    setBusy(true);
    setActionError("");
    setActionMessage("");
    try {
      const response = await fetch("/admin/api/disable-2fa", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      await readResponse(response, t("dashboard.twoFactorActionFailed"));
      setTwoFactorEnabled(false);
      onAdminUpdated?.({ ...admin, twoFactorEnabled: false });
      setVerificationCode("");
      setSetup(null);
      setBackupCodes([]);
      setActionMessage(t("dashboard.twoFactorDisabledMessage"));
      await refreshAccounts();
    } catch (error) {
      setActionError(error.message || t("dashboard.twoFactorActionFailed"));
    } finally {
      setBusy(false);
    }
  };

  const isSuperAdmin = !Array.isArray(admin?.adminMarkets) || admin.adminMarkets.length === 0;

  return (
    <section style={panelStyle} aria-busy={loadingAccounts || busy}>
      <header style={{ alignItems: "flex-start", display: "flex", gap: "12px", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ color: "#172033", fontSize: "20px", margin: "0 0 6px" }}>
            {t("dashboard.adminAccounts")}
          </h2>
          <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
            {isSuperAdmin
              ? t("dashboard.adminAccountsDescriptionSuperadmin")
              : t("dashboard.adminAccountsDescriptionAdmin")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoadingAccounts(true);
            setAccountsError("");
            refreshAccounts()
              .catch((error) => setAccountsError(error.message || t("dashboard.adminListFailed")))
              .finally(() => setLoadingAccounts(false));
          }}
          disabled={loadingAccounts}
          aria-label={t("dashboard.refreshAdminAccounts")}
          title={t("dashboard.refreshAdminAccounts")}
          style={{
            alignItems: "center",
            background: "#f1f5f9",
            border: "1px solid #cbd5e1",
            borderRadius: "7px",
            color: "#334155",
            cursor: loadingAccounts ? "wait" : "pointer",
            display: "inline-flex",
            height: "36px",
            justifyContent: "center",
            width: "38px",
          }}
        >
          <RefreshCw size={15} aria-hidden="true" />
        </button>
      </header>

      <div style={{ borderTop: "1px solid #e2e8f0", marginTop: "18px", paddingTop: "18px" }}>
        <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "space-between" }}>
          <div style={{ alignItems: "center", display: "flex", gap: "10px" }}>
            {twoFactorEnabled
              ? <ShieldCheck size={20} color="#15803d" aria-hidden="true" />
              : <ShieldOff size={20} color="#b45309" aria-hidden="true" />}
            <div>
              <strong style={{ color: "#172033", display: "block", fontSize: "14px" }}>
                {admin?.email || t("dashboard.currentAdmin")}
              </strong>
              <span style={{ color: twoFactorEnabled ? "#15803d" : "#b45309", fontSize: "13px" }}>
                {twoFactorEnabled
                  ? t("dashboard.twoFactorEnabled")
                  : t("dashboard.twoFactorDisabled")}
              </span>
            </div>
          </div>

          {!setup && !twoFactorEnabled && (
            <button
              type="button"
              onClick={beginSetup}
              disabled={busy}
              style={{ ...buttonStyle, background: "#2563eb", opacity: busy ? 0.65 : 1 }}
            >
              <KeyRound size={15} aria-hidden="true" />
              {t("dashboard.enable2fa")}
            </button>
          )}
        </div>

        {setup && (
          <form onSubmit={confirmSetup} style={{ background: "#f8fafc", border: "1px solid #dbeafe", borderRadius: "9px", marginTop: "16px", padding: "16px" }}>
            <p style={{ color: "#334155", fontSize: "14px", margin: "0 0 12px" }}>
              {t("dashboard.twoFactorSetupInstructions")}
            </p>
            {setup.qrCode && (
              <img
                src={setup.qrCode}
                alt={t("dashboard.twoFactorQrAlt")}
                style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", display: "block", height: "180px", marginBottom: "12px", padding: "8px", width: "180px" }}
              />
            )}
            <p style={{ color: "#475569", fontSize: "13px", margin: "0 0 12px" }}>
              {t("dashboard.manualEntryKey")}: <code style={{ overflowWrap: "anywhere" }}>{setup.manualEntryKey || setup.secret}</code>
            </p>
            <label style={{ color: "#334155", display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }} htmlFor="admin-2fa-setup-code">
              {t("dashboard.verificationCode")}
            </label>
            <input
              id="admin-2fa-setup-code"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={12}
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
              style={{ border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "15px", maxWidth: "240px", padding: "9px 10px", width: "100%" }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
              <button type="submit" disabled={busy} style={{ ...buttonStyle, background: "#15803d", opacity: busy ? 0.65 : 1 }}>
                {t("dashboard.confirmTwoFactor")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSetup(null);
                  setVerificationCode("");
                  setActionError("");
                }}
                disabled={busy}
                style={{ ...buttonStyle, background: "#64748b" }}
              >
                {t("dashboard.cancelSetup")}
              </button>
            </div>
          </form>
        )}

        {!setup && twoFactorEnabled && (
          <form onSubmit={disableTwoFactor} style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "9px", marginTop: "16px", padding: "16px" }}>
            <label style={{ color: "#7c2d12", display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }} htmlFor="admin-2fa-disable-code">
              {t("dashboard.disableTwoFactorInstructions")}
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <input
                id="admin-2fa-disable-code"
                autoComplete="one-time-code"
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value)}
                style={{ border: "1px solid #fdba74", borderRadius: "6px", fontSize: "15px", maxWidth: "280px", padding: "9px 10px", width: "100%" }}
              />
              <button type="submit" disabled={busy} style={{ ...buttonStyle, background: "#b91c1c", opacity: busy ? 0.65 : 1 }}>
                {t("dashboard.disable2fa")}
              </button>
            </div>
          </form>
        )}

        {actionError && <p role="alert" style={{ color: "#b91c1c", fontSize: "13px", margin: "12px 0 0" }}>{actionError}</p>}
        {actionMessage && <p role="status" style={{ color: "#15803d", fontSize: "13px", margin: "12px 0 0" }}>{actionMessage}</p>}

        {backupCodes.length > 0 && (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "9px", marginTop: "14px", padding: "14px" }}>
            <strong style={{ color: "#166534", display: "block", fontSize: "14px", marginBottom: "6px" }}>
              {t("dashboard.backupCodesTitle")}
            </strong>
            <p style={{ color: "#166534", fontSize: "13px", margin: "0 0 10px" }}>
              {t("dashboard.backupCodesInstructions")}
            </p>
            <code style={{ color: "#14532d", display: "block", fontSize: "14px", lineHeight: 1.8, overflowWrap: "anywhere" }}>
              {backupCodes.join(" · ")}
            </code>
            <button
              type="button"
              onClick={() => setBackupCodes([])}
              style={{ ...buttonStyle, background: "#166534", marginTop: "10px" }}
            >
              {t("dashboard.dismissBackupCodes")}
            </button>
          </div>
        )}
      </div>

      <AdminAccountProfile
        token={token}
        admin={admin}
        t={t}
        onAdminUpdated={(updatedAdmin) => {
          onAdminUpdated?.(updatedAdmin);
          setAccounts((previous) => previous.map((account) =>
            String(account.id) === String(updatedAdmin?.id) ? { ...account, ...updatedAdmin } : account,
          ));
        }}
      />

      {accountsError && <p role="alert" style={{ color: "#b91c1c", fontSize: "14px", margin: "14px 0 0" }}>{accountsError}</p>}
      {loadingAccounts ? (
        <p role="status" style={{ color: "#64748b", fontSize: "14px", margin: "16px 0 0" }}>{t("dashboard.loadingAdminAccounts")}</p>
      ) : (
        <AdminAccountManager
          accounts={accounts}
          admin={admin}
          isSuperAdmin={isSuperAdmin}
          token={token}
          t={t}
          onRefresh={refreshAccounts}
        />
      )}
    </section>
  );
}