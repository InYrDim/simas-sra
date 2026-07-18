"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email");
    const result = await authClient.requestPasswordReset({
      email: typeof email === "string" ? email : "",
      redirectTo: "/reset-password",
    });
    setIsLoading(false);
    if (result.error) {
      setError("Permintaan pemulihan belum dapat diproses. Hubungi Provider Admin.");
      return;
    }
    setIsSubmitted(true);
  };

  return (
    <Card className="shadow-2xl shadow-primary/5">
      <CardHeader className="space-y-1 pb-6">
        <CardTitle className="text-2xl font-bold text-center">Lupa Kata Sandi</CardTitle>
        <CardDescription className="text-center">
          Masukkan email Anda dan kami akan mengirimkan tautan untuk mengatur ulang kata sandi.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isSubmitted ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="size-6 text-primary" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Jika email tersebut terdaftar, instruksi pemulihan telah dikirim. Silakan periksa kotak masuk Anda.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
              <Field>
                <FieldLabel htmlFor="email">Email Terdaftar</FieldLabel>
                <Input id="email" name="email" type="email" placeholder="admin@sekolah.sch.id" required />
              </Field>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : "Kirim Tautan Pemulihan"}
              </Button>
            </FieldGroup>
          </form>
        )}
      </CardContent>
      <CardFooter className="flex justify-center border-t border-border/50 pt-6">
        <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground flex items-center transition-colors">
          <ArrowLeft className="mr-2 size-4" />
          Kembali ke halaman masuk
        </Link>
      </CardFooter>
    </Card>
  );
}
