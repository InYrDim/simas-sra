"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  return <Button onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => window.location.assign("/login") } })}>Keluar</Button>;
}
