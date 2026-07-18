import { changeRequiredPasswordAction } from "@/app/(auth)/change-password/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SignOutButton } from "@/app/(auth)/change-password/sign-out-button";

const errors: Record<string, string> = {
  confirmation: "Konfirmasi kata sandi tidak cocok.",
  current: "Kredensial sementara yang Anda masukkan salah.",
  invalid: "Kata sandi baru wajib memiliki minimal 8 karakter.",
};

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <Card className="border-none bg-transparent shadow-none">
      <CardHeader>
        <CardTitle className="text-center text-2xl">Ganti kata sandi</CardTitle>
        <CardDescription className="text-center">
          Ganti kredensial sementara sebelum menggunakan fitur Tenant.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={changeRequiredPasswordAction}>
          <FieldGroup>
            {error && errors[error] ? <FieldError errors={[{ message: errors[error] }]} /> : null}
            <Field>
              <FieldLabel htmlFor="currentPassword">Kredensial sementara</FieldLabel>
              <Input autoComplete="current-password" id="currentPassword" name="currentPassword" required type="password" />
            </Field>
            <Field>
              <FieldLabel htmlFor="newPassword">Kata sandi baru</FieldLabel>
              <Input autoComplete="new-password" id="newPassword" minLength={8} name="newPassword" required type="password" />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmation">Ulangi kata sandi baru</FieldLabel>
              <Input autoComplete="new-password" id="confirmation" minLength={8} name="confirmation" required type="password" />
            </Field>
            <Button type="submit">Simpan kata sandi</Button>
            <SignOutButton />
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
