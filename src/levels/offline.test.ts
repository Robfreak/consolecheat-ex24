import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { bannedHosts, findBuildProblems, findRemoteProblems } from "../../scripts/check-dist.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const allowedUrls = [
  "https://consolecheat.com",
  "https://docs.github.com/",
  "https://robfreak.github.io/consolecheat-ex1/",
  "https://robfreak.github.io/consolecheat-ex2/",
  "https://robfreak.github.io/consolecheat-ex3/",
  "https://robfreak.github.io/consolecheat-ex4/",
  "https://robfreak.github.io/consolecheat-ex5/",
  "https://robfreak.github.io/consolecheat-ex6/",
  "https://robfreak.github.io/consolecheat-ex7/",
  "https://robfreak.github.io/consolecheat-ex8/",
  "https://robfreak.github.io/consolecheat-ex9/",
  "https://robfreak.github.io/consolecheat-ex10/",
  "https://robfreak.github.io/consolecheat-ex11/",
  "https://robfreak.github.io/consolecheat-ex12/",
  "https://robfreak.github.io/consolecheat-ex13/",
  "https://robfreak.github.io/consolecheat-ex14/",
  "https://robfreak.github.io/consolecheat-ex15/",
  "https://robfreak.github.io/consolecheat-ex16/",
  "https://robfreak.github.io/consolecheat-ex17/",
  "https://robfreak.github.io/consolecheat-ex18/",
  "https://robfreak.github.io/consolecheat-ex19/",
  "https://robfreak.github.io/consolecheat-ex20/",
  "https://robfreak.github.io/consolecheat-ex21/",
  "https://robfreak.github.io/consolecheat-ex22/",
  "https://robfreak.github.io/consolecheat-ex23/",
  "https://robfreak.github.io/consolecheat-ex24/",
];

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

test("level editor sources name no third party and import nothing outside src/levels", () => {
  const files = walk(here).filter((path) => /\.(ts|tsx|css)$/.test(path) && !path.endsWith(".test.ts"));
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  assert.match(html, /src="\/src\/levels\/main\.tsx"/);
  assert.match(html, /consolecheat-theme/);
  assert.doesNotMatch(html, /webmail/i);
  assert.match(readme, /consolecheat-ex24/);
  assert.doesNotMatch(readme, /move to own repo later|temporary home|consolecheat-ex6\/[a-z]/i);
  assert.match(readme, /src\/levels/);
  assert.match(readme, /consolecheat-levels-v1/);
  assert.match(readme, /consolecheat-sprite-v1/);

  const urlRe = /https?:\/\/[^\s"'`)<>]+/g;
  for (const path of files) {
    const text = readFileSync(path, "utf8");
    const outside = text.match(/from ["']\.\.\/[^"']+["']/g) ?? [];
    assert.deepEqual(outside, [], path);
    for (const host of bannedHosts) assert.equal(text.includes(host), false, `${host} in ${path}`);
    for (const match of text.match(urlRe) ?? []) {
      const url = match.replace(/[.,;]+$/, "");
      assert.ok(allowedUrls.some((prefix) => url.startsWith(prefix)), `${url} in ${path}`);
    }
  }
  for (const host of bannedHosts) assert.equal(html.includes(host), false, host);
});

test("the dist checker rejects third-party hosts and checks the build output", () => {
  const dir = mkdtempSync(join(tmpdir(), "levels-dist-"));
  try {
    writeFileSync(join(dir, "app.js"), 'const x = "https://fonts.googleapis.com/css";');
    const flagged = findRemoteProblems(dir);
    assert.ok(flagged.some((problem: string) => problem.includes("fonts.googleapis.com")));

    writeFileSync(join(dir, "index.html"), "<!doctype html>");
    const missing = findBuildProblems(dir);
    assert.ok(missing.problems.some((problem: string) => problem.includes("woff2")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const dist = fileURLToPath(new URL("../../dist/", import.meta.url));
  let exists = false;
  try {
    exists = statSync(dist).isDirectory();
  } catch {
    exists = false;
  }
  if (!exists) return;
  const { problems } = findBuildProblems(dist);
  assert.deepEqual(problems, [], problems.join("\n"));
  const pages = walk(dist)
    .filter((path) => extname(path) === ".html")
    .map((path) => path.slice(dist.length).split(/[/\\]/).join("/"));
  assert.ok(pages.includes("index.html"), pages.join(", "));
});
