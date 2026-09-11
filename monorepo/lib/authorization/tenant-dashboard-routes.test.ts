import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repositoryRoot = new URL("../..", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, repositoryRoot), "utf8");
}

test("covered pages and actions delegate to their exact operation-map entries", async () => {
  const [dashboard, users, settings, settingsActions, profile, profileActions, historyActions] = await Promise.all([
    source("app/(tenant)/[domain]/(authenticated)/dashboard/page.tsx"),
    source("app/(tenant)/[domain]/(authenticated)/users/page.tsx"),
    source("app/(tenant)/[domain]/(authenticated)/settings/page.tsx"),
    source("app/(tenant)/[domain]/(authenticated)/settings/actions.ts"),
    source("app/(tenant)/[domain]/(authenticated)/master/profil/page.tsx"),
    source("app/(tenant)/[domain]/(authenticated)/master/profil/actions.ts"),
    source("app/(tenant)/[domain]/(authenticated)/master/profil/history-actions.ts"),
  ]);

  assert.match(dashboard, /operationId: "tenant\.dashboard\.load"/);
  assert.match(users, /operationId: "tenant\.users\.load"/);
  assert.match(users, /tenant\.users\.view-contact/);
  assert.match(users, /tenant\.users\.view-sensitive/);
  assert.match(settings, /operationId: "tenant-settings\.landing-page\.load"/);
  assert.match(settingsActions, /operationId: "tenant-settings\.landing-page\.update"/);
  assert.match(profile, /operationId: "school-profile\.load"/);
  assert.match(profileActions, /"school-profile\.update"/);
  assert.match(profileActions, /"school-profile\.headmaster\.assign"/);
  assert.match(historyActions, /"school-profile\.logo\.upload"/);
  assert.match(historyActions, /"school-profile\.accreditations\.create"/);
  assert.match(historyActions, /"school-profile\.accreditations\.correct"/);
});

test("covered settings and integration placeholders do not reuse Master Data authority", async () => {
  const paths = [
    "app/(tenant)/[domain]/(authenticated)/settings/page.tsx",
    "app/(tenant)/[domain]/(authenticated)/settings/actions.ts",
    "app/(tenant)/[domain]/(authenticated)/settings/backup-restore/page.tsx",
    "app/(tenant)/[domain]/(authenticated)/integrasi/page.tsx",
    "app/(tenant)/[domain]/(authenticated)/integrasi/whatsapp/page.tsx",
  ];
  for (const path of paths) {
    assert.doesNotMatch(await source(path), /enforceMasterDataAccess/, path);
  }
});

test("Tenant-qualified directory construction happens before rows are returned", async () => {
  const directoryData = await source("lib/authorization/tenant-user-directory-data.ts");
  assert.match(directoryData, /eq\(user\.tenantId, tenantId\)/);
  assert.match(directoryData, /\.select\(\{/);
  assert.match(directoryData, /access\.contact/);
  assert.match(directoryData, /access\.sensitive/);
});
