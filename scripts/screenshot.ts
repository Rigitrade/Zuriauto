/**
 * Photographs a running page, so that a change to the interface can be looked
 * at rather than reasoned about.
 *
 * Written the morning after a CSS change passed the type checker, three
 * hundred unit tests and a production build, and then unhid every closed
 * `<dialog>` in the admin console. Nothing in this repository could have
 * caught that, because nothing in it looks at a page. This does.
 *
 *   pnpm shot /admin/ --sign-in
 *   pnpm shot /admin/vehicles/ --sign-in --click "Bearbeiten" --out review
 *   pnpm shot https://zuriauto.ch/ --width 390
 *
 * Deliberately not a test. A screenshot proves nothing on its own — somebody
 * has to look at it — and a suite that fails on a two-pixel shift in a font
 * would be turned off within a week. This is a camera, and the judgement stays
 * with the person holding it.
 *
 * `playwright-core`, never `playwright`: the full package downloads a browser
 * from its install script, and this repository's devDependencies are installed
 * on every deployment. Core ships no browser and reaches for one already on
 * the machine — the Chromium in Playwright's own cache, or failing that the
 * Chrome the office already has. So a production build is untouched by this
 * file existing.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { chromium, type Browser, type Page } from "playwright-core";

config({ path: ".env.local" });

/** Where the dev server is, unless told otherwise. */
const DEFAULT_BASE = process.env.SHOT_BASE_URL ?? "http://localhost:3456";

/** Wide enough for the admin tables, which is what is usually being looked
 *  at. A phone is `--width 390`. */
const DEFAULT_WIDTH = 1280;

interface Options {
  targets: string[];
  base: string;
  width: number;
  height: number;
  out: string;
  fullPage: boolean;
  signIn: boolean;
  username: string;
  password: string;
  /** Text of each control to click before the picture is taken, in order —
   *  how a dialog behind a menu gets photographed open. Repeat `--click`. */
  clicks: string[];
  /** Milliseconds to settle after load. Animations and fonts, mostly. */
  settle: number;
}

function parseArguments(argv: string[]): Options {
  const targets: string[] = [];
  const options: Options = {
    targets,
    base: DEFAULT_BASE,
    width: DEFAULT_WIDTH,
    height: 900,
    out: "screenshots",
    fullPage: true,
    signIn: false,
    username: process.env.SHOT_ADMIN_USER ?? "review",
    password: process.env.SHOT_ADMIN_PASSWORD ?? "",
    clicks: [],
    settle: 400,
  };

  for (let at = 0; at < argv.length; at++) {
    const argument = argv[at];
    const next = () => argv[++at];

    switch (argument) {
      case "--base":
        options.base = next();
        break;
      case "--width":
        options.width = Number(next());
        break;
      case "--height":
        options.height = Number(next());
        break;
      case "--out":
        options.out = next();
        break;
      case "--viewport-only":
        options.fullPage = false;
        break;
      case "--sign-in":
        options.signIn = true;
        break;
      case "--user":
        options.username = next();
        break;
      case "--password":
        options.password = next();
        break;
      case "--click":
        options.clicks.push(next());
        break;
      case "--settle":
        options.settle = Number(next());
        break;
      default:
        targets.push(argument);
    }
  }

  return options;
}

/**
 * A browser, from whatever is already installed.
 *
 * The cached Chromium first, because it is the one Playwright was built
 * against. The office's own Chrome is the fallback, and it is a real fallback
 * rather than a nicety: a machine that has never run Playwright has no cache,
 * and asking somebody to download a browser before they can look at their own
 * page is how a tool like this stops being used.
 */
async function launch(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch (downloadless) {
    try {
      return await chromium.launch({ channel: "chrome" });
    } catch {
      throw new Error(
        "No browser to drive. Either install Playwright's Chromium once —\n" +
          "  pnpm dlx playwright install chromium\n" +
          "— or install Google Chrome.\n\n" +
          `Playwright said: ${String(downloadless).slice(0, 300)}`
      );
    }
  }
}

/**
 * Signs in through the API rather than the form.
 *
 * The cookie is what the pages want, and posting the credentials straight to
 * the endpoint that issues it skips a page load and a form that may itself be
 * the thing being changed. A screenshot of the fleet should not fail because
 * somebody renamed the sign-in button.
 */
async function signIn(page: Page, options: Options): Promise<void> {
  if (!options.password) {
    throw new Error(
      "--sign-in needs a password: pass --password, or set SHOT_ADMIN_PASSWORD."
    );
  }

  const response = await page.request.post(`${options.base}/api/admin/session/`, {
    data: { username: options.username, password: options.password },
  });

  if (!response.ok()) {
    throw new Error(
      `Sign-in was refused with ${response.status()}. ` +
        "Check the user exists in the database this server is pointed at."
    );
  }
}

/** `/admin/` becomes `http://localhost:3456/admin/`; a full URL is left be. */
function resolve(target: string, base: string): string {
  return /^https?:\/\//.test(target) ? target : `${base}${target}`;
}

/** `/admin/vehicles/` becomes `admin-vehicles.png`. */
function fileNameFor(target: string): string {
  const path = target.replace(/^https?:\/\/[^/]+/, "");
  const slug = path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return `${slug || "home"}.png`;
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));

  if (options.targets.length === 0) {
    console.error(
      "Usage: pnpm shot <path-or-url> [more…] [--sign-in] [--click TEXT]\n" +
        "       [--base URL] [--width N] [--out DIR] [--viewport-only]"
    );
    process.exit(1);
  }

  mkdirSync(options.out, { recursive: true });

  const browser = await launch();
  const context = await browser.newContext({
    viewport: { width: options.width, height: options.height },
    // The console is Swiss and half of it is German. A browser claiming
    // en-US would photograph dates in a format no page here prints.
    locale: "de-CH",
    timezoneId: "Europe/Zurich",
  });

  const page = await context.newPage();

  // Anything the page complains about, said out loud. A screenshot of a
  // broken page and a screenshot of a working one can look identical.
  const complaints: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") complaints.push(message.text());
  });
  page.on("pageerror", (error) => complaints.push(String(error)));

  try {
    if (options.signIn) await signIn(page, options);

    for (const target of options.targets) {
      const url = resolve(target, options.base);
      const response = await page.goto(url, { waitUntil: "networkidle" });

      // In order, so a control behind a menu can be reached: the menu, then
      // the item in it. `.first()` on purpose — a fleet table has one
      // "Bearbeiten" per car, and the first row is as good a specimen as any.
      for (const click of options.clicks) {
        // `exact` on the button, loose on the text. A row's menu button is
        // named "Aktionen · ZH 656 404" so that a screen reader running down
        // the column does not say "Aktionen" ten times — which means a loose
        // match on a plate finds the button rather than the cell, and clicks
        // the menu when the intention was the row.
        const byRole = page
          .getByRole("button", { name: click, exact: true })
          .first();
        const target = (await byRole.count()) > 0
          ? byRole
          : page.getByText(click, { exact: false }).first();
        await target.click();
        await page.waitForTimeout(options.settle);
      }

      await page.waitForTimeout(options.settle);

      const file = join(options.out, fileNameFor(target));
      await page.screenshot({ path: file, fullPage: options.fullPage });

      console.log(`${response?.status() ?? "???"}  ${url}  ->  ${file}`);
    }
  } finally {
    await browser.close();
  }

  if (complaints.length > 0) {
    console.log("\nThe page complained:");
    for (const complaint of complaints.slice(0, 10)) {
      console.log(`  ${complaint.slice(0, 200)}`);
    }
  }
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
