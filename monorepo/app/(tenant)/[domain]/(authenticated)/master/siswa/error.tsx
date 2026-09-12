"use client";

import { MasterDataRegionError } from "@/components/master-data/workspace-states";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <MasterDataRegionError retry={reset} />; }
