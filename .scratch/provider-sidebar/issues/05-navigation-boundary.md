Type: grilling
Status: resolved

## Question

Interface navigasi apa yang menjaga renderer menu tetap reusable tetapi tidak mencampurkan role Tenant dengan sidebar Provider yang tidak memerlukan filter role?

## Answer

Pisahkan navigasi menjadi dua shell dan dua renderer yang eksplisit per konteks:

- `ProviderSidebar` merender identitas Provider dan `ProviderNavMenu`.
- `TenantSidebar` merender identitas Tenant dan `TenantNavMenu`.
- Layout Provider dan Tenant mengimpor sidebar masing-masing secara langsung; jangan pertahankan `AppSidebar` sebagai dispatcher dengan prop `role` atau `surface`.

Konfigurasi dan tipe item juga terpisah. `ProviderNavItem` tidak memiliki role Tenant dan dapat merepresentasikan status ketersediaan menu. `TenantNavItem` dapat memiliki `SchoolRole` dan submenu untuk mempertahankan filtering menu Tenant. Filtering tersebut hanya mengendalikan visibilitas UI, bukan menggantikan otorisasi route atau server.

Kedua renderer berbagi primitive yang sudah tersedia dari `components/ui/sidebar`, bukan sebuah renderer atau abstraction navigasi generik baru. Helper kecil hanya boleh diekstrak kemudian jika implementasi menunjukkan duplikasi nontrivial. Dengan batas ini, `ProviderNavMenu` tidak pernah menerima `SchoolRole`, dan layout Provider tidak lagi menyamar sebagai role Tenant seperti `superadmin`.
