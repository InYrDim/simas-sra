'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Role, createRole, updateRole } from './actions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { tenantMenuItems } from '@/components/tenant-nav-menu/config';
// Type-only import: the catalog module (and the registry underneath) is
// server-only; only the plain permission data travels to the client via props.
import type {
  TenantAssignableRolePermission,
  TenantAssignableRolePermissionGroup,
} from '@/lib/authorization/tenant-role-permission-catalog';

/** Flatten the static nav config into toggleable menu keys with titles. */
function allMenuItems(): { key: string; title: string; parent?: string }[] {
  const items: { key: string; title: string; parent?: string }[] = [];
  for (const item of tenantMenuItems) {
    items.push({ key: item.key, title: item.title });
    for (const child of item.items ?? []) {
      items.push({ key: child.key, title: child.title, parent: item.title });
    }
  }
  return items;
}

interface RoleDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  editingRole: Role | null;
  viewingRole: Role | null;
  permissionGroups: TenantAssignableRolePermissionGroup[];
  onSuccess: () => void;
}

/** Every permission key offered by the dialog. */
function allPermissionKeys(groups: TenantAssignableRolePermissionGroup[]): string[] {
  return groups.flatMap((group) => group.permissions.map((permission) => permission.key));
}

/** Find a permission option by key so dependencies can be auto-selected. */
function findPermission(
  groups: TenantAssignableRolePermissionGroup[],
  key: string,
): TenantAssignableRolePermission | null {
  for (const group of groups) {
    const found = group.permissions.find((permission) => permission.key === key);
    if (found) return found;
  }
  return null;
}

function PermissionGroupFieldset({
  group,
  selected,
  onToggle,
  disabled,
}: {
  group: TenantAssignableRolePermissionGroup;
  selected: (key: string) => boolean;
  onToggle: (key: string, checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <section className="space-y-2 rounded-md border p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {group.label}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {group.permissions.map((permission) => (
          <div
            key={permission.key}
            className="flex items-start space-x-3 rounded-md border p-3"
          >
            <Checkbox
              id={`perm-${permission.key}`}
              checked={selected(permission.key)}
              onCheckedChange={(checked) => onToggle(permission.key, checked as boolean)}
              disabled={disabled}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor={`perm-${permission.key}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {permission.label}
              </label>
              <p className="text-xs text-muted-foreground">{permission.key}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RoleDialog({
  isOpen,
  setIsOpen,
  editingRole,
  viewingRole,
  permissionGroups,
  onSuccess,
}: RoleDialogProps) {
  const params = useParams();
  const domain = params.domain as string;
  const isViewOnly = !!viewingRole;
  const role = viewingRole || editingRole;

  const [name, setName] = React.useState(role?.name ?? '');
  const [description, setDescription] = React.useState(role?.description ?? '');
  const [permissions, setPermissions] = React.useState<string[]>(() => {
    if (!role?.permissions?.length) return [];
    if (role.permissions.includes('*')) return allPermissionKeys(permissionGroups);
    // Keep only keys still offered by the registry so stale selections never
    // fail the create/update validation.
    const known = new Set(allPermissionKeys(permissionGroups));
    return role.permissions.filter((key) => known.has(key));
  });
  // Per-role sidebar visibility. Absent keys default to visible (true).
  const [menuVisibility, setMenuVisibility] = React.useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const item of allMenuItems()) map[item.key] = true;
    if (role?.menuVisibility) {
      for (const [key, visible] of Object.entries(role.menuVisibility)) {
        if (key in map) map[key] = visible !== false;
      }
    }
    return map;
  });
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = {
        name,
        description,
        permissions,
        menuVisibility,
      };

      let res;
      if (editingRole) {
        res = await updateRole(domain, editingRole.id, editingRole.version, data);
      } else {
        res = await createRole(domain, data);
      }

      if (res.success) {
        toast.success(editingRole ? 'Role updated' : 'Role created');
        onSuccess();
      } else {
        toast.error(res.error || 'Something went wrong');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionToggle = (key: string, checked: boolean) => {
    if (checked) {
      // Selecting a permission also selects its dependencies so the selection
      // always keeps its dependency closure (mirrors validatePermissions in
      // tenant-role-lifecycle).
      const option = findPermission(permissionGroups, key);
      setPermissions((prev) => {
        const next = new Set([...prev, key]);
        for (const dependency of option?.dependencies ?? []) next.add(dependency);
        return Array.from(next);
      });
    } else {
      setPermissions((prev) => prev.filter((p) => p !== key));
    }
  };

  const isSelected = (key: string) => permissions.includes(key);

  const title = viewingRole ? 'Inspect Role' : editingRole ? 'Edit Role' : 'Create Role';
  const desc = viewingRole
    ? 'View role details and permissions.'
    : editingRole
      ? 'Modify the details and permissions of this role.'
      : 'Add a new role to your tenant.';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{desc}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Role Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Guidance Counselor"
                disabled={isViewOnly || isLoading}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what users with this role can do..."
                disabled={isViewOnly || isLoading}
              />
            </div>

            <div className="grid gap-2 mt-2">
              <Label>Permissions</Label>
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                {permissionGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assignable permissions available.</p>
                ) : (
                  permissionGroups.map((group) => (
                    <PermissionGroupFieldset
                      key={group.label}
                      group={group}
                      selected={isSelected}
                      onToggle={handlePermissionToggle}
                      disabled={isViewOnly || isLoading}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-2 mt-2">
              <Label>Menu Sidebar</Label>
              <p className="text-xs text-muted-foreground">
                Sembunyikan item menu dari pengguna pemegang role ini. Menu hanya muncul bila
                pengguna punya izin terkait DAN tidak disembunyikan di sini.
              </p>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1 rounded-md border p-3">
                {allMenuItems().map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3">
                    <span className="text-sm">
                      {item.parent ? `${item.parent} › ${item.title}` : item.title}
                    </span>
                    <Checkbox
                      id={`menu-${item.key}`}
                      checked={menuVisibility[item.key] !== false}
                      onCheckedChange={(checked) =>
                        setMenuVisibility((prev) => ({ ...prev, [item.key]: checked as boolean }))
                      }
                      disabled={isViewOnly || isLoading}
                    />
                  </div>
                ))}
              </div>
            </div>

            {viewingRole && viewingRole.status && (
              <div className="grid gap-2 mt-2">
                <Label>Status</Label>
                <div className="text-sm capitalize">{viewingRole.status}</div>
              </div>
            )}
            {viewingRole && (
              <div className="grid gap-2 mt-2">
                <Label>Assigned Users</Label>
                <div className="text-sm">{viewingRole.userCount} users</div>
              </div>
            )}
          </div>

          <DialogFooter>
            {!isViewOnly && (
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
                Cancel
              </Button>
            )}
            <Button
              type={isViewOnly ? 'button' : 'submit'}
              disabled={isLoading}
              onClick={() => isViewOnly && setIsOpen(false)}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isViewOnly ? 'Close' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
