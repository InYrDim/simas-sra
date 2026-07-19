"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function TenantLoginForm({ domain, continuation }: { domain: string; continuation: string | null }) {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const callback = `/${domain}/continue${continuation ? `?continuation=${encodeURIComponent(continuation)}` : ""}`;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const email = data.get("email");
    const password = data.get("password");
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      setError("Email dan kata sandi wajib diisi.");
      return;
    }
    setIsLoading(true);
    try {
      const result = await authClient.signIn.email({ email, password, callbackURL: callback });
      if (result.error) setError("Email atau kata sandi tidak valid.");
      else window.location.assign(callback);
    } catch {
      setError("Tidak dapat terhubung ke server. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }

  return <form onSubmit={submit} className="mt-6">
    <FieldGroup>
      {error ? <FieldError errors={[{ message: error }]} /> : null}
      <Field><FieldLabel htmlFor="email">Email</FieldLabel><Input id="email" name="email" type="email" required /></Field>
      <Field><FieldLabel htmlFor="password">Kata Sandi</FieldLabel><Input id="password" name="password" type="password" required /></Field>
      <Button disabled={isLoading} type="submit">{isLoading ? "Memproses..." : "Masuk"}</Button>
    </FieldGroup>
  </form>;
}
