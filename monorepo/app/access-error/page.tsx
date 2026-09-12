import { SignOutButton } from "@/app/access-error/sign-out-button";

export default function AccessErrorPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="max-w-lg rounded-xl border p-8 text-center">
        <h1 className="text-2xl font-semibold">Akun belum dapat diakses</h1>
        <p className="mt-3 text-muted-foreground">Kami tidak dapat menentukan akses yang aman untuk akun ini. Hubungi Provider untuk memperoleh bantuan.</p>
        <div className="mt-6"><SignOutButton /></div>
      </section>
    </main>
  );
}
