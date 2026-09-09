import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const trackedFiles = execFileSync("git", ["ls-files"], {
  cwd: root,
  encoding: "utf8",
})
  .split(/\r?\n/)
  .filter(Boolean);

const rules = [
  {
    name: "Supabase secret key",
    pattern: /sb_secret_[A-Za-z0-9_-]+/g,
  },
  {
    name: "Bearer token",
    pattern: /Bearer\s+[A-Za-z0-9_-]{24,}/g,
  },
  {
    name: "Easypanel token assignment",
    pattern: /EASYPANEL_TOKEN\s*=\s*["']?[A-Za-z0-9_-]{24,}/g,
  },
  {
    name: "Postgres URL with embedded password",
    pattern: /postgres(?:ql)?:\/\/[^:\s"'<>]+:([^@\s"'<>]+)@/g,
    allowValue: (match) =>
      match === "postgresql://postgres:postgres@" ||
      match === "postgres://postgres:postgres@" ||
      match.includes(":<strong-db-password>@") ||
      match.includes(":${postgresPassword}@"),
  },
  {
    name: "NextAuth secret assignment",
    pattern: /NEXTAUTH_SECRET\s*=\s*["']?([^"'\s\\]{16,})/g,
    allowValue: (match) =>
      match.includes("<strong-nextauth-secret>") ||
      match.includes("present_nonempty") ||
      match.includes("${nextAuthSecret}"),
  },
];

const findings = [];

for (const file of trackedFiles) {
  const content = readFileSync(file, "utf8");

  for (const rule of rules) {
    for (const match of content.matchAll(rule.pattern)) {
      const value = match[0];

      if (rule.allowValue?.(value)) {
        continue;
      }

      const line = content.slice(0, match.index).split(/\r?\n/).length;
      findings.push({
        file: relative(root, file).replaceAll("\\", "/"),
        line,
        rule: rule.name,
      });
    }
  }
}

if (findings.length > 0) {
  console.error("Potential committed secrets found:");

  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.rule}`);
  }

  process.exit(1);
}

console.log("No high-risk committed secrets found.");
