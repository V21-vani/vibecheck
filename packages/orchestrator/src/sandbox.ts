import { execa, type ResultPromise } from "execa";
import { nanoid } from "nanoid";
import getPort from "get-port";
import fg from "fast-glob";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import kill from "tree-kill";
import type { Logger } from "./logger.js";

export interface SandboxHandle {
  dir: string;
  port: number;
  baseUrl: string;
  framework: string;
  devServer: ResultPromise;
  cleanup: () => Promise<void>;
}

const FRAMEWORK_SIGNATURES: { file: string; framework: string; devCmd: string[]; readyRegex: RegExp }[] = [
  { file: "next.config.js", framework: "Next.js", devCmd: ["npm", "run", "dev"], readyRegex: /ready|started server/i },
  { file: "next.config.mjs", framework: "Next.js", devCmd: ["npm", "run", "dev"], readyRegex: /ready|started server/i },
  { file: "next.config.ts", framework: "Next.js", devCmd: ["npm", "run", "dev"], readyRegex: /ready|started server/i },
  { file: "vite.config.ts", framework: "Vite", devCmd: ["npm", "run", "dev"], readyRegex: /local:\s*http/i },
  { file: "vite.config.js", framework: "Vite", devCmd: ["npm", "run", "dev"], readyRegex: /local:\s*http/i },
  { file: "angular.json", framework: "Angular", devCmd: ["npm", "run", "start"], readyRegex: /compiled successfully/i },
  { file: "manage.py", framework: "Django", devCmd: ["python3", "manage.py", "runserver"], readyRegex: /starting development server/i },
  { file: "main.py", framework: "FastAPI", devCmd: ["uvicorn", "main:app", "--reload"], readyRegex: /application startup complete/i },
];

/**
 * Isolation strategy: each scan gets a throwaway temp directory and a
 * dedicated child process group (killed as a whole tree on cleanup).
 * When Docker is available, `docker.ts` wraps this same interface inside
 * a container instead — see docker/sandbox.Dockerfile.
 */
export async function provisionSandbox(repoUrl: string, branch: string | undefined, log: Logger): Promise<SandboxHandle> {
  const workDir = path.join(os.tmpdir(), `vibecheck-${nanoid(8)}`);
  await fs.mkdir(workDir, { recursive: true });

  log.info(`Provisioning ephemeral sandbox at ${workDir}`);
  const cloneArgs = ["clone", "--depth", "1"];
  if (branch) cloneArgs.push("--branch", branch);
  cloneArgs.push(repoUrl, workDir);
  await execa("git", cloneArgs, { stdio: "pipe" });
  log.success("Repository cloned");

  const framework = await detectFramework(workDir);
  log.info(`Detected framework: ${framework.framework}`);

  const hasPackageJson = await fileExists(path.join(workDir, "package.json"));
  if (hasPackageJson) {
    log.info("Installing dependencies (npm ci)...");
    const installStart = Date.now();
    try {
      await execa("npm", ["ci"], { cwd: workDir, stdio: "pipe" });
    } catch {
      await execa("npm", ["install"], { cwd: workDir, stdio: "pipe" });
    }
    log.success(`npm install done (${((Date.now() - installStart) / 1000).toFixed(1)}s)`);
  }

  const port = await getPort();
  const env = { ...process.env, PORT: String(port), BROWSER: "none", CI: "true" };

  log.info(`Starting dev server on :${port}`);
  const devServer = execa(framework.devCmd[0], framework.devCmd.slice(1), {
    cwd: workDir,
    env,
    stdio: "pipe",
    reject: false,
  });

  await waitForReady(devServer, framework.readyRegex, port, 60_000);
  log.success(`Dev server ready at http://localhost:${port}`);

  const baseUrl = `http://localhost:${port}`;

  const cleanup = async () => {
    if (devServer.pid) await new Promise<void>((resolve) => kill(devServer.pid!, "SIGKILL", () => resolve()));
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  };

  return { dir: workDir, port, baseUrl, framework: framework.framework, devServer, cleanup };
}

async function detectFramework(dir: string) {
  for (const sig of FRAMEWORK_SIGNATURES) {
    if (await fileExists(path.join(dir, sig.file))) return sig;
  }
  // fallback: any package.json with a "dev" script
  const pkgPath = path.join(dir, "package.json");
  if (await fileExists(pkgPath)) {
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
    if (pkg.scripts?.dev) {
      return { file: "package.json", framework: "Node.js (generic)", devCmd: ["npm", "run", "dev"], readyRegex: /.*/ };
    }
  }
  return { file: "", framework: "Unknown", devCmd: ["npm", "run", "dev"], readyRegex: /.*/ };
}

async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function waitForReady(child: ResultPromise, readyRegex: RegExp, port: number, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(async () => {
      if (settled) return;
      // fall back to a plain TCP probe if the log line never matched
      const ok = await probePort(port).catch(() => false);
      settled = true;
      ok ? resolve() : reject(new Error(`Dev server did not become ready within ${timeoutMs}ms`));
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      const str = chunk.toString();
      if (!settled && readyRegex.test(str)) {
        settled = true;
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
  });
}

async function probePort(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(2000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

/** Discover a handful of app routes to crawl, from common file-based routers. */
export async function discoverRoutes(dir: string): Promise<string[]> {
  const patterns = [
    "app/**/page.{tsx,jsx,ts,js}",
    "pages/**/*.{tsx,jsx,ts,js}",
    "src/pages/**/*.{tsx,jsx,ts,js}",
    "src/routes/**/*.{tsx,jsx,vue}",
  ];
  const files = await fg(patterns, { cwd: dir, ignore: ["**/node_modules/**", "**/_*.tsx", "**/api/**"] });
  const routes = new Set<string>(["/"]);
  for (const f of files) {
    const route = fileToRoute(f);
    if (route) routes.add(route);
  }
  return Array.from(routes).slice(0, 6);
}

function fileToRoute(file: string): string | null {
  let r = file
    .replace(/^app\//, "")
    .replace(/^(src\/)?pages\//, "")
    .replace(/\/page\.(tsx|jsx|ts|js)$/, "")
    .replace(/\.(tsx|jsx|ts|js|vue)$/, "");
  if (r === "index" || r === "") return "/";
  if (r.includes("[") || r.startsWith("_") || r.startsWith("api/")) return null;
  return "/" + r;
}
