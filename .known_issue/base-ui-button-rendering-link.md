# Base UI Button Merender Elemen Non-Button

## Gejala

Console browser menampilkan error berikut:

```text
Base UI: A component that acts as a button expected a native <button>
because the `nativeButton` prop is true. Rendering a non-<button> removes
native button semantics, which can impact forms and accessibility. Use a
real <button> in the `render` prop, or set `nativeButton` to `false`.
```

Error muncul ketika komponen UI `Button` merender `next/link` melalui prop
`render`:

```tsx
<Button render={<Link href="/tujuan" />}>
  Buka
</Button>
```

## Penyebab

`components/ui/button.tsx` membungkus `Button` dari Base UI. Secara default,
Base UI menetapkan `nativeButton={true}` dan mengharapkan elemen akhirnya
berupa native `<button>`.

Ketika prop `render` mengganti elemen akhir menjadi `<Link>` atau `<a>`,
asumsi tersebut tidak lagi benar. Base UI kemudian memberi peringatan karena
semantik tombol dan semantik tautan berbeda.

## Solusi

Jika `Button` sengaja digunakan untuk memberi tampilan tombol pada sebuah
tautan, tetapkan `nativeButton={false}`:

```tsx
<Button
  nativeButton={false}
  render={<Link href="/tujuan" />}
>
  Buka
</Button>
```

Untuk tautan unduhan dokumen:

```tsx
<Button
  nativeButton={false}
  size="icon-sm"
  variant="ghost"
  render={
    <Link
      href={`${documentUrl}?download=1`}
      aria-label={`Unduh ${document.originalFileName}`}
    />
  }
>
  <Download className="size-3.5" />
</Button>
```

Jika aksi sebenarnya adalah aksi tombol, jangan gunakan `Link`. Render native
`<button>` dan pertahankan `nativeButton={true}` atau nilai defaultnya.

## Pedoman Pencegahan

- Gunakan `nativeButton={false}` setiap kali `Button` merender `<Link>` atau
  `<a>` melalui prop `render`.
- Jangan menonaktifkan `nativeButton` apabila elemen akhirnya tetap berupa
  native `<button>`.
- Pilih semantik berdasarkan perilaku: navigasi menggunakan tautan, sedangkan
  submit atau aksi lokal menggunakan tombol.
- Pastikan tautan yang hanya berisi ikon memiliki `aria-label` yang jelas.

## Lokasi Kasus yang Diperbaiki

Kasus ini ditemukan pada tombol unduh preview dokumen PPDB di:

```text
monorepo/app/(tenant)/[domain]/(authenticated)/ppdb/submissions-table.tsx
```

Perbaikannya adalah menambahkan `nativeButton={false}` pada `Button` yang
merender `Link` unduhan.
