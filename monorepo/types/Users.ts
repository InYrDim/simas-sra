import { user } from "@/auth-schema";
import { InferSelectModel } from "drizzle-orm";

export type User = InferSelectModel<typeof user>;
