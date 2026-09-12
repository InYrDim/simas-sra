import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";

export type PublicRegistrationStore = {
  createIdentity(values: { userId: string; accountId: string; name: string; email: string; passwordHash: string }): Promise<void>;
};

export function createPublicRegistration(dependencies: {
  store: PublicRegistrationStore;
  createId?: () => string;
  hash?: (password: string) => Promise<string>;
}) {
  return async (input: { name: unknown; email: unknown; password: unknown }) => {
    const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input.password === "string" ? input.password : "";
    if (!name || name.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255 || password.length < 8) {
      return { ok: false, code: "invalid-input" } as const;
    }
    const nextId = dependencies.createId ?? randomUUID;
    await dependencies.store.createIdentity({ userId: nextId(), accountId: nextId(), name, email, passwordHash: await (dependencies.hash ?? hashPassword)(password) });
    return { ok: true } as const;
  };
}
