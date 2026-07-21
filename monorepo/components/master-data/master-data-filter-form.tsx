"use client";

import type { FormEvent, ReactNode } from "react";

export function MasterDataFilterForm({
  action,
  className,
  children,
}: {
  action: string;
  className?: string;
  children: ReactNode;
}) {
  function submitSelection(event: FormEvent<HTMLFormElement>) {
    const control = event.target as HTMLInputElement | HTMLSelectElement;
    if (!control.name || control.name === "q") return;
    event.currentTarget.requestSubmit();
  }

  return (
    <form
      action={action}
      className={className}
      role="search"
      onChange={submitSelection}
    >
      {children}
    </form>
  );
}
