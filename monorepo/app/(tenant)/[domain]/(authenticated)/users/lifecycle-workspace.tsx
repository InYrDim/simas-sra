'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useMemo, useState } from 'react';
import { AlertTriangle, KeyRound, Loader2, Mail, Plus, RefreshCw, ShieldCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';

import {
  activateTenantAccountAction,
  createTenantAccountAction,
  deactivateTenantAccountAction,
  initiateTenantRecoveryAction,
  issueTenantActivationAction,
  reactivateTenantAccountAction,
  type LifecycleActionResult,
  type LifecycleWorkspaceAccount,
  type LifecycleWorkspaceData,
} from './actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type PendingKey = string | null;
type TransitionKind = 'activate' | 'deactivate' | 'reactivate';

const lifecycleLabels = {
  'pending-activation': 'Menunggu aktivasi',
  active: 'Aktif',
  inactive: 'Nonaktif',
} as const;

function PendingLabel({ label }: { label: string }) {
  return <><Loader2 className="animate-spin" aria-hidden="true" /><span>{label}</span><span className="sr-only" role="status">Sedang memproses, mohon tunggu.</span></>;
}

export function LifecycleWorkspace({ domain, initialData }: { domain: string; initialData: LifecycleWorkspaceData }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingKey>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [secretAcknowledged, setSecretAcknowledged] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [transition, setTransition] = useState<{ kind: TransitionKind; account: LifecycleWorkspaceAccount } | null>(null);

  function complete(result: LifecycleActionResult<unknown>) {
    if (!result.success) {
      toast.error(result.error);
      if (result.stale) startTransition(() => router.refresh());
      return;
    }
    toast.success(result.message);
    if (result.secret) {
      setSecretAcknowledged(false);
      setSecret(result.secret);
    }
    startTransition(() => router.refresh());
  }

  async function run(key: string, action: () => Promise<LifecycleActionResult<unknown>>) {
    setPending(key);
    try { complete(await action()); } finally { setPending(null); }
  }

  const counts = useMemo(() => ({
    active: initialData.accounts.filter((account) => account.lifecycle === 'active').length,
    pending: initialData.accounts.filter((account) => account.lifecycle === 'pending-activation').length,
    inactive: initialData.accounts.filter((account) => account.lifecycle === 'inactive').length,
  }), [initialData.accounts]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Siklus Akun Sekolah</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Buat akun, kelola aktivasi, hentikan akses dengan aman, dan pulihkan akun warga sekolah.</p>
        </div>
        <CreateAccountDialog people={initialData.people} open={createOpen} setOpen={setCreateOpen} pending={pending === 'create'} onSubmit={(input) => run('create', () => createTenantAccountAction(domain, input))} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Aktif" value={counts.active} />
        <Summary label="Menunggu aktivasi" value={counts.pending} />
        <Summary label="Nonaktif" value={counts.inactive} />
      </div>

      <Alert>
        <ShieldCheck aria-hidden="true" />
        <AlertTitle>Kontrol School Admin</AlertTitle>
        <AlertDescription>Perubahan memakai versi data terkini, dicatat untuk audit, dan tidak dapat diterapkan pada akun School Admin.</AlertDescription>
      </Alert>

      <Card>
        <CardHeader><CardTitle>Akun Tenant</CardTitle><CardDescription>{initialData.accounts.length} akun non-admin tersedia untuk dikelola.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Pengguna</TableHead><TableHead>Status</TableHead><TableHead>Tautan person</TableHead><TableHead className="text-right">Tindakan</TableHead></TableRow></TableHeader>
            <TableBody>
              {initialData.accounts.length === 0 ? <TableRow><TableCell colSpan={4} className="h-28 text-center text-muted-foreground">Belum ada akun lifecycle.</TableCell></TableRow> : initialData.accounts.map((account) => (
                <TableRow key={account.userId}>
                  <TableCell><div className="font-medium">{account.name}</div><div className="text-sm text-muted-foreground">{account.email}</div></TableCell>
                  <TableCell><Badge variant={account.lifecycle === 'active' ? 'default' : 'secondary'}>{lifecycleLabels[account.lifecycle]}</Badge></TableCell>
                  <TableCell>{account.linkedPersonId ? <Badge variant="outline">Terhubung</Badge> : <span className="text-muted-foreground">Tidak</span>}</TableCell>
                  <TableCell><div className="flex flex-wrap justify-end gap-2"><AccountActions account={account} pending={pending} run={run} domain={domain} openTransition={(kind) => setTransition({ kind, account })} /></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TransitionDialog key={transition ? `${transition.kind}:${transition.account.userId}` : 'closed'} domain={domain} value={transition} roles={initialData.roles} pending={pending === 'transition'} onClose={() => setTransition(null)} onRun={(action) => run('transition', action)} />

      <Dialog open={secret !== null} onOpenChange={() => { /* acknowledgement is intentionally required */ }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader><DialogTitle>Kredensial sementara — tampil satu kali</DialogTitle><DialogDescription>Salin dan serahkan melalui kanal yang aman. Nilai ini akan dihapus saat Anda menutup dialog atau meninggalkan halaman dan tidak dapat ditampilkan kembali.</DialogDescription></DialogHeader>
          <div className="rounded-lg border bg-muted p-3 font-mono text-sm break-all" aria-label="Kredensial sementara">{secret}</div>
          <label className="flex items-start gap-3 text-sm"><Checkbox checked={secretAcknowledged} onCheckedChange={(checked) => setSecretAcknowledged(checked === true)} /><span>Saya sudah menyimpan kredensial ini dengan aman dan memahami bahwa kredensial tidak dapat ditampilkan kembali.</span></label>
          <DialogFooter><Button disabled={!secretAcknowledged} onClick={() => { setSecret(null); setSecretAcknowledged(false); }}>Hapus dan tutup</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <Card size="sm"><CardHeader><CardDescription>{label}</CardDescription><CardTitle className="text-2xl">{value}</CardTitle></CardHeader></Card>;
}

function AccountActions({ account, pending, run, domain, openTransition }: { account: LifecycleWorkspaceAccount; pending: PendingKey; run: (key: string, action: () => Promise<LifecycleActionResult<unknown>>) => Promise<void>; domain: string; openTransition: (kind: TransitionKind) => void }) {
  const issue = (kind: 'activation' | 'recovery', mode: 'resend' | 'reissue', channel: 'email' | 'temporary-credential') => {
    const key = `${account.userId}:${kind}:${mode}:${channel}`;
    const action = kind === 'activation' ? issueTenantActivationAction : initiateTenantRecoveryAction;
    return <Button key={key} size="sm" variant="outline" disabled={pending !== null} onClick={() => run(key, () => action(domain, { targetUserId: account.userId, expectedVersion: account.version, deliveryChannel: channel, mode }))}>{pending === key ? <PendingLabel label="Memproses" /> : channel === 'email' ? <><Mail />{mode === 'resend' ? 'Kirim ulang' : 'Terbitkan baru'}</> : <><KeyRound />Kredensial baru</>}</Button>;
  };
  if (account.lifecycle === 'pending-activation') return <>{issue('activation', 'resend', 'email')}{issue('activation', 'reissue', 'temporary-credential')}<Button size="sm" variant="secondary" disabled={pending !== null} onClick={() => openTransition('activate')}>Aktifkan admin</Button></>;
  if (account.lifecycle === 'active') return <>{issue('recovery', 'reissue', 'email')}{issue('recovery', 'reissue', 'temporary-credential')}<Button size="sm" variant="destructive" disabled={pending !== null} onClick={() => openTransition('deactivate')}><UserX />Nonaktifkan</Button></>;
  return <Button size="sm" disabled={pending !== null} onClick={() => openTransition('reactivate')}><RefreshCw />Aktifkan kembali</Button>;
}

function CreateAccountDialog({ people, open, setOpen, pending, onSubmit }: { people: LifecycleWorkspaceData['people']; open: boolean; setOpen: (open: boolean) => void; pending: boolean; onSubmit: (input: { name: string; email: string; personId?: string; deliveryChannel: 'email' | 'temporary-credential' | 'administrative' }) => void }) {
  const [personId, setPersonId] = useState('none');
  const [channel, setChannel] = useState<'email' | 'temporary-credential' | 'administrative'>('email');
  return <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}><DialogTrigger render={<Button />}><Plus />Buat akun</DialogTrigger><DialogContent><form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ name: String(data.get('name') ?? ''), email: String(data.get('email') ?? ''), ...(personId !== 'none' ? { personId } : {}), deliveryChannel: channel }); }}><DialogHeader><DialogTitle>Buat atau undang akun</DialogTitle><DialogDescription>Tautkan person sekolah bila tersedia, lalu pilih cara aktivasi awal.</DialogDescription></DialogHeader><div className="my-6 space-y-4"><div className="space-y-2"><Label htmlFor="account-name">Nama</Label><Input id="account-name" name="name" required maxLength={255} /></div><div className="space-y-2"><Label htmlFor="account-email">Email</Label><Input id="account-email" name="email" type="email" required maxLength={255} /></div><div className="space-y-2"><Label>Person sekolah (opsional)</Label><Select value={personId} onValueChange={(value) => setPersonId(value ?? 'none')}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Tanpa tautan person</SelectItem>{people.map((person) => <SelectItem key={person.id} value={person.id}>{person.fullName}{person.email ? ` — ${person.email}` : ''}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Aktivasi</Label><Select value={channel} onValueChange={(value) => setChannel((value ?? 'email') as typeof channel)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="email">Undangan email</SelectItem><SelectItem value="temporary-credential">Kredensial sementara</SelectItem><SelectItem value="administrative">Aktifkan administratif</SelectItem></SelectContent></Select></div></div><DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Batal</Button><Button type="submit" disabled={pending}>{pending ? <PendingLabel label="Membuat akun" /> : 'Buat akun'}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function TransitionDialog({ domain, value, roles, pending, onClose, onRun }: { domain: string; value: { kind: TransitionKind; account: LifecycleWorkspaceAccount } | null; roles: LifecycleWorkspaceData['roles']; pending: boolean; onClose: () => void; onRun: (action: () => Promise<LifecycleActionResult<unknown>>) => void }) {
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [confirmation, setConfirmation] = useState('');
  if (!value) return null;
  const { account, kind } = value;
  const availableRoles = roles.filter((role) => account.formerRoleIds.includes(role.id));
  const destructiveReady = kind !== 'deactivate' || confirmation === account.email;
  return <Dialog open onOpenChange={(open) => !open && !pending && onClose()}><DialogContent showCloseButton={!pending}><form onSubmit={(event) => { event.preventDefault(); const reason = String(new FormData(event.currentTarget).get('reason') ?? ''); const base = { targetUserId: account.userId, expectedVersion: account.version, reason }; const action = kind === 'activate' ? () => activateTenantAccountAction(domain, base) : kind === 'deactivate' ? () => deactivateTenantAccountAction(domain, base) : () => reactivateTenantAccountAction(domain, { ...base, roleIds: selected }); onRun(async () => { const result = await action(); if (result.success) onClose(); return result; }); }}><DialogHeader><DialogTitle>{kind === 'activate' ? 'Aktivasi administratif' : kind === 'deactivate' ? 'Nonaktifkan akses akun' : 'Aktifkan kembali akun'}</DialogTitle><DialogDescription>{account.name} ({account.email}). Tindakan memakai versi akun {account.version}.</DialogDescription></DialogHeader><div className="my-6 space-y-4">{kind === 'deactivate' && <Alert variant="destructive"><AlertTriangle /><AlertTitle>Akses akan segera dihentikan</AlertTitle><AlertDescription>Semua sesi dicabut dan role ditangguhkan. Ketik email <strong>{account.email}</strong> untuk mengonfirmasi.</AlertDescription></Alert>}{kind === 'deactivate' && <div className="space-y-2"><Label htmlFor="confirmation">Konfirmasi email</Label><Input id="confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></div>}{kind === 'reactivate' && <fieldset className="space-y-2"><legend className="font-medium">Pulihkan subset role sebelumnya</legend>{availableRoles.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada role aktif sebelumnya yang dapat dipulihkan.</p> : availableRoles.map((role) => <label key={role.id} className="flex items-center gap-3 rounded-lg border p-3"><Checkbox checked={selected.includes(role.id)} onCheckedChange={(checked) => setSelected(checked === true ? [...selected, role.id] : selected.filter((id) => id !== role.id))} /><span>{role.name}</span></label>)}</fieldset>}<div className="space-y-2"><Label htmlFor="reason">Alasan administratif</Label><Textarea id="reason" name="reason" required maxLength={1000} /></div></div><DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={onClose}>Batal</Button><Button type="submit" variant={kind === 'deactivate' ? 'destructive' : 'default'} disabled={pending || !destructiveReady}>{pending ? <PendingLabel label="Memproses" /> : kind === 'deactivate' ? 'Nonaktifkan akun' : 'Konfirmasi tindakan'}</Button></DialogFooter></form></DialogContent></Dialog>;
}
