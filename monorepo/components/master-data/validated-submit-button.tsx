"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type RequiredControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isFormComplete(form: HTMLFormElement) {
  const requiredControls = Array.from(
    form.querySelectorAll<RequiredControl>("input[required], select[required], textarea[required]"),
  );

  return (
    form.checkValidity() &&
    requiredControls.every((control) => {
      if (control.disabled) return true;
      if (control instanceof HTMLInputElement && control.type === "checkbox") {
        return control.checked;
      }
      return control.value.trim().length > 0;
    })
  );
}

export function ValidatedSubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [complete, setComplete] = useState(false);
  const { pending } = useFormStatus();

  useEffect(() => {
    const form = buttonRef.current?.form;
    if (!form) return;

    const update = () => setComplete(isFormComplete(form));
    const updateAfterReset = () => window.setTimeout(update);

    update();
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener("reset", updateAfterReset);

    return () => {
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
      form.removeEventListener("reset", updateAfterReset);
    };
  }, []);

  return (
    <Button
      ref={buttonRef}
      type="submit"
      className={className}
      disabled={!complete || pending}
    >
      {pending ? "Menyimpan…" : children}
    </Button>
  );
}
