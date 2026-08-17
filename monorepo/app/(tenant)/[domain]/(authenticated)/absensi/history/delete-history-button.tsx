"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type DeleteHistoryButtonProps = {
    domain: string;
    action: (domain: string, id: string) => Promise<{ ok: boolean; code?: string }>;
    id: string;
    label: string;
    description: string;
    onDeleted?: () => void;
};

export function DeleteHistoryButton({
    domain,
    action,
    id,
    label,
    description,
    onDeleted,
}: DeleteHistoryButtonProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    function handleDelete() {
        startTransition(async () => {
            const result = await action(domain, id);
            if (result.ok) {
                toast.success("Riwayat dihapus.");
                setOpen(false);
                onDeleted?.();
                router.refresh();
            } else {
                toast.error(
                    result.code === "not-found"
                        ? "Riwayat tidak ditemukan."
                        : "Gagal menghapus riwayat.",
                );
            }
        });
    }

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        aria-label={label}
                    />
                }
            >
                <Trash2 className="size-4" aria-hidden />
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{label}?</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleDelete();
                        }}
                        disabled={isPending}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isPending ? "Menghapus..." : "Hapus"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
