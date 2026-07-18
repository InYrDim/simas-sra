import "dotenv/config";



async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: pnpm provider-admin:provision <email>");
    process.exit(1);
  }

  const { provisionProviderAdminByEmail } = await import("@/lib/provider-admin");
  const result = await provisionProviderAdminByEmail(email);
  console.log(JSON.stringify(result));

  const failed = result.status === "user-not-found" || result.status === "tenant-user";
  process.exit(failed ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error("Provider Admin provisioning failed:", error);
  process.exit(1);
});
