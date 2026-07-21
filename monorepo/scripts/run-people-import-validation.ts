import { hostname } from "node:os";
import { createPeopleImportService } from "@/lib/people-import";
import { closePeopleImportPool, peopleImportStore } from "@/lib/people-import-data";
import { createProtectedFileStorage } from "@/lib/protected-file-storage";
const root = process.env.PROTECTED_FILE_STORAGE_ROOT; if (!root) throw new Error("PROTECTED_FILE_STORAGE_ROOT is required");
const service = createPeopleImportService({ store: peopleImportStore, storage: createProtectedFileStorage(root) });
try { process.exitCode = await service.runNext(`${hostname()}:${process.pid}`) ? 0 : 2; } finally { await closePeopleImportPool(); }
