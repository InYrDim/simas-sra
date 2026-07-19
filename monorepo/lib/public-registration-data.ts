import { db } from "@/db";
import { account, applicant, user } from "@/db/schema";
import type { PublicRegistrationStore } from "@/lib/public-registration";

export const publicRegistrationStore: PublicRegistrationStore = {
  createIdentity(values) {
    return db.transaction(async (tx) => {
      await tx.insert(user).values({ id: values.userId, name: values.name, email: values.email, emailVerified: false, tenantId: null, tenantRole: null });
      await tx.insert(account).values({ id: values.accountId, accountId: values.userId, providerId: "credential", userId: values.userId, password: values.passwordHash });
      await tx.insert(applicant).values({ userId: values.userId });
    });
  },
};
