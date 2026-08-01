'use client';

import { useMemo, useState, useTransition } from 'react';
import { AlertTriangle, Search, ShieldCheck, Users } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import type { EligibleAssignmentAccount } from '@/lib/authorization/tenant-role-assignment-data';
import type { AssignmentAccountAccess } from '@/lib/authorization/tenant-role-assignment-query-data';
import type { AssignmentRoleRow } from '@/lib/authorization/tenant-role-assignment';
import type { BulkRoleOperation, BulkRoleOutcome } from '@/lib/authorization/tenant-role-bulk-assignment';

import {
  commitBulkRoleChangeAction,
  getEffectiveAccessAction,
  previewBulkRoleChangeAction,
  replaceRoleSetAction,
  searchEligibleAccountsAction,
} from './actions';

type Props = Readonly<{
  domain: string;
  initialRoles: readonly AssignmentRoleRow[];
  initialAccounts: readonly EligibleAssignmentAccount[];
}>;

const lifecycleLabels = {
  active: 'Aktif',
  'pending-activation': 'Menunggu aktivasi',
  inactive: 'Nonaktif',
} as const;

function toggle(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function AssignmentsClient({ domain, initialRoles, initialAccounts }: Props) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [query, setQuery] = useState('');
  const [lifecycle, setLifecycle] = useState<'all' | EligibleAssignmentAccount['lifecycle']>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [account, setAccount] = useState<AssignmentAccountAccess | null>(null);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [confirmZero, setConfirmZero] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [bulkOperation, setBulkOperation] = useState<BulkRoleOperation>('add');
  const [bulkRoleIds, setBulkRoleIds] = useState<string[]>([]);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkPreview, setBulkPreview] = useState<readonly BulkRoleOutcome[] | null>(null);
  const [bulkConfirmZero, setBulkConfirmZero] = useState(false);
  const [isSearching, startSearch] = useTransition();
  const [isLoadingAccess, startAccess] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [isBulk, startBulk] = useTransition();

  const selectedTargets = useMemo(() => accounts.filter((item) => selectedUserIds.includes(item.userId)), [accounts, selectedUserIds]);
  const zeroAccess = roleIds.length === 0;
  const bulkHasZero = bulkPreview?.some((item) => item.outcome === 'zero-role') ?? false;

  function searchAccounts() {
    setMessage(null);
    startSearch(async () => {
      const result = await searchEligibleAccountsAction(domain, {
        query,
        ...(lifecycle === 'all' ? {} : { lifecycle }),
      });
      setAccounts(result);
      setSelectedUserIds((current) => current.filter((id) => result.some((item) => item.userId === id)));
    });
  }

  function openAccount(userId: string) {
    setMessage(null);
    startAccess(async () => {
      const result = await getEffectiveAccessAction(domain, userId);
      setAccount(result);
      setRoleIds(result?.roleIds ? [...result.roleIds] : []);
      setReason('');
      setConfirmZero(false);
      if (!result) setMessage('Pengguna tidak lagi memenuhi syarat assignment.');
    });
  }

  function saveAccount() {
    if (!account) return;
    setMessage(null);
    startSave(async () => {
      const result = await replaceRoleSetAction(domain, {
        targetUserId: account.userId,
        roleIds,
        expectedAssignmentVersion: account.assignmentVersion,
        reason,
        confirmZeroAccess: confirmZero,
      });
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      setAccount(result.data);
      setAccounts((current) => current.map((item) => item.userId === result.data.userId
        ? { ...item, assignmentVersion: result.data.assignmentVersion, activeRoleIds: result.data.roleIds }
        : item));
      setReason('');
      setConfirmZero(false);
      setMessage('Assignment role berhasil diperbarui.');
    });
  }

  function previewBulk() {
    setMessage(null);
    startBulk(async () => {
      const result = await previewBulkRoleChangeAction(domain, {
        operation: bulkOperation,
        roleIds: bulkRoleIds,
        targets: selectedTargets.map((target) => ({
          userId: target.userId,
          expectedAssignmentVersion: target.assignmentVersion,
        })),
      });
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      setBulkPreview(result.data);
      setBulkConfirmZero(false);
    });
  }

  function commitBulk() {
    startBulk(async () => {
      const result = await commitBulkRoleChangeAction(domain, {
        operation: bulkOperation,
        roleIds: bulkRoleIds,
        targets: selectedTargets.map((target) => ({
          userId: target.userId,
          expectedAssignmentVersion: target.assignmentVersion,
        })),
        reason: bulkReason,
        confirmZeroAccess: bulkConfirmZero,
      });
      if (!result.success) {
        setBulkPreview(null);
        setMessage(result.error);
        return;
      }
      const refreshed = await searchEligibleAccountsAction(domain, {});
      setAccounts(refreshed);
      setSelectedUserIds([]);
      setBulkPreview(null);
      setBulkReason('');
      setBulkRoleIds([]);
      setMessage(`${result.data.filter((item) => item.outcome !== 'unchanged').length} assignment pengguna diproses.`);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Assignment role</h1>
        <p className="mt-1 text-sm text-muted-foreground">Kelola beberapa role per pengguna dan periksa akses efektif sebelum menyimpan.</p>
      </header>

      {message && <Alert><ShieldCheck /><AlertTitle>Status</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.35fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Direktori pengguna</CardTitle>
            <CardDescription>School Admin tidak ditampilkan. Maksimal 100 target per proses bulk.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && searchAccounts()} placeholder="Cari nama atau email" aria-label="Cari pengguna" />
              <NativeSelect value={lifecycle} onChange={(event) => setLifecycle(event.target.value as typeof lifecycle)} aria-label="Filter status">
                <NativeSelectOption value="all">Semua status</NativeSelectOption>
                <NativeSelectOption value="active">Aktif</NativeSelectOption>
                <NativeSelectOption value="pending-activation">Menunggu</NativeSelectOption>
                <NativeSelectOption value="inactive">Nonaktif</NativeSelectOption>
              </NativeSelect>
              <Button variant="outline" size="icon" onClick={searchAccounts} disabled={isSearching} aria-label="Jalankan pencarian">
                {isSearching ? <Spinner /> : <Search />}
              </Button>
            </div>
            <div className="max-h-[31rem] space-y-2 overflow-y-auto pr-1">
              {accounts.map((item) => (
                <div key={item.userId} className="flex items-start gap-3 rounded-xl border p-3">
                  <Checkbox checked={selectedUserIds.includes(item.userId)} onCheckedChange={() => setSelectedUserIds((current) => toggle(current, item.userId))} aria-label={`Pilih ${item.name} untuk bulk`} />
                  <button className="min-w-0 flex-1 text-left" onClick={() => openAccount(item.userId)} type="button">
                    <span className="block truncate font-medium">{item.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.email}</span>
                    <span className="mt-2 flex flex-wrap gap-1">
                      <Badge variant="outline">{lifecycleLabels[item.lifecycle]}</Badge>
                      <Badge variant="secondary">{item.activeRoleIds.length} role</Badge>
                    </span>
                  </button>
                </div>
              ))}
              {accounts.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Tidak ada pengguna yang cocok.</p>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {isLoadingAccess && <Card><CardContent className="flex items-center gap-2 py-12"><Spinner /> Memuat akses efektif…</CardContent></Card>}
          {!isLoadingAccess && !account && <Card><CardContent className="flex min-h-48 flex-col items-center justify-center gap-2 text-center text-muted-foreground"><Users className="size-8" /><p>Pilih pengguna untuk mengelola role.</p></CardContent></Card>}
          {!isLoadingAccess && account && (
            <Card>
              <CardHeader>
                <CardTitle>{account.name}</CardTitle>
                <CardDescription>{account.email} · versi assignment {account.assignmentVersion}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <fieldset className="space-y-2">
                  <legend className="mb-2 font-medium">Role aktif</legend>
                  {initialRoles.map((role) => (
                    <label key={role.id} className="flex items-start gap-3 rounded-xl border p-3">
                      <Checkbox checked={roleIds.includes(role.id)} onCheckedChange={() => setRoleIds((current) => toggle(current, role.id))} disabled={account.lifecycle !== 'active'} />
                      <span><span className="block font-medium">{role.name}</span><span className="text-xs text-muted-foreground">{role.permissions.length} permission</span></span>
                    </label>
                  ))}
                </fieldset>

                {zeroAccess && (
                  <Alert variant="destructive"><AlertTriangle /><AlertTitle>Akses belum diberikan</AlertTitle><AlertDescription>Menyimpan tanpa role menghapus seluruh akses berbasis role pengguna ini.</AlertDescription></Alert>
                )}
                <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={zeroAccess ? 'Alasan wajib untuk menghapus seluruh akses' : 'Alasan perubahan (opsional)'} aria-label="Alasan perubahan" />
                {zeroAccess && <label className="flex items-center gap-2 text-sm"><Checkbox checked={confirmZero} onCheckedChange={(checked) => setConfirmZero(checked)} /> Saya memahami pengguna akan memiliki nol role.</label>}
                <Button onClick={saveAccount} disabled={isSaving || account.lifecycle !== 'active' || (zeroAccess && (!confirmZero || !reason.trim()))}>
                  {isSaving && <Spinner />} Simpan assignment
                </Button>

                <div className="border-t pt-5">
                  <h3 className="font-medium">Akses efektif saat ini</h3>
                  <p className="mb-3 text-xs text-muted-foreground">Permission digabung dan dideduplikasi dari seluruh role aktif.</p>
                  <div className="space-y-2">
                    {account.effectiveAccess.map((permission) => (
                      <div key={permission.key} className="rounded-xl bg-muted/50 p-3">
                        <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{permission.label}</span><Badge variant={permission.risk === 'critical' ? 'destructive' : 'outline'}>{permission.risk}</Badge></div>
                        <p className="mt-1 text-xs text-muted-foreground">{permission.description}</p>
                        <p className="mt-2 text-xs">Sumber: {permission.sources.map((source) => source.roleName).join(', ')}</p>
                        {permission.unavailableEntitlement && <p className="mt-1 text-xs text-destructive">Tidak tersedia: {permission.unavailableEntitlement}</p>}
                        {permission.contextualLimitations.map((limit) => <p key={limit} className="mt-1 text-xs text-amber-700 dark:text-amber-400">{limit}</p>)}
                      </div>
                    ))}
                    {account.effectiveAccess.length === 0 && <p className="text-sm text-muted-foreground">Akses belum diberikan.</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Bulk assignment</CardTitle><CardDescription>{selectedTargets.length} pengguna dipilih.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <NativeSelect value={bulkOperation} onChange={(event) => setBulkOperation(event.target.value as BulkRoleOperation)} aria-label="Operasi bulk">
                <NativeSelectOption value="add">Tambahkan role</NativeSelectOption>
                <NativeSelectOption value="revoke">Cabut role</NativeSelectOption>
              </NativeSelect>
              <div className="grid gap-2 sm:grid-cols-2">
                {initialRoles.map((role) => <label key={role.id} className="flex items-center gap-2 rounded-xl border p-3"><Checkbox checked={bulkRoleIds.includes(role.id)} onCheckedChange={() => setBulkRoleIds((current) => toggle(current, role.id))} />{role.name}</label>)}
              </div>
              <Textarea value={bulkReason} onChange={(event) => setBulkReason(event.target.value)} placeholder="Alasan perubahan bulk (wajib)" />
              <Button variant="outline" onClick={previewBulk} disabled={isBulk || selectedTargets.length === 0 || bulkRoleIds.length === 0 || !bulkReason.trim()}>{isBulk && <Spinner />} Preview perubahan</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={bulkPreview !== null} onOpenChange={(open) => !open && setBulkPreview(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Preview bulk assignment</DialogTitle><DialogDescription>Periksa seluruh hasil. Target invalid membatalkan commit atomik.</DialogDescription></DialogHeader>
          <div className="space-y-2">
            {bulkPreview?.map((outcome) => {
              const target = selectedTargets.find((item) => item.userId === outcome.userId);
              return <div key={outcome.userId} className="flex items-start justify-between gap-4 rounded-xl border p-3"><div><p className="font-medium">{target?.name ?? outcome.userId}</p><p className="text-xs text-muted-foreground">{outcome.currentRoleIds.length} → {outcome.nextRoleIds.length} role</p>{outcome.reason && <p className="text-xs text-destructive">{outcome.reason}</p>}</div><Badge variant={outcome.outcome === 'invalid' || outcome.outcome === 'zero-role' ? 'destructive' : 'outline'}>{outcome.outcome}</Badge></div>;
            })}
          </div>
          {bulkHasZero && <label className="flex items-center gap-2 rounded-xl border border-destructive/40 p-3 text-sm"><Checkbox checked={bulkConfirmZero} onCheckedChange={(checked) => setBulkConfirmZero(checked)} /> Konfirmasi target bertanda zero-role akan kehilangan seluruh role.</label>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkPreview(null)} disabled={isBulk}>Batal</Button>
            <Button onClick={commitBulk} disabled={isBulk || bulkPreview?.some((item) => item.outcome === 'invalid') || (bulkHasZero && !bulkConfirmZero)}>{isBulk && <Spinner />} Terapkan perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
