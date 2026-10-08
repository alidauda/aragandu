/* Screenshot the ERP + open drawers for visual review. Uses the system
 * Chrome via playwright-core (no browser download). */
import { chromium } from "playwright-core";

const OUT = process.env.SHOT_DIR ?? "/tmp/erp-shots";
const BASE = "http://localhost:3000";

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shot(name) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot:", name);
}

// 1. Dashboard
await page.goto(`${BASE}/`);
await shot("01-dashboard");

// 2. New production run drawer with extra lines (the overflow suspect)
await page.goto(`${BASE}/feed/runs`);
await page.click("text=New run");
await page.click("text=+ Add ingredient line");
await page.click("text=+ Add ingredient line");
await page.click("text=+ Add ingredient line");
await shot("02-run-drawer");

// 3. Health — vaccination drawer (long select labels)
await page.goto(`${BASE}/layers/health`);
await page.click("text=Record vaccination");
await shot("03-vaccination-drawer");

// 4. Inventory — movement drawer
await page.goto(`${BASE}/inventory`);
await page.click("text=Record movement");
await shot("04-movement-drawer");

// 5. Layers sales — record sale drawer (walk-in visible)
await page.goto(`${BASE}/layers/sales`);
await page.click("text=Record sale");
await shot("05-sale-drawer");

// 6. Feed finished — record feed sale drawer
await page.goto(`${BASE}/feed/finished`);
await page.click("text=Record sale");
await shot("06-feed-sale-drawer");

// 7. Layers feed page (inline forms + tables)
await page.goto(`${BASE}/layers/feed`);
await shot("07-layers-feed");

// 8. Capacity page (currently open in the user's IDE)
await page.goto(`${BASE}/feed/capacity`);
await shot("08-capacity");

await browser.close();
