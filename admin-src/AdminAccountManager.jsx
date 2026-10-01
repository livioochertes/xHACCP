import React, { useState } from "react";
import { KeyRound, LockKeyhole, Pencil, UnlockKeyhole } from "lucide-react";

const markets = ["ro", "fr", "com"];
const buttonStyle = {
  alignItems: "center",
  border: "1px solid #cbd5e1",
  borderRadius: "7px",
  color: "#334155",
  cursor: "pointer",
  display: "inline-flex",
  font: "inherit",
  fontSize: "12px",
  fontWeight: 600,
  gap: "6px",
  justifyContent: "center",
  minHeight: "34px",
  padding: "6px 9px",
};

async function readResponse(response, fallback) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || fallback);
  return data;
}

export default function AdminAccountManager({
  accounts,
  admin,
  isSuperAdmin,
  token,
  t,
  onRefresh,
}) {
  const [editingAccount, setEditingAccount] = useState(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", email: "", adminMarkets: [] });
  const [busyId, setBusyId] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const activeSuperAdminCount = accounts.filter((account) =>
    account.isSuperAdmin && !account.isSuspended,
  ).length;

  const beginEdit = (account) => {
    setError("");
    setMessage("");
    setEditingAccount(account);
    setEditForm({
      firstName: account.firstName || "",
      lastName: account.lastName || "",
      email: account.email || "",
      adminMarkets: Array.isArray(account.adminMarkets) ? [...account.adminMarkets] : [],
    });
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editingAccount) return;
    setError("");
    setMessage("");
    if (!editingAccount.isSuperAdmin && editForm.adminMarkets.length === 0) {
      setError(t("dashboard.selectAtLeastOneMarket"));
      return;
    }

    setSavingEdit(true);
    try {
      const body = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        ...(editingAccount.isSuperAdmin ? {} : { adminMarkets: editForm.adminMarkets }),
      };
      const response = await fetch(`/admin/api/admin-users/${editingAccount.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      await readResponse(response, t("dashboard.accountActionFailed"));
      await onRefresh();
      setEditingAccount(null);
      setMessage(t("dashboard.accountUpdated"));
    } catch (saveError) {
      setError(saveError.message || t("dashboard.accountActionFailed"));
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleSuspension = async (account) => {
    const nextSuspended = !account.isSuspended;
    const confirmationKey = nextSuspended
      ? "dashboard.confirmSuspendAccount"
      : "dashboard.confirmReactivateAccount";
    if (!window.confirm(t(confirmationKey, { email: account.email }))) return;

    setError("");
    setMessage("");
    setBusyId(account.id);
    try {
      const response = await fetch(`/admin/api/admin-users/${account.id}/suspension`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isSuspended: nextSuspended }),
      });
      await readResponse(response, t("dashboard.accountActionFailed"));
      await onRefresh();
      setMessage(t(nextSuspended ? "dashboard.accountSuspended" : "dashboard.accountReactivated"));
    } catch (actionError) {
      setError(actionError.message || t("dashboard.accountActionFailed"));
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (account) => {
    if (!window.confirm(t("dashboard.confirmPasswordReset", { email: account.email }))) return;

    setError("");
    setMessage("");
    setBusyId(account.id);
    try {
      const response = await fetch(`/admin/api/admin-users/${account.id}/reset-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await readResponse(response, t("dashboard.accountActionFailed"));
      setMessage(t("dashboard.passwordResetSent"));
    } catch (actionError) {
      setError(actionError.message || t("dashboard.accountActionFailed"));
    } finally {
      setBusyId(null);
    }
  };

  const toggleMarket = (market) => {
    setEditForm((previous) => ({
      ...previous,
      adminMarkets: previous.adminMarkets.includes(market)
        ? previous.adminMarkets.filter((item) => item !== market)
        : [...previous.adminMarkets, market],
    }));
  };

  return (
    <section style={{
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: "12px",
      boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
      marginTop: "18px",
      padding: "20px",
    }}>
      <header style={{ alignItems: "flex-start", display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "space-between" }}>
        <div>
          <h3 style={{ color: "#172033", fontSize: "17px", margin: "0 0 5px" }}>
            {t("dashboard.accountListTitle")}
          </h3>
          <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>
            {isSuperAdmin
              ? t("dashboard.adminAccountsDescriptionSuperadmin")
              : t("dashboard.adminAccountsDescriptionAdmin")}
          </p>
        </div>
        <span style={{ color: "#64748b", fontSize: "12px" }}>
          {t("dashboard.adminAccountsCount", { count: accounts.length })}
        </span>
      </header>

      {error && <p role="alert" style={{ color: "#b91c1c", fontSize: "13px", margin: "14px 0 0" }}>{error}</p>}
      {message && <p role="status" style={{ color: "#15803d", fontSize: "13px", margin: "14px 0 0" }}>{message}</p>}

      {accounts.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: "14px", margin: "16px 0 0" }}>{t("dashboard.noAdminAccounts")}</p>
      ) : (
        <div style={{ marginTop: "14px", overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: "13px", minWidth: isSuperAdmin ? "900px" : "640px", width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #cbd5e1", color: "#64748b", textAlign: "left" }}>
                <th scope="col" style={{ padding: "10px 12px" }}>{t("dashboard.adminAccount")}</th>
                <th scope="col" style={{ padding: "10px 12px" }}>{t("dashboard.role")}</th>
                <th scope="col" style={{ padding: "10px 12px" }}>{t("dashboard.adminMarkets")}</th>
                <th scope="col" style={{ padding: "10px 12px" }}>{t("dashboard.twoFactorStatus")}</th>
                <th scope="col" style={{ padding: "10px 12px" }}>{t("dashboard.accountStatus")}</th>
                {isSuperAdmin && <th scope="col" style={{ padding: "10px 12px" }}>{t("dashboard.actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const isCurrentAdmin = String(account.id) === String(admin?.id ?? "");
                const name = [account.firstName, account.lastName].filter(Boolean).join(" ").trim();
                const accountMarkets = Array.isArray(account.adminMarkets) ? account.adminMarkets : [];
                const accountIsSuperAdmin = account.isSuperAdmin ?? accountMarkets.length === 0;
                const cannotSuspend = isCurrentAdmin
                  || (accountIsSuperAdmin && !account.isSuspended && activeSuperAdminCount <= 1);
                const actionBusy = busyId === account.id;

                return (
                  <tr key={account.id} style={{ background: isCurrentAdmin ? "#f8fafc" : "#fff", borderBottom: "1px solid #edf2f7" }}>
                    <td style={{ padding: "11px 12px" }}>
                      <strong style={{ color: "#1e293b", display: "block", fontWeight: 600 }}>{name || account.email}</strong>
                      {name && <span style={{ color: "#64748b", fontSize: "12px" }}>{account.email}</span>}
                      {isCurrentAdmin && <span style={{ color: "#2563eb", display: "block", fontSize: "12px", marginTop: "2px" }}>{t("dashboard.currentAdmin")}</span>}
                    </td>
                    <td style={{ color: "#475569", padding: "11px 12px" }}>
                      {accountIsSuperAdmin ? t("dashboard.superAdminRole") : t("dashboard.adminRole")}
                    </td>
                    <td style={{ color: "#475569", padding: "11px 12px" }}>
                      {accountMarkets.length ? accountMarkets.map((item) => item.toUpperCase()).join(", ") : t("dashboard.allMarkets")}
                    </td>
                    <td style={{ padding: "11px 12px" }}>
                      <span style={{
                        background: account.twoFactorEnabled ? "#dcfce7" : "#fef3c7",
                        borderRadius: "999px",
                        color: account.twoFactorEnabled ? "#166534" : "#92400e",
                        display: "inline-block",
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "4px 8px",
                        whiteSpace: "nowrap",
                      }}>
                        {account.twoFactorEnabled ? t("dashboard.twoFactorEnabled") : t("dashboard.twoFactorDisabled")}
                      </span>
                    </td>
                    <td style={{ padding: "11px 12px" }}>
                      <span style={{
                        background: account.isSuspended ? "#fee2e2" : "#dcfce7",
                        borderRadius: "999px",
                        color: account.isSuspended ? "#991b1b" : "#166534",
                        display: "inline-block",
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "4px 8px",
                        whiteSpace: "nowrap",
                      }}>
                        {account.isSuspended ? t("dashboard.suspendedAccount") : t("dashboard.activeAccount")}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td style={{ padding: "9px 12px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          <button
                            onClick={() => beginEdit(account)}
                            style={{ ...buttonStyle, background: "#f8fafc" }}
                            type="button"
                          >
                            <Pencil size={13} aria-hidden="true" />
                            {t("dashboard.editAccount")}
                          </button>
                          <button
                            disabled={actionBusy || cannotSuspend}
                            onClick={() => toggleSuspension(account)}
                            style={{
                              ...buttonStyle,
                              background: account.isSuspended ? "#f0fdf4" : "#fff7ed",
                              color: account.isSuspended ? "#166534" : "#9a3412",
                              cursor: actionBusy || cannotSuspend ? "not-allowed" : "pointer",
                              opacity: actionBusy || cannotSuspend ? 0.55 : 1,
                            }}
                            title={isCurrentAdmin
                              ? t("dashboard.cannotSuspendSelf")
                              : accountIsSuperAdmin && !account.isSuspended && activeSuperAdminCount <= 1
                                ? t("dashboard.cannotSuspendLastSuperadmin")
                                : undefined}
                            type="button"
                          >
                            {account.isSuspended
                              ? <UnlockKeyhole size={13} aria-hidden="true" />
                              : <LockKeyhole size={13} aria-hidden="true" />}
                            {account.isSuspended ? t("dashboard.reactivateAccount") : t("dashboard.suspendAccount")}
                          </button>
                          {!isCurrentAdmin && (
                            <button
                              disabled={actionBusy}
                              onClick={() => resetPassword(account)}
                              style={{
                                ...buttonStyle,
                                background: "#f8fafc",
                                cursor: actionBusy ? "wait" : "pointer",
                                opacity: actionBusy ? 0.55 : 1,
                              }}
                              type="button"
                            >
                              <KeyRound size={13} aria-hidden="true" />
                              {t("dashboard.resetPassword")}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingAccount && isSuperAdmin && (
        <form
          onSubmit={saveEdit}
          style={{ background: "#f8fafc", border: "1px solid #dbe3ec", borderRadius: "9px", marginTop: "18px", padding: "16px" }}
        >
          <h4 style={{ color: "#172033", fontSize: "15px", margin: "0 0 12px" }}>
            {t("dashboard.editAccount")}: {editingAccount.email}
          </h4>
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <label style={{ color: "#334155", display: "grid", fontSize: "12px", fontWeight: 600, gap: "5px" }}>
              {t("dashboard.firstName")}
              <input maxLength={100} onChange={(event) => setEditForm((prev) => ({ ...prev, firstName: event.target.value }))} style={inputStyle} value={editForm.firstName} />
            </label>
            <label style={{ color: "#334155", display: "grid", fontSize: "12px", fontWeight: 600, gap: "5px" }}>
              {t("dashboard.lastName")}
              <input maxLength={100} onChange={(event) => setEditForm((prev) => ({ ...prev, lastName: event.target.value }))} style={inputStyle} value={editForm.lastName} />
            </label>
            <label style={{ color: "#334155", display: "grid", fontSize: "12px", fontWeight: 600, gap: "5px" }}>
              {t("dashboard.email")}
              <input maxLength={255} onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))} required style={inputStyle} type="email" value={editForm.email} />
            </label>
          </div>
          <div style={{ marginTop: "14px" }}>
            <strong style={{ color: "#334155", display: "block", fontSize: "12px", marginBottom: "7px" }}>
              {t("dashboard.adminMarkets")}
            </strong>
            {editingAccount.isSuperAdmin ? (
              <span style={{ color: "#64748b", fontSize: "12px" }}>{t("dashboard.superadminMarketsLocked")}</span>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {markets.map((market) => (
                  <label key={market} style={{ alignItems: "center", color: "#475569", display: "inline-flex", fontSize: "12px", gap: "5px" }}>
                    <input
                      checked={editForm.adminMarkets.includes(market)}
                      onChange={() => toggleMarket(market)}
                      type="checkbox"
                    />
                    {market.toUpperCase()}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "15px" }}>
            <button disabled={savingEdit} style={{ ...buttonStyle, background: "#2563eb", borderColor: "#2563eb", color: "#fff", opacity: savingEdit ? 0.65 : 1 }} type="submit">
              {savingEdit ? t("dashboard.savingProfile") : t("dashboard.saveProfile")}
            </button>
            <button disabled={savingEdit} onClick={() => setEditingAccount(null)} style={{ ...buttonStyle, background: "#fff" }} type="button">
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

const inputStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: "6px",
  color: "#1e293b",
  font: "inherit",
  fontSize: "13px",
  minHeight: "38px",
  padding: "7px 9px",
  width: "100%",
};