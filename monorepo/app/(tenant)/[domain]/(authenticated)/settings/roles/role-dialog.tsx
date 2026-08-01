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

interface RoleDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  editingRole: Role | null;
  viewingRole: Role | null;
  onSuccess: () => void;
}

const AVAILABLE_PERMISSIONS = [
  { id: 'public.read', label: 'Read Public Data' },
  { id: 'class.read', label: 'Read Classes' },
  { id: 'class.write', label: 'Manage Classes' },
  { id: 'grade.read', label: 'Read Grades' },
  { id: 'grade.write', label: 'Manage Grades' },
];

export function RoleDialog({
  isOpen,
  setIsOpen,
  editingRole,
  viewingRole,
  onSuccess,
}: RoleDialogProps) {
  const params = useParams();
  const domain = params.domain as string;
  const isViewOnly = !!viewingRole;
  const role = viewingRole || editingRole;
  
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [permissions, setPermissions] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (role) {
        setName(role.name);
        setDescription(role.description);
        setPermissions(role.permissions.includes('*') ? AVAILABLE_PERMISSIONS.map(p => p.id) : role.permissions);
      } else {
        setName('');
        setDescription('');
        setPermissions([]);
      }
    }
  }, [isOpen, role]);

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
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionToggle = (id: string, checked: boolean) => {
    if (checked) {
      setPermissions((prev) => [...prev, id]);
    } else {
      setPermissions((prev) => prev.filter((p) => p !== id));
    }
  };

  const title = viewingRole ? 'Inspect Role' : editingRole ? 'Edit Role' : 'Create Role';
  const desc = viewingRole
    ? 'View role details and permissions.'
    : editingRole
    ? 'Modify the details and permissions of this role.'
    : 'Add a new role to your tenant.';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[500px]">
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
              <div className="border rounded-md p-4 space-y-3 max-h-[200px] overflow-y-auto">
                {AVAILABLE_PERMISSIONS.map((permission) => (
                  <div key={permission.id} className="flex items-start space-x-3">
                    <Checkbox
                      id={`perm-${permission.id}`}
                      checked={permissions.includes(permission.id)}
                      onCheckedChange={(checked) => handlePermissionToggle(permission.id, checked as boolean)}
                      disabled={isViewOnly || isLoading}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor={`perm-${permission.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {permission.label}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {permission.id}
                      </p>
                    </div>
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
            <Button type={isViewOnly ? "button" : "submit"} disabled={isLoading} onClick={() => isViewOnly && setIsOpen(false)}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isViewOnly ? 'Close' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
