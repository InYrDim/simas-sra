const fs = require('fs');
const path = require('path');

const routes = [
  { path: 'absensi', title: 'Absensi' },
  { path: 'e-library', title: 'E-Library' },
  { path: 'persuratan', title: 'Persuratan' },
  { path: 'jadwal/mengajar', title: 'Jadwal Mengajar' },
  { path: 'jadwal/events', title: 'Events' },
  { path: 'master/siswa', title: 'Data Siswa' },
  { path: 'master/guru', title: 'Data Guru' },
  { path: 'master/staf', title: 'Data Staf' },
  { path: 'master/mapel', title: 'Mata Pelajaran' },
  { path: 'master/organisasi', title: 'Data Organisasi' },
];

const basePath = path.join(process.cwd(), 'app', '(authenticated)');

routes.forEach(route => {
  const dirPath = path.join(basePath, route.path);
  fs.mkdirSync(dirPath, { recursive: true });
  
  const componentName = route.title.replace(/[\s-]/g, '');
  const content = `export default function ${componentName}Page() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">${route.title}</h1>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <p className="text-muted-foreground">Halaman ${route.title} sedang dalam pengembangan.</p>
      </div>
    </div>
  );
}
`;
  fs.writeFileSync(path.join(dirPath, 'page.tsx'), content);
});
console.log('Routes created successfully.');
