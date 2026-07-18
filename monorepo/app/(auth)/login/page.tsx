"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldGroup, FieldError } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    
    if (!email || !password) {
      setError("Email dan kata sandi wajib diisi.");
      return;
    }
    
    setIsLoading(true);
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      setIsLoading(false);
      setError("Email atau kata sandi tidak valid.");
      return;
    }
    window.location.assign("/continue");
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="space-y-1 pb-6">
        <CardTitle className="text-2xl font-bold text-center">Masuk ke SIMAS</CardTitle>
        <CardDescription className="text-center">
          Masukkan email dan kata sandi Anda untuk mengakses dasbor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {error && <FieldError errors={[{ message: error }]} className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" />}
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" name="email" type="email" placeholder="admin@sekolah.sch.id" required />
            </Field>
            <Field>
              <div className="flex items-center justify-between w-full">
                <FieldLabel htmlFor="password">Kata Sandi</FieldLabel>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline font-medium">
                  Lupa kata sandi?
                </Link>
              </div>
              <Input id="password" name="password" type="password" required />
            </Field>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Memproses...
                </>
              ) : (
                <>
                  Masuk <ArrowRight className="ml-2 size-4" />
                </>
              )}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center border-t border-border/50 pt-6">
        <div className="text-sm text-muted-foreground">
          Belum punya akun?{" "}
          <Link href="/register" className="text-primary hover:underline font-medium">
            Daftar sekarang
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
