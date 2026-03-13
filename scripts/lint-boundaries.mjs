import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const FILE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);

const MODULES_ROOT = "src/modules/";
const FEATURE_ROOT = "src/features/";


function toPosixPath(inputPath) {
  return inputPath.split(path.sep).join("/");
}

function isSourceFile(filePath) {
  return FILE_EXTENSIONS.has(path.extname(filePath));
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

function collectImportSpecifiers(sourceCode) {
  const imports = [];
  const staticImportPattern = /\bimport\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g;
  const dynamicImportPattern = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

  for (const pattern of [staticImportPattern, dynamicImportPattern]) {
    let match;
    while ((match = pattern.exec(sourceCode)) !== null) {
      const fullMatch = match[0];
      const specifier = match[1];
      const indexInSource = match.index + fullMatch.indexOf(specifier);
      imports.push({ specifier, index: indexInSource });
    }
  }

  return imports;
}

function toLineNumber(sourceCode, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (sourceCode.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function getFeatureName(filePosixPath) {
  const match = filePosixPath.match(/^src\/features\/([^/]+)\//);
  return match ? match[1] : null;
}

function resolveRelativeImport(absFilePath, specifier) {
  const resolved = path.resolve(path.dirname(absFilePath), specifier);
  const relativeToRoot = path.relative(ROOT, resolved);
  return toPosixPath(relativeToRoot);
}

function getModuleName(filePosixPath) {
  const match = filePosixPath.match(/^src\/modules\/([^/]+)\//);
  return match ? match[1] : null;
}

function getAllowedModuleImports(moduleName) {
  if (!moduleName) return new Set();
  return new Set([
    `@modules/${moduleName}`,
    `@modules/${moduleName}/index.js`,
    `@modules/${moduleName}/public/index.js`,
    `@modules/${moduleName}/public/components.js`,
    `@modules/${moduleName}/public/hooks.js`,
    `@modules/${moduleName}/public/constants.js`,
    `@modules/${moduleName}/public/sdk.js`,
    `@modules/${moduleName}/exports/index.js`,
    `@modules/${moduleName}/exports/components.js`,
    `@modules/${moduleName}/exports/hooks.js`,
    `@modules/${moduleName}/exports/constants.js`,
    `@modules/${moduleName}/exports/api.js`,
    `@modules/${moduleName}/exports/sdk.js`,
  ]);
}

function validateImportsForFile(absFilePath, sourceCode) {
  const violations = [];
  const filePosixPath = toPosixPath(path.relative(ROOT, absFilePath));
  const featureName = getFeatureName(filePosixPath);
  const moduleName = getModuleName(filePosixPath);
  const isModuleFile = Boolean(moduleName);

  for (const { specifier, index } of collectImportSpecifiers(sourceCode)) {
    const line = toLineNumber(sourceCode, index);

    if (!isModuleFile && specifier.startsWith("@modules/")) {
      const importMatch = specifier.match(/^@modules\/([^/]+)/);
      const targetModuleName = importMatch ? importMatch[1] : "";
      const allowedImports = getAllowedModuleImports(targetModuleName);
      if (!allowedImports.has(specifier)) {
        violations.push({
          file: filePosixPath,
          line,
          specifier,
          message:
            `Use only ${targetModuleName || "module"} public entrypoints outside modules (exports/*.js or index.js).`,
        });
      }
    }

    if (isModuleFile && specifier.startsWith("@features/")) {
      violations.push({
        file: filePosixPath,
        line,
        specifier,
        message: "Module files under src/modules cannot import from @features.",
      });
    }

    if (isModuleFile && specifier.startsWith("@modules/")) {
      const importMatch = specifier.match(/^@modules\/([^/]+)/);
      const targetModuleName = importMatch ? importMatch[1] : "";
      if (targetModuleName && targetModuleName !== moduleName) {
        const allowedImports = getAllowedModuleImports(targetModuleName);
        if (!allowedImports.has(specifier)) {
          violations.push({
            file: filePosixPath,
            line,
            specifier,
            message:
              `Cross-module imports must use target module exports entrypoints (module: ${targetModuleName}).`,
          });
        }
      }
    }

    if (specifier.startsWith(".")) {
      const resolvedPosixPath = resolveRelativeImport(absFilePath, specifier);

      if (isModuleFile && resolvedPosixPath.startsWith(FEATURE_ROOT)) {
        violations.push({
          file: filePosixPath,
          line,
          specifier,
          message: "Module files under src/modules cannot import from src/features via relative paths.",
        });
      }

      if (isModuleFile && resolvedPosixPath.startsWith(MODULES_ROOT)) {
        const targetModuleName = getModuleName(resolvedPosixPath);
        if (targetModuleName && targetModuleName !== moduleName) {
          violations.push({
            file: filePosixPath,
            line,
            specifier,
            message:
              `Cross-module relative imports are not allowed (use @modules/${targetModuleName}/exports/*).`,
          });
        }
      }

      if (featureName) {
        const targetFeatureMatch = resolvedPosixPath.match(/^src\/features\/([^/]+)\//);
        const targetFeatureName = targetFeatureMatch ? targetFeatureMatch[1] : null;

        if (targetFeatureName && targetFeatureName !== featureName) {
          violations.push({
            file: filePosixPath,
            line,
            specifier,
            message:
              "Cross-feature imports are not allowed (move shared logic to modules/shared).",
          });
        }
      }
    }

    if (featureName && specifier.startsWith("@features/")) {
      const targetFeatureName = specifier.split("/")[1] || "";
      if (targetFeatureName && targetFeatureName !== featureName) {
        violations.push({
          file: filePosixPath,
          line,
          specifier,
          message:
            "Cross-feature @features imports are not allowed (move shared logic to modules/shared).",
        });
      }
    }
  }

  return violations;
}

async function main() {
  const files = await walkFiles(SRC_DIR);
  const violations = [];

  for (const absFilePath of files) {
    const sourceCode = await fs.readFile(absFilePath, "utf8");
    violations.push(...validateImportsForFile(absFilePath, sourceCode));
  }

  if (!violations.length) {
    console.log("Boundary lint passed.");
    return;
  }

  console.error(`Boundary lint failed with ${violations.length} violation(s):`);
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line}`);
    console.error(`  ${violation.message}`);
    console.error(`  import \"${violation.specifier}\"`);
  }
  process.exit(1);
}

main().catch((error) => {
  console.error("Boundary lint failed unexpectedly:", error);
  process.exit(1);
});
