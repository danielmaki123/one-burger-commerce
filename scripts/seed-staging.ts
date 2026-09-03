import { runStagingSeed } from "./staging-seed-core";

async function main() {
  const result = await runStagingSeed({
    dryRun: process.env.STAGING_SEED_DRY_RUN === "true",
    source: "cli",
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
