"use client"

import { useEffect } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"

type Variant = { key: string; name: string }

export function PrototypeSwitcher({ variants, current }: { variants: Variant[]; current: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function select(offset: number) {
    const index = variants.findIndex((variant) => variant.key === current)
    const next = variants[(index + offset + variants.length) % variants.length]
    const params = new URLSearchParams(searchParams.toString())
    params.set("variant", next.key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.matches("input, textarea, [contenteditable='true']")) return
      if (event.key === "ArrowLeft") select(-1)
      if (event.key === "ArrowRight") select(1)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  })

  if (process.env.NODE_ENV === "production") return null
  const active = variants.find((variant) => variant.key === current) ?? variants[0]

  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-foreground px-2 py-2 text-background shadow-2xl">
      <Button aria-label="Variant sebelumnya" onClick={() => select(-1)} size="icon-sm" variant="ghost"><ArrowLeft /></Button>
      <span className="min-w-48 text-center text-sm font-semibold">{active.key} — {active.name}</span>
      <Button aria-label="Variant berikutnya" onClick={() => select(1)} size="icon-sm" variant="ghost"><ArrowRight /></Button>
    </div>
  )
}
