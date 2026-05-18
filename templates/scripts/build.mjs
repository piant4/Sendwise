import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import mjml2html from "mjml";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.resolve(currentDir, "..");
const mjmlDir = path.join(templatesDir, "mjml");
const distDir = path.join(templatesDir, "dist");

await mkdir(distDir, { recursive: true });

const templateFiles = (await readdir(mjmlDir))
  .filter((fileName) => fileName.endsWith(".mjml"))
  .sort();

if (templateFiles.length === 0) {
  throw new Error("No MJML templates found in templates/mjml.");
}

for (const fileName of templateFiles) {
  const sourcePath = path.join(mjmlDir, fileName);
  const templateSource = await readFile(sourcePath, "utf8");
  const { html, errors } = mjml2html(templateSource, {
    filePath: mjmlDir,
    validationLevel: "strict",
    minify: false,
    keepComments: false,
    beautify: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => `${fileName}: ${error.formattedMessage}`)
      .join("\n");
    throw new Error(`MJML build failed.\n${details}`);
  }

  const outputPath = path.join(distDir, fileName.replace(/\.mjml$/, ".html"));
  await writeFile(outputPath, html, "utf8");
  console.log(`Built ${path.relative(templatesDir, outputPath)}`);
}
