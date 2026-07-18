import "dotenv/config";



async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: pnpm provider-admin:deprovision <email>");
    process.exit(1);
  }

  const { deprovisionProviderAdminByEmail } = await import("@/lib/provider-admin");
  const result = await deprovisionProviderAdminByEmail(email);
  console.log(JSON.stringify(result));
  process.exit(result.status === "user-not-found" ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error("Provider Admin deprovisioning failed:", error);
  process.exit(1);
});
