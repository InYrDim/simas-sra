"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore, useState } from "react";
import { ChevronLeft, ChevronRight, MessagesSquare, CircleOff } from "lucide-react";

import { listWhatsAppBotChatsAction } from "@/app/(tenant)/[domain]/(authenticated)/integrasi/whatsapp/akun/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OpenWaChat } from "@/lib/integrations/whatsapp-bot/openwa-client";
import {
  createStorageTimedCache,
  createTimedCache,
  type TimedCache,
} from "@/lib/utils/timed-cache";

const PAGE_SIZE = 50;
const FETCH_LIMIT = 1000;
const CHATS_CACHE_TTL_MS = 60_000;

type ChatsErrorCode =
  | "unconfigured"
  | "not-connected"
  | "session-not-ready"
  | "openwa-unreachable"
  | "error";

type ChatsState =
  | { status: "loading" }
  | { status: "ready"; chats: OpenWaChat[]; loadedAt: number }
  | { status: "error"; code: ChatsErrorCode };

const CHATS_CACHE_NAMESPACE = "whatsapp-bot-chats";

const LOADING_STATE: ChatsState = { status: "loading" };
const NOT_CONNECTED_STATE: ChatsState = { status: "error", code: "not-connected" };

const rawChatsCache: TimedCache<ChatsState> =
  typeof sessionStorage !== "undefined"
    ? createStorageTimedCache<ChatsState>({
        namespace: CHATS_CACHE_NAMESPACE,
        storage: sessionStorage,
        ttlMs: CHATS_CACHE_TTL_MS,
      })
    : createTimedCache<ChatsState>(CHATS_CACHE_TTL_MS);

const transientStates = new Map<string, ChatsState>();
const subscribers = new Set<() => void>();

function notifyStateChanged() {
  for (const listener of subscribers) listener();
}

function setTransientState(domain: string, next: ChatsState) {
  transientStates.set(domain, next);
  notifyStateChanged();
}

function clearTransientState(domain: string) {
  if (transientStates.delete(domain)) notifyStateChanged();
}

function setCachedState(domain: string, next: ChatsState) {
  rawChatsCache.set(domain, next);
  clearTransientState(domain);
}

