"use client";

import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TenantFeatureAvailability } from "@/lib/features/tenant-feature-availability";

export function FeatureAction({
  availability,
  enabledTrigger,
  disabledTrigger,
}: Readonly<{
  availability: TenantFeatureAvailability;
  enabledTrigger: ReactNode;
  disabledTrigger: ReactNode;
}>) {
  if (availability.enabled) return enabledTrigger;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            aria-label={availability.message ?? "Fitur tidak tersedia"}
            className="inline-flex w-fit cursor-not-allowed"
            role="button"
            tabIndex={0}
          />
        }
      >
        <span className="pointer-events-none inline-flex">{disabledTrigger}</span>
      </TooltipTrigger>
      <TooltipContent>{availability.message ?? "Fitur tidak tersedia."}</TooltipContent>
    </Tooltip>
  );
}
