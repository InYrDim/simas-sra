'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Role, changeRoleStatus } from './actions';
import { Button } from '@/components/ui/button';
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
import { MoreHorizontal, Plus, Eye, Pencil, Archive, Play, Loader2 } from 'lucide-react';
import type { TenantAssignableRolePermissionGroup } from '@/lib/authorization/tenant-role-permission-catalog';
import { RoleDialog } from './role-dialog';
import { toast } from 'sonner';

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
      <div className="flex justify-end">
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
                      <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" disabled={isLoading === role.id} />}>
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
    </div>
  );
}
