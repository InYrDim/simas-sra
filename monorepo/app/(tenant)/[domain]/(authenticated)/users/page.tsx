import { getLifecycleWorkspaceAction } from './actions';
import { LifecycleWorkspace } from './lifecycle-workspace';

export default async function UsersPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const data = await getLifecycleWorkspaceAction(domain);
  return <LifecycleWorkspace domain={domain} initialData={data} />;
}
