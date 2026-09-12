"use client";

import { useEffect, useState } from "react";

const DELAY_MS = 5000;

// Strip the tenant subdomain so we land on the central /login, not
// /[domain]/login. Handles dev (*.localhost) and prod (tenant.APP_DOMAIN).
function rootLoginUrl(): string {
  const { protocol, host } = window.location;
  const [hostname, port] = host.split(":");
  const parts = hostname.split(".");
  let rootHostname = hostname;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    rootHostname = "localhost";
  } else if (parts.length >= 3) {
    rootHostname = parts.slice(1).join(".");
  }
  const portPart = port ? `:${port}` : "";
  return `${protocol}//${rootHostname}${portPart}/login`;
}

export function TenantNotFoundRedirect() {
  const [seconds, setSeconds] = useState(5);
  const [loginUrl, setLoginUrl] = useState("/login");

  useEffect(() => {
    const target = rootLoginUrl();
    setLoginUrl(target);
    const tick = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    const go = setTimeout(() => window.location.assign(target), DELAY_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(go);
    };
  }, []);

  return (
    <>
      <h1 className="text-2xl font-semibold">Tenant tidak ditemukan</h1>
      <p className="mt-3 text-muted-foreground">Periksa kembali domain sekolah yang Anda buka.</p>
      <p className="mt-4 text-sm text-muted-foreground">
        Redirect ke login dalam {seconds} detik…
      </p>
      <a href={loginUrl} className="mt-4 inline-block text-sm font-medium text-primary underline">
        Ke halaman login sekarang
      </a>
    </>
  );
}
