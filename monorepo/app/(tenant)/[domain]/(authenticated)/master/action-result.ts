import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export function finishMasterDataAction(
  domain: string,
  section: "guru" | "siswa" | "staf",
  resultCode: string,
  selectedId?: string,
): never {
  const path = `/${domain}/master/${section}`;
  const query = new URLSearchParams({ result: resultCode });

  if (selectedId) query.set("selected", selectedId);

  revalidatePath(path);
  redirect(`${path}?${query}`);
}

export async function captureActionError<Result>(operation: Promise<Result>): Promise<Result | null> {
  return operation.catch(() => null);
}
