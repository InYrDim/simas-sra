import { getRoles } from './actions';
import { RolesClient } from './roles-client';

export const metadata = {
  title: 'Roles | Settings',
};

export default async function RolesPage(props: { params: Promise<{ domain: string }> }) {
  const { domain } = await props.params;
  const roles = await getRoles(domain);

  return (
    <div className="flex flex-col gap-6 p-6 w-full max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage roles and their permissions for your school.
          </p>
        </div>
      </div>
      
      <RolesClient initialRoles={roles} />
    </div>
  );
}