function subscribe(listener: () => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function useChatsState(domain: string, connected: boolean): ChatsState {
  const getSnapshot = useCallback(() => {
    if (!connected) return NOT_CONNECTED_STATE;
    return transientStates.get(domain) ?? rawChatsCache.get(domain) ?? LOADING_STATE;
  }, [domain, connected]);
  const getServerSnapshot = useCallback(
    () => (connected ? LOADING_STATE : NOT_CONNECTED_STATE),
    [connected],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function chatsErrorText(code: ChatsErrorCode): string {
  switch (code) {
    case "unconfigured":
      return "Kredensial OpenWA untuk sekolah ini belum disiapkan Provider. Hubungi tim SIMAS.";
    case "not-connected":
      return "WhatsApp Bot belum terhubung. Hubungkan session dahulu sebelum melihat daftar chat.";
    case "session-not-ready":
      return "Session WhatsApp sedang tidak aktif (reconnecting/terputus). Coba beberapa saat lagi.";
    case "openwa-unreachable":
      return "Server OpenWA tidak dapat dijangkau. Coba lagi setelah Provider memeriksa konfigurasi.";
    default:
      return "Terjadi kesalahan saat memuat daftar chat. Coba lagi.";
  }
}

function chatKindLabel(kind: string): string {
  switch (kind) {
    case "individual":
      return "Pribadi";
    case "group":
      return "Grup";
    case "channel":
      return "Channel";
    case "status":
      return "Status";
    case "broadcast":
      return "Siaran";
    default:
      return "Lainnya";
  }
}

const activityFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "short", timeStyle: "short" });

function formatActivity(timestamp: number | null): string {
  if (timestamp === null) return "—";
  return activityFormat.format(new Date(timestamp * 1000));
}

export function WhatsAppBotChatsTab({ domain, connected }: { domain: string; connected: boolean }) {
  const state = useChatsState(domain, connected);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!connected || state.status !== "loading") return;
    if (retryNonce === 0) {
      const cached = rawChatsCache.get(domain);
      if (cached) {
        clearTransientState(domain);
        return;
      }
    }
    let cancelled = false;
    listWhatsAppBotChatsAction(domain, { offset: 0, limit: FETCH_LIMIT }).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        const next: ChatsState = { status: "ready", chats: result.chats, loadedAt: Date.now() };
        setCachedState(domain, next);
      } else {
        setTransientState(domain, { status: "error", code: result.code });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [domain, connected, state.status, retryNonce]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const filtered = useMemo(() => {
    if (state.status !== "ready") return [];
    if (!debouncedQuery) return state.chats;
    const needle = debouncedQuery.toLowerCase();
    return state.chats.filter((chat) => {
      return (
        chat.name.toLowerCase().includes(needle) ||
        chat.number.toLowerCase().includes(needle) ||
        (chat.lastMessage?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [state, debouncedQuery]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const handleRetry = useCallback(() => {
    setTransientState(domain, LOADING_STATE);
    setPage(0);
    setRetryNonce((current) => current + 1);
  }, [domain]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setPage(0);
  }, []);

  const readyChats = state.status === "ready" ? state.chats : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="Cari nama atau nomor chat…"
          className="sm:max-w-xs"
          type="search"
          aria-label="Cari chat"
        />
        <p className="text-sm text-muted-foreground">
          {state.status === "loading"
            ? "Memuat chat…"
            : `${filtered.length} chat${readyChats.length >= FETCH_LIMIT ? " (bisa lebih banyak, hanya 1000 teratas yang dimuat)" : ""}`}
          {state.status === "ready" ? ` · Diperbarui ${new Intl.DateTimeFormat("id-ID", { dateStyle: "short", timeStyle: "short" }).format(state.loadedAt)}` : ""}
        </p>
      </div>

      {state.status === "loading" ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Spinner aria-hidden="true" className="size-5" />
            </EmptyMedia>
            <EmptyTitle>Memuat daftar chat</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <EmptyDescription>Mengambil chat dari akun WhatsApp bot…</EmptyDescription>
          </EmptyContent>
        </Empty>
      ) : state.status === "error" ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleOff aria-hidden="true" className="size-6" />
            </EmptyMedia>
            <EmptyTitle>Chat tidak tersedia</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <EmptyDescription>{chatsErrorText(state.code)}</EmptyDescription>
            {state.code !== "not-connected" ? (
              <Button type="button" variant="outline" onClick={handleRetry}>
                Muat Ulang
              </Button>
            ) : null}
          </EmptyContent>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessagesSquare aria-hidden="true" className="size-6" />
            </EmptyMedia>
            <EmptyTitle>{debouncedQuery ? "Tidak ditemukan" : "Belum ada chat"}</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <EmptyDescription>
              {debouncedQuery
                ? "Tidak ada chat yang cocok dengan pencarianmu."
                : "Belum ada percakapan pada akun WhatsApp bot ini."}
            </EmptyDescription>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Nomor</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Belum dibaca</TableHead>
                <TableHead>Aktivitas terakhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((chat) => (
                <TableRow key={chat.id}>
                  <TableCell className="font-medium">{chat.name}</TableCell>
                  <TableCell className="font-mono">{chat.number}</TableCell>
                  <TableCell>
                    <Badge variant={chat.isGroup ? "outline" : "secondary"}>{chatKindLabel(chat.kind)}</Badge>
                  </TableCell>
                  <TableCell>
                    {chat.unreadCount > 0 ? <Badge variant="destructive">{chat.unreadCount}</Badge> : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatActivity(chat.timestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Halaman {safePage + 1} dari {pageCount}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safePage === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                <ChevronLeft aria-hidden="true" />
                Sebelumnya
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              >
                Berikutnya
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}