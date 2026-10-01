import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";

const cardStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
  marginTop: "18px",
  padding: "20px",
};

const labelStyle = {
  color: "#334155",
  display: "grid",
  fontSize: "13px",
  fontWeight: 600,
  gap: "6px",
};

const inputStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: "7px",
  color: "#1e293b",
  font: "inherit",
  fontSize: "14px",
  minHeight: "40px",
  padding: "8px 10px",
  width: "100%",
};

async function readResponse(response, fallback) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || fallback);
  return data;
}

export default function AdminAccountProfile({ token, admin, t, onAdminUpdated }) {
  const [profile, setProfile] = useState({ firstName: "", lastName: "", email: "" });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setProfile({
      firstName: admin?.firstName || "",
      lastName: admin?.lastName || "",
      email: admin?.email || "",
    });
  }, [admin?.id, admin?.firstName, admin?.lastName, admin?.email]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const emailChanged = profile.email.trim().toLowerCase() !== String(admin?.email || "").toLowerCase();
    if ((emailChanged || newPassword) && !currentPassword) {
      setError(t("dashboard.currentPasswordRequired"));
      return;
    }
    if (newPassword && newPassword.length < 12) {
      setError(t("dashboard.passwordMinimumLength"));
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError(t("dashboard.passwordConfirmationMismatch"));
      return;
    }

    const body = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
    };
    if (emailChanged || newPassword) body.currentPassword = currentPassword;
    if (newPassword) body.newPassword = newPassword;

    setSaving(true);
    try {
      const response = await fetch("/admin/api/profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await readResponse(response, t("dashboard.profileUpdateFailed"));
      onAdminUpdated?.(data.admin);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(t("dashboard.profileUpdated"));
    } catch (saveError) {
      setError(saveError.message || t("dashboard.profileUpdateFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={cardStyle} aria-busy={saving}>
      <header style={{ marginBottom: "16px" }}>
        <h3 style={{ color: "#172033", fontSize: "17px", margin: "0 0 5px" }}>
          {t("dashboard.profileTitle")}
        </h3>
        <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>
          {t("dashboard.profileDescription")}
        </p>
      </header>

      <form onSubmit={saveProfile}>
        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
          <label style={labelStyle}>
            {t("dashboard.firstName")}
            <input
              autoComplete="given-name"
              maxLength={100}
              onChange={(event) => setProfile((previous) => ({ ...previous, firstName: event.target.value }))}
              style={inputStyle}
              value={profile.firstName}
            />
          </label>
          <label style={labelStyle}>
            {t("dashboard.lastName")}
            <input
              autoComplete="family-name"
              maxLength={100}
              onChange={(event) => setProfile((previous) => ({ ...previous, lastName: event.target.value }))}
              style={inputStyle}
              value={profile.lastName}
            />
          </label>
          <label style={labelStyle}>
            {t("dashboard.email")}
            <input
              autoComplete="email"
              maxLength={255}
              onChange={(event) => setProfile((previous) => ({ ...previous, email: event.target.value }))}
              required
              style={inputStyle}
              type="email"
              value={profile.email}
            />
          </label>
        </div>

        <div style={{ borderTop: "1px solid #e2e8f0", marginTop: "18px", paddingTop: "16px" }}>
          <h4 style={{ color: "#334155", fontSize: "14px", margin: "0 0 5px" }}>
            {t("dashboard.changePassword")}
          </h4>
          <p style={{ color: "#64748b", fontSize: "12px", margin: "0 0 12px" }}>
            {t("dashboard.passwordChangeHelp")}
          </p>
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
            <label style={labelStyle}>
              {t("dashboard.currentPassword")}
              <input
                autoComplete="current-password"
                onChange={(event) => setCurrentPassword(event.target.value)}
                style={inputStyle}
                type="password"
                value={currentPassword}
              />
            </label>
            <label style={labelStyle}>
              {t("dashboard.newPassword")}
              <input
                autoComplete="new-password"
                minLength={12}
                onChange={(event) => setNewPassword(event.target.value)}
                style={inputStyle}
                type="password"
                value={newPassword}
              />
            </label>
            <label style={labelStyle}>
              {t("dashboard.confirmPassword")}
              <input
                autoComplete="new-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                style={inputStyle}
                type="password"
                value={confirmPassword}
              />
            </label>
          </div>
        </div>

        {error && <p role="alert" style={{ color: "#b91c1c", fontSize: "13px", margin: "12px 0 0" }}>{error}</p>}
        {message && <p role="status" style={{ color: "#15803d", fontSize: "13px", margin: "12px 0 0" }}>{message}</p>}
        <button
          disabled={saving}
          style={{
            alignItems: "center",
            background: "#2563eb",
            border: 0,
            borderRadius: "7px",
            color: "#fff",
            cursor: saving ? "wait" : "pointer",
            display: "inline-flex",
            fontSize: "13px",
            fontWeight: 600,
            gap: "8px",
            marginTop: "14px",
            minHeight: "38px",
            opacity: saving ? 0.65 : 1,
            padding: "8px 14px",
          }}
          type="submit"
        >
          <Save size={15} aria-hidden="true" />
          {saving ? t("dashboard.savingProfile") : t("dashboard.saveProfile")}
        </button>
      </form>
    </section>
  );
}