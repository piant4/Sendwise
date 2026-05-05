"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type MockRole = "admin" | "client";

export function MockLoginForm() {
  const router = useRouter();
  const [role, setRole] = useState<MockRole>("client");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(role === "admin" ? "/admin" : "/client");
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Mock login form"
      style={{
        display: "grid",
        gap: "16px",
        marginTop: "24px",
        maxWidth: "420px",
      }}
    >
      <label style={{ display: "grid", gap: "6px", fontWeight: 700 }}>
        Username or email
        <input
          name="username"
          type="text"
          autoComplete="username"
          placeholder="developer@sendwise.local"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "6px",
            font: "inherit",
            padding: "11px 12px",
          }}
        />
      </label>
      <label style={{ display: "grid", gap: "6px", fontWeight: 700 }}>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Not validated in mock mode"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "6px",
            font: "inherit",
            padding: "11px 12px",
          }}
        />
      </label>
      <label style={{ display: "grid", gap: "6px", fontWeight: 700 }}>
        Development role
        <select
          name="role"
          value={role}
          onChange={(event) => setRole(event.target.value as MockRole)}
          style={{
            border: "1px solid var(--border)",
            borderRadius: "6px",
            font: "inherit",
            padding: "11px 12px",
          }}
        >
          <option value="client">Client user</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <button
        type="submit"
        style={{
          background: "var(--accent)",
          border: "1px solid var(--accent)",
          borderRadius: "6px",
          color: "#fff",
          cursor: "pointer",
          font: "inherit",
          fontWeight: 800,
          padding: "11px 14px",
        }}
      >
        Continue
      </button>
    </form>
  );
}
