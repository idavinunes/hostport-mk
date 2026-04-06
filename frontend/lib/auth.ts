"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "wifi-portal-token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function useSessionToken(required = true) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = getStoredToken();
    setToken(stored);
    setReady(true);

    if (required && !stored) {
      router.replace("/");
    }
  }, [required, router]);

  function logout() {
    clearStoredToken();
    setToken(null);
    router.push("/");
  }

  return { token, ready, logout };
}

