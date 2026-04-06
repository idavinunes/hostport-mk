"use client";

import { FormEvent, useState, useTransition } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { setStoredToken } from "@/lib/auth";

type LoginCardProps = {
  onSuccess: () => void;
};

type LoginResponse = {
  access_token: string;
  full_name: string;
};

export function LoginCard({ onSuccess }: LoginCardProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("Admin123");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(() => {
      void (async () => {
        try {
          const response = await apiFetch<LoginResponse>("/auth/login", {
            method: "POST",
            body: { username, password },
          });
          setStoredToken(response.access_token);
          onSuccess();
        } catch (error) {
          setError(error instanceof ApiError ? error.message : "Nao foi possivel autenticar");
        }
      })();
    });
  }

  return (
    <section className="login-card">
      <div className="chip">Acesso administrativo</div>
      <h2 style={{ marginBottom: 6 }}>Entrar no painel</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Use as credenciais definidas no arquivo de ambiente.
      </p>

      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="username">Usuario</label>
          <input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
          />
        </div>

        <div className="field">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error ? <div className="muted">{error}</div> : null}

        <button className="button" type="submit" disabled={isPending}>
          {isPending ? "Autenticando..." : "Entrar"}
        </button>
      </form>
    </section>
  );
}
