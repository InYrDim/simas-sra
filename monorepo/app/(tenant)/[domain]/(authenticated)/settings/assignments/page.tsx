import { getAssignmentRolesAction, searchEligibleAccountsAction } from './actions';
import { AssignmentsClient } from './assignments-client';

export const metadata = { title: 'Assignment Role | Settings' };

export default async function AssignmentsPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const [roles, accounts] = await Promise.all([
    getAssignmentRolesAction(domain),
    searchEligibleAccountsAction(domain, {}),
  ]);

  return <AssignmentsClient domain={domain} initialRoles={roles} initialAccounts={accounts} />;
}
