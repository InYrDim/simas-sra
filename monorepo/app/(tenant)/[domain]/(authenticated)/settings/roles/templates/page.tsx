import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createHttpTenantAuthorizationEvaluator } from '@/lib/authorization/tenant-authorization-data';
import { enforceAuthorizedTenantOperation } from '@/lib/authorization/tenant-operation-route-access';
import { TENANT_ROLE_TEMPLATES, getTemplateAccessiblePages } from '@/lib/authorization/tenant-role-templates';

export const metadata = {
    title: 'Template Role | Settings',
};

export default async function RoleTemplatesPage(props: { params: Promise<{ domain: string }> }) {
    const { domain } = await props.params;
    const evaluator = await createHttpTenantAuthorizationEvaluator();
    const result = await evaluator.evaluate({ surface: 'page', domain, operationId: 'tenant.roles.list' });
    enforceAuthorizedTenantOperation(result, { domain, operationId: 'tenant.roles.list' });

    return (
        <div className="flex flex-col gap-6 p-6 w-full max-w-6xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Template Role</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Halaman yang bisa diakses oleh masing-masing template role.
                    </p>
                </div>
                <Button variant="outline" nativeButton={false} render={<Link href={`/${domain}/settings/roles`} />}>
                    Kembali ke Roles
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {TENANT_ROLE_TEMPLATES.map((template) => {
                    const pages = getTemplateAccessiblePages(template);
                    return (
                        <Card key={template.key}>
                            <CardHeader>
                                <CardTitle>{template.name}</CardTitle>
                                <CardDescription>{template.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    {template.permissions.length} permission · {pages.length} halaman
                                </p>
                                <ul className="space-y-2">
                                    {pages.map((page) => (
                                        <li key={page.title} className="text-sm">
                                            <span className="font-medium">{page.title}</span>
                                            {page.children.length > 0 && (
                                                <span className="text-muted-foreground">: {page.children.join(', ')}</span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
