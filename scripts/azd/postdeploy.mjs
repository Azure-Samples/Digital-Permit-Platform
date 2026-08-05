import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const azExecutable = process.platform === "win32" ? "az.cmd" : "az";
const azdExecutable = process.platform === "win32" ? "azd.exe" : "azd";

function run(executable, args) {
  const result = spawnSync(executable, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw new Error(`Unable to run ${executable}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const detail = result.stderr.trim().split("\n").at(-1) || "command failed";
    throw new Error(`${executable} ${args[0]} failed: ${detail}`);
  }

  return result.stdout.trim();
}

function getEnvironmentValue(name) {
  if (process.env[name]) {
    return process.env[name];
  }

  return run(azdExecutable, ["env", "get-value", name, "--no-prompt"]);
}

const resourceGroupName = getEnvironmentValue("AZURE_RESOURCE_GROUP");
const jobName = getEnvironmentValue("MIGRATIONS_JOB_NAME");
const seedDemoData = (
  getEnvironmentValue("SEED_DEMO_DATA") || "true"
).toLowerCase();

if (!new Set(["true", "false"]).has(seedDemoData)) {
  throw new Error("SEED_DEMO_DATA must be either true or false.");
}

console.log(
  `Starting migrations job ${jobName}; synthetic demo seeding is ${seedDemoData}.`,
);

const executionName = run(azExecutable, [
  "containerapp",
  "job",
  "start",
  "--name",
  jobName,
  "--resource-group",
  resourceGroupName,
  "--container-name",
  "migrations",
  "--env-vars",
  `SEED_DEMO_DATA=${seedDemoData}`,
  "--query",
  "name",
  "--output",
  "tsv",
  "--only-show-errors",
]);

if (!executionName) {
  throw new Error("The migrations job did not return an execution name.");
}

const deadline = Date.now() + 30 * 60 * 1000;
let previousStatus = "";

while (Date.now() < deadline) {
  const executionStatus = run(azExecutable, [
    "containerapp",
    "job",
    "execution",
    "show",
    "--name",
    jobName,
    "--resource-group",
    resourceGroupName,
    "--job-execution-name",
    executionName,
    "--query",
    "properties.status",
    "--output",
    "tsv",
    "--only-show-errors",
  ]);

  if (executionStatus !== previousStatus) {
    console.log(`Migrations job status: ${executionStatus || "Pending"}`);
    previousStatus = executionStatus;
  }

  if (executionStatus === "Succeeded") {
    console.log("Database migrations job completed successfully.");
    process.exit(0);
  }

  if (["Failed", "Stopped", "Degraded"].includes(executionStatus)) {
    throw new Error(`Database migrations job ended with status ${executionStatus}.`);
  }

  await delay(10_000);
}

throw new Error("Timed out waiting for the database migrations job to finish.");