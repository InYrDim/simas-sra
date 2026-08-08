export const metadata = {
  title: 'Permission Explorer | Settings',
};

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PermissionExplorerClient } from './permissions-client';

import {
  permissionRegistry,
  validatePermissionRegistry,
  validateTenantRbacContract,
} from '@/lib/authorization/tenant-rbac-contract';
import { createHttpTenantAuthorizationEvaluator } from '@/lib/authorization/tenant-authorization-data';
import { enforceAuthorizedTenantOperation } from '@/lib/authorization/tenant-operation-route-access';

function getPermissionRegistry() {
  const registryIssues = validatePermissionRegistry();
  const contractIssues = validateTenantRbacContract();
  if (registryIssues.length > 0 || contractIssues.length > 0) {
    throw new Error('Permission registry contract is invalid');
  }

  const modules = Array.from(new Set(permissionRegistry.map((permission) => permission.module))).sort((left, right) =>
    left.localeCompare(right),
  );

  return {
    modules,
    registry: permissionRegistry.map((permission) => ({
      key: permission.key,
      module: permission.module,
      resource: permission.resource,
      action: permission.action,
      classification: permission.assignment,
      assignable: permission.assignment === 'tenant-assignable',
      lifecycle: permission.lifecycle,
      dependencies: [...permission.dependencies],
    })),
  };
}

export default async function PermissionExplorerPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const result = await evaluator.evaluate({ surface: 'page', domain, operationId: 'tenant.permissions.view' });
  enforceAuthorizedTenantOperation(result, { domain, operationId: 'tenant.permissions.view' });

  const registry = getPermissionRegistry();

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Permission Explorer</h1>
        <p className="mt-2 text-muted-foreground">
          Jelajahi daftar permission registry yang tersedia di sistem tenant. Halaman ini bersifat baca-saja.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registry Permission</CardTitle>
          <CardDescription>
            Gunakan pencarian dan filter untuk melihat module, key, classification, dan status assignable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PermissionExplorerClient
            initialRegistry={{
              registry: registry.registry,
              modules: registry.modules,
              filters: { query: '', module: '', assignable: 'all' },
            }}
            modules={registry.modules}
          />
        </CardContent>
      </Card>
    </main>
  );
}
