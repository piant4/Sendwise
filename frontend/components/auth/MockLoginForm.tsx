"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";

type MockRole = "admin" | "client";

export function MockLoginForm() {
  const router = useRouter();
  const [role, setRole] = useState<MockRole>("client");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(role === "admin" ? "/admin" : "/auth/redirect");
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Modulo di accesso mock"
      style={{
        display: "grid",
        gap: "16px",
        marginTop: "24px",
        maxWidth: "420px",
      }}
    >
      <label style={{ display: "grid", gap: "6px", fontWeight: 700 }}>
        Username o email
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
          placeholder="Non validata in modalità mock"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "6px",
            font: "inherit",
            padding: "11px 12px",
          }}
        />
      </label>
      <label style={{ display: "grid", gap: "6px", fontWeight: 700 }}>
        Ruolo di sviluppo
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
          <option value="client">Utente cliente</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <Button
        type="submit"
        className="mock-login-submit"
        size="lg"
      >
        Continua
      </Button>
    </form>
  );
}
