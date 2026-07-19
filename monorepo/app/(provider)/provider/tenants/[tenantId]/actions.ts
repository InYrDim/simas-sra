"use server";

import { requireProviderActionAccess } from "@/lib/provider-access";
import {
  createResetTemporaryCredentialCommand,
  TemporaryCredentialResetDeniedError,
} from "@/lib/temporary-credential-activation";
import { temporaryCredentialActivationStore } from "@/lib/temporary-credential-activation-data";

export type ResetCredentialState =
  | { status: "idle" }
  | { status: "reset"; temporaryCredential: string }
  | { status: "recovery-required" }
  | { status: "error" };

export async function resetTemporaryCredentialAction(
  userId: string,
  previousState: ResetCredentialState,
): Promise<ResetCredentialState> {
  void previousState;
  const reset = createResetTemporaryCredentialCommand({
    authorize: requireProviderActionAccess,
    store: temporaryCredentialActivationStore,
  });
  try {
    const result = await reset(userId);
    return { status: "reset", temporaryCredential: result.temporaryCredential };
  } catch (error) {
    if (error instanceof TemporaryCredentialResetDeniedError) {
      return { status: "recovery-required" };
    }
    return { status: "error" };
  }
}
