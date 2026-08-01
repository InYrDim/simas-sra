<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `monorepo\node_modules\next\dist\docs\index.md` before writing any code. Heed deprecation notices.

This project using App Router `monorepo\node_modules\next\dist\docs\01-app\index.md` do not refer any reference about page router.

# Code Style (Next.js 16 / React 19)

## Server vs Client Components
Default Server Component. Tambahin `'use client'` cuma kalau butuh
interaktivitas, browser API, atau hook (useState/useEffect).
[FILL IN: kalau ada konvensi naming khusus untuk client component]

## Async Request APIs
`cookies()`, `headers()`, `params`, dan `searchParams` semuanya async di
Next.js 16 — akses sinkron udah gak didukung lagi. Selalu `await`:

​```tsx
const { id } = await params
const cookieStore = await cookies()
​```

## Middleware → Proxy
Next.js 16 ganti nama middleware jadi proxy (function dan file convention-nya).
Pakai `proxy` untuk logic level-route kayak tenant auth check, bukan
`middleware` yang lama.

## Caching
Caching sekarang opt-in lewat directive `"use cache"` (Cache Components),
bukan implisit lagi. Kalau sebuah route/function butuh di-cache, tandain
eksplisit — jangan asumsi Next bakal cache otomatis.

## UI components
Project ini pakai Base UI + shadcn. Pakai komponen yang udah ada di
`[FILL IN: path components]` dulu; kalau generate baru, ikutin pattern
Base UI primitive yang udah ada, bukan default ke contoh shadcn+Radix
dari pengetahuan umum.

## Styling
Tailwind v4 — config-nya di CSS lewat `@theme`, bukan `tailwind.config.js`.
Jangan bikin/edit `tailwind.config.js`; tambahin design token di theme
block CSS.

## TypeScript
[FILL IN: preferensi interface vs type, ekspektasi strict mode — ini gak
kelihatan dari package.json aja]
<!-- END:nextjs-agent-rules -->
