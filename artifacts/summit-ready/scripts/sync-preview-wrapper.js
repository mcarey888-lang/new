import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDirectory, "../../..");
const previewFile = resolve(
  scriptDirectory,
  "../../summit-landing/public/mobile-preview.html",
);

const resolvedEntry = require.resolve("expo-router/entry");
const workspaceEntry = relative(workspaceRoot, resolvedEntry);

if (workspaceEntry.startsWith("..")) {
  throw new Error("Expo Router entry resolved outside the workspace.");
}

const bundlePath = `/${workspaceEntry
  .replaceAll("\\", "/")
  .replace(/\.js$/, "")}.bundle`;
const bundleQuery = new URLSearchParams({
  platform: "web",
  dev: "true",
  hot: "false",
  lazy: "false",
  "transform.engine": "hermes",
  "transform.routerRoot": "app",
  "transform.reactCompiler": "true",
  unstable_transformProfile: "hermes-stable",
});

const previewHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <title>SummitReady</title>
    <style id="expo-reset">
      html, body { height: 100%; }
      body { overflow: hidden; }
      #root { display: flex; height: 100%; flex: 1; }
    </style>
    <script>
      history.replaceState({}, '', '/' + window.location.search);
    </script>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script src="${bundlePath}?${bundleQuery}" defer></script>
  </body>
</html>
`;

await writeFile(previewFile, previewHtml);
console.log(`Updated Expo web preview wrapper: ${bundlePath}`);