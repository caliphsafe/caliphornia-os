"use client";

import { useState } from "react";

type AccountProfileFormProps = {
  initialUsername: string;
  email: string;
};

export default function AccountProfileForm({
  initialUsername,
  email,
}: AccountProfileFormProps) {
  const [username, setUsername] = useState(initialUsername);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) return;

    setMessage("");
    setIsSaving(true);

    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Account could not be updated.");
      }

      setUsername(data.user.username || "");
      setMessage("Account updated.");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Account could not be updated.";
      setMessage(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="account-profile-form" onSubmit={saveProfile}>
      <div className="account-form-row">
        <label htmlFor="account-email">Email</label>
        <input id="account-email" type="email" value={email} disabled />
      </div>

      <div className="account-form-row">
        <label htmlFor="account-username">Username</label>
        <input
          id="account-username"
          type="text"
          value={username}
          maxLength={28}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Choose a username"
        />
      </div>

      <button type="submit" disabled={isSaving}>
        {isSaving ? "Saving..." : "Save Account Info"}
      </button>

      {message ? <p className="account-form-message">{message}</p> : null}
    </form>
  );
}
