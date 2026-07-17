# Dokumentasi Navigasi Sidebar (NavMenu)

Sistem navigasi sidebar di aplikasi ini menggunakan komponen kustom `NavMenu` yang bersifat dinamis, rekursif (mendukung *nested menu*), dan mendukung pembagian grup (*grouping*), serta disaring berdasarkan *Role-Based Access Control (RBAC)*.

## Struktur Data (`NavItem`)

Semua menu didefinisikan di dalam file `app-sidebar.tsx` pada *array* `menuItems` menggunakan tipe `NavItem`:

```typescript
export type NavItem = {
  title: string;
  url?: string;
  icon?: LucideIcon;
  roles: Role[];
  group?: string;
  items?: Omit<NavItem, "icon" | "group">[]; // Untuk nested items
}
```

## Cara Menambahkan Menu

Berikut adalah berbagai skenario pembuatan menu dari yang paling sederhana hingga kompleks.

### 1. Menu Standar (Satu Halaman)

Menu tunggal tanpa sub-menu. Jika `group` tidak diisi, menu akan masuk ke seksi default **"Menu Utama"**.

```typescript
{ 
  title: "Dasbor", 
  icon: Home, 
  url: "/", 
  roles: ["superadmin", "staff", "guru"] 
}
```

### 2. Menu Nested (Bersarang / Collapsible)

Jika sebuah menu memiliki properti `items`, ia akan otomatis berubah menjadi *dropdown/collapsible*. Item parent bertindak sebagai pembuka (tidak memerlukan `url` yang valid).

```typescript
{ 
  title: "Akademik", 
  icon: BookOpen, 
  roles: ["staff", "guru", "pimpinan"],
  items: [
    { title: "Jadwal Pelajaran", url: "/akademik/jadwal", roles: ["staff", "guru"] },
    { title: "Penilaian & Rapor", url: "/akademik/nilai", roles: ["guru", "pimpinan"] }
  ]
}
```
*Catatan:* Anda tidak perlu mendefinisikan `icon` pada sub-menu (level 2).

### 3. Membuat Grup/Seksi Baru

Jika Anda ingin membuat pemisah (*divider*) dan label kategori baru di Sidebar, cukup tambahkan properti `group` pada item tersebut. Komponen secara otomatis akan mengumpulkan semua menu dengan `group` yang sama di bawah satu seksi `<SidebarGroup>`.

```typescript
{ 
  title: "Pengaturan Sistem", 
  icon: Settings,
  url: "/settings",
  roles: ["superadmin"],
  group: "Sistem & Keamanan" // Akan membuat header "Sistem & Keamanan" di sidebar
}
```

## Logika RBAC (Hak Akses)

- Sistem akan memeriksa properti `roles` di setiap iterasi.
- Jika *role* pengguna saat ini (misal: `"guru"`) tidak ada di dalam *array* `roles` sebuah item, maka item tersebut **tidak akan di-render**.
- Pada menu *nested*, jika pengguna tidak memiliki akses ke **satu pun** sub-menu di dalamnya, maka menu *parent/dropdown*-nya juga akan disembunyikan secara otomatis, sehingga sidebar tetap bersih.

## Integrasi Lanjutan
Ketika Modul Auth sudah selesai (Tiket 02) dan dihubungkan ke sistem, properti `role` yang dilempar ke komponen `AppSidebar` harus diambil dari *session* yang sedang login, bukan lagi dari *state* simulasi sementara.
