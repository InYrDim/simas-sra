"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldGroup, FieldError } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirm = formData.get("confirmPassword") as string;
    
    if (password !== confirm) {
      setError("Kata sandi tidak cocok.");
      return;
    }
    
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setError("Fungsi registrasi belum terhubung ke backend.");
    }, 1000);
  };

  return (
    <Card className="shadow-2xl shadow-primary/5">
      <CardHeader className="space-y-1 pb-6">
        <CardTitle className="text-2xl font-bold text-center">Buat Akun Baru</CardTitle>
        <CardDescription className="text-center">
          Daftarkan institusi Anda untuk memulai dengan SIMAS.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {error && <FieldError errors={[{ message: error }]} className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" />}
            <Field>
              <FieldLabel htmlFor="name">Nama Lengkap</FieldLabel>
              <Input id="name" name="name" type="text" placeholder="Budi Santoso" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" name="email" type="email" placeholder="budi@sekolah.sch.id" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Kata Sandi</FieldLabel>
              <Input id="password" name="password" type="password" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmPassword">Konfirmasi Kata Sandi</FieldLabel>
              <Input id="confirmPassword" name="confirmPassword" type="password" required />
            </Field>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : "Daftar Akun"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center border-t border-border/50 pt-6">
        <div className="text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Masuk di sini
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
