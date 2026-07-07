"use client";

import { useState } from "react";

export default function ManageBillingButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function openBillingPortal() {
    if (isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/account/billing-portal", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || "Billing portal could not be opened.");
      }

      window.location.href = data.url;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Billing portal could not be opened.";

      setError(message);
      setIsLoading(false);
    }
  }

  return (
    <div className="account-billing-action">
      <button type="button" onClick={openBillingPortal} disabled={isLoading}>
        {isLoading ? "Opening Billing..." : "Manage Monthly Billing"}
      </button>

      {error ? <p>{error}</p> : null}
    </div>
  );
}
