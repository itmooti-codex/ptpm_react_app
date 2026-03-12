import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const BASELINE_PATH = path.join(ROOT, "scripts", "max-lines-baseline.json");
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);

function toPosixPath(inputPath) {
  return inputPath.split(path.sep).join("/");
}

function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.has(path.extname(filePath));
}

function countLines(sourceCode) {
  if (!sourceCode) return 0;
  let count = 0;
  for (let index = 0; index < sourceCode.length; index += 1) {
    if (sourceCode.charCodeAt(index) === 10) count += 1;
  }
  return count;
}

async function walkFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const nextPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkFiles(nextPath)));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!isSourceFile(nextPath)) continue;
    files.push(nextPath);
  }

  return files;
}

async function readBaseline() {
  const raw = await fs.readFile(BASELINE_PATH, "utf8");
  const parsed = JSON.parse(raw);
  return {
    limit: Number(parsed?.limit) || 500,
    files: parsed?.files && typeof parsed.files === "object" ? parsed.files : {},
  };
}

async function main() {
  const { limit, files: baselineFiles } = await readBaseline();
  const sourceFiles = await walkFiles(SRC_DIR);
  const sourceFileSet = new Set(sourceFiles.map((filePath) => toPosixPath(path.relative(ROOT, filePath))));
  const violations = [];
  const resolvedBaselineFiles = new Set();

  for (const absFilePath of sourceFiles) {
    const relativePath = toPosixPath(path.relative(ROOT, absFilePath));
    const sourceCode = await fs.readFile(absFilePath, "utf8");
    const lineCount = countLines(sourceCode);
    const baselineCount = baselineFiles[relativePath];

    if (baselineCount != null) {
      resolvedBaselineFiles.add(relativePath);
    }

    if (lineCount > limit) {
      if (baselineCount == null) {
        violations.push(
          `${relativePath} is ${lineCount} lines, above the ${limit}-line limit, and is not allowed by the baseline.`
        );
        continue;
      }

      if (lineCount > baselineCount) {
        violations.push(
          `${relativePath} grew from ${baselineCount} lines to ${lineCount} lines. Oversized baseline files may not grow.`
        );
      }

      continue;
    }

    if (baselineCount != null) {
      violations.push(
        `${relativePath} is now ${lineCount} lines, which is within the ${limit}-line limit. Remove it from scripts/max-lines-baseline.json.`
      );
    }
  }

  for (const [baselinePath] of Object.entries(baselineFiles)) {
    if (resolvedBaselineFiles.has(baselinePath)) continue;
    if (sourceFileSet.has(baselinePath)) continue;
    violations.push(
      `${baselinePath} is listed in scripts/max-lines-baseline.json but no longer exists. Remove it from the baseline.`
    );
  }

  if (violations.length) {
    console.error(`Max-lines check failed with ${violations.length} violation(s):`);
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Max-lines check passed. Limit: ${limit}. Baseline exceptions: ${Object.keys(baselineFiles).length}.`
  );
}

main().catch((error) => {
  console.error("[max-lines] Unexpected failure", error);
  process.exitCode = 1;
});
