'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Role, changeRoleStatus, createRoleFromTemplate } from './actions';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Plus, Eye, Pencil, Archive, Play, Trash2, Loader2, LayoutTemplate } from 'lucide-react';
import type { TenantAssignableRolePermissionGroup } from '@/lib/authorization/tenant-role-permission-catalog';
import { TENANT_ROLE_TEMPLATES } from '@/lib/authorization/tenant-role-templates';
import { RoleDialog } from './role-dialog';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface RolesClientProps {
  initialRoles: Role[];
  permissionGroups: TenantAssignableRolePermissionGroup[];
}

export function RolesClient({ initialRoles, permissionGroups }: RolesClientProps) {
  const router = useRouter();
  const params = useParams();
  const domain = params.domain as string;
  const roles = initialRoles;
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<Role | null>(null);
  const [viewingRole, setViewingRole] = React.useState<Role | null>(null);
  const [isLoading, setIsLoading] = React.useState<string | null>(null); // role id
  const [isTemplateOpen, setIsTemplateOpen] = React.useState(false);
  const [templateLoading, setTemplateLoading] = React.useState<string | null>(null);

  const handleStatusChange = async (role: Role, status: Role['status']) => {
    setIsLoading(role.id);
    try {
      const res = await changeRoleStatus(domain, role.id, role.version, status);
      if (res.success) {
        toast.success(`Role ${status} successfully`);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update status');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsLoading(null);
    }
  };

  const openCreateDialog = () => {
    setEditingRole(null);
    setViewingRole(null);
    setIsDialogOpen(true);
  };

  const handleUseTemplate = async (templateKey: string) => {
    setTemplateLoading(templateKey);
    try {
      const res = await createRoleFromTemplate(domain, templateKey);
      if (res.success) {
        toast.success('Role berhasil dibuat dari template');
        setIsTemplateOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Gagal membuat role');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setTemplateLoading(null);
    }
  };

  const openEditDialog = (role: Role) => {
    setEditingRole(role);
    setViewingRole(null);
    setIsDialogOpen(true);
  };

  const openViewDialog = (role: Role) => {
    setViewingRole(role);
    setEditingRole(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setIsTemplateOpen(true)}>
          <LayoutTemplate className="mr-2 h-4 w-4" />
          Gunakan template
        </Button>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Create Role
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No roles found.
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell>{role.description}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        role.status === 'active'
                          ? 'default'
                          : role.status === 'draft'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {role.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{role.userCount}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                            disabled={isLoading === role.id}
                          />
                        }
                      >
                        <span className="sr-only">Open menu</span>
                        {isLoading === role.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" />
                        )}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openViewDialog(role)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Inspect
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(role)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          {role.status === 'draft' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(role, 'active')}>
                              <Play className="mr-2 h-4 w-4" />
                              Activate
                            </DropdownMenuItem>
                          )}
                          {role.status === 'active' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(role, 'draft')}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Move to Draft
                            </DropdownMenuItem>
                          )}
                          {role.status !== 'archived' && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(role, 'archived')}
                              disabled={role.userCount > 0}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              Archive
                            </DropdownMenuItem>
                          )}
                          {role.status === 'archived' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(role, 'restored')}>
                              <Play className="mr-2 h-4 w-4" />
                              Unarchive
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(role, 'deleted')}
                            disabled={role.userCount > 0}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <RoleDialog
        key={`${isDialogOpen ? 'open' : 'closed'}-${editingRole?.id ?? viewingRole?.id ?? 'new'}`}
        isOpen={isDialogOpen}
        setIsOpen={setIsDialogOpen}
        editingRole={editingRole}
        viewingRole={viewingRole}
        permissionGroups={permissionGroups}
        onSuccess={() => {
          setIsDialogOpen(false);
          router.refresh();
        }}
      />

      <Dialog open={isTemplateOpen} onOpenChange={setIsTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gunakan template role</DialogTitle>
            <DialogDescription>
              Pilih template untuk membuat role dengan permission yang sudah diatur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {TENANT_ROLE_TEMPLATES.map((template) => (
              <button
                key={template.key}
                type="button"
                disabled={templateLoading === template.key}
                onClick={() => handleUseTemplate(template.key)}
                className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted disabled:opacity-60"
              >
                <LayoutTemplate className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="grid gap-1">
                  <span className="text-sm font-medium">{template.name}</span>
                  <span className="text-xs text-muted-foreground">{template.description}</span>
                  <span className="text-xs text-muted-foreground">{template.permissions.length} permission</span>
                </div>
                {templateLoading === template.key ? (
                  <Loader2 className="ml-auto h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
