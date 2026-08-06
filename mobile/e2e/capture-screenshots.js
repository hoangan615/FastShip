/**
 * Live end-to-end walkthrough of the FastShip mobile app (Expo web build) driven by
 * Playwright against a real running backend (Postgres + Redis + FastAPI + Celery),
 * seeded via `python scripts/seed.py`. Captures the same 26 screenshots documented in
 * docs/test-report.md (docs/screenshots/*.png) plus a small supplementary dark-mode
 * set (docs/screenshots/dark/*.png), by clicking through real state-changing actions
 * (add to cart, confirm order, accept a live socket offer, rate a delivery, ...)
 * rather than loading static screens.
 *
 * Prerequisites (see README section this script is referenced from):
 *   - Backend running at BASE_API (Postgres/Redis up, migrations applied, seeded)
 *   - `npx expo start --web` running at BASE_WEB
 *
 * Usage: node e2e/capture-screenshots.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_WEB = process.env.E2E_WEB_URL || "http://localhost:8081";
const BASE_API = process.env.E2E_API_URL || "http://localhost:8000";
const OUT_DIR = path.join(__dirname, "..", "..", "docs", "screenshots");
const OUT_DIR_DARK = path.join(OUT_DIR, "dark");
const VIEWPORT = { width: 390, height: 844 };
const SHIPPER_COORDS = { latitude: 10.7769, longitude: 106.7009 };

const CREDS = {
  customer: { email: "customer@fastship.dev", password: "password123" },
  merchant: { email: "merchant@fastship.dev", password: "password123" },
  shipper: { email: "shipper@fastship.dev", password: "password123" },
  ops: { email: "ops@fastship.dev", password: "password123" },
};

const errors = [];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shot(page, dir, name) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, name) });
  console.log(`  captured ${name}`);
}

// Tab navigators keep previously-visited screens mounted (hidden), so a plain
// getByText() often matches both the tab-bar label and a stale header title from an
// earlier screen. Scope tab-bar navigation to the actual tab role to avoid that.
async function clickTab(page, name) {
  await page.getByRole("tab", { name }).click();
}

async function login(page, role) {
  const { email, password } = CREDS[role];
  await page.goto(BASE_WEB, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByText("Sign in", { exact: true }).click();
  await page.waitForTimeout(1500);
}

// Background (non-focused) Playwright pages get their JS timers throttled by
// Chromium, which can stall the shipper's periodic location-ping setInterval long
// enough for the backend's stale-shipper watcher (SHIPPER_OFFLINE_AFTER_SECONDS) to
// flip them back offline while we're busy driving other personas. Sending a location
// ping directly via fetch (bypassing the app's own timer) keeps the heartbeat fresh
// regardless of tab focus.
async function pingLocation(page, coords) {
  await page.evaluate(
    async ({ apiUrl, coords }) => {
      const raw = localStorage.getItem("fastship-auth");
      if (!raw) return;
      const { state } = JSON.parse(raw);
      if (!state || !state.token) return;
      await fetch(`${apiUrl}/shippers/me/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
        body: JSON.stringify({ lat: coords.latitude, lng: coords.longitude }),
      });
    },
    { apiUrl: BASE_API, coords }
  );
}

async function ensureShipperOnline(page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await pingLocation(page, SHIPPER_COORDS);
    const online = await page
      .getByText("Online", { exact: true })
      .isVisible()
      .catch(() => false);
    if (online) return;
    await page.getByRole("switch").click();
    await page.waitForTimeout(1000);
  }
}

async function newPersona(browser, role, extra = {}) {
  const context = await browser.newContext({ viewport: VIEWPORT, ...extra });
  context.on("weberror", (e) => errors.push(`[${role}] ${e.error().message}`));
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`[${role}] ${e.message}`));
  return { context, page };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR_DARK, { recursive: true });

  const browser = await chromium.launch({ args: ["--no-sandbox"] });

  try {
    // --- 01/02: unauthenticated auth screens ---
    const guest = await newPersona(browser, "guest");
    await guest.page.goto(BASE_WEB, { waitUntil: "networkidle" });
    await shot(guest.page, OUT_DIR, "01-login.png");
    await guest.page.getByText("No account? Register").click();
    await shot(guest.page, OUT_DIR, "02-register.png");
    await guest.context.close();

    // --- personas ---
    const customer = await newPersona(browser, "customer");
    const merchant = await newPersona(browser, "merchant");
    const shipper = await newPersona(browser, "shipper", {
      geolocation: SHIPPER_COORDS,
      permissions: ["geolocation"],
    });
    const ops = await newPersona(browser, "ops");

    // --- shipper: capture offline state early, but DON'T stay online through the
    // customer flow below — a backgrounded (unfocused) tab gets its JS timers throttled
    // by Chromium, which can stall the periodic location-ping interval long enough for
    // the server's stale-shipper watcher (SHIPPER_OFFLINE_AFTER_SECONDS) to flip them
    // back offline anyway. Toggle online right before the merchant confirms instead, to
    // keep the online window short. Seed data starts the shipper already "available",
    // so force them offline first to get a genuine before/after pair of screenshots.
    await login(shipper.page, "shipper");
    const startedOnline = await shipper.page
      .getByText("Online", { exact: true })
      .isVisible()
      .catch(() => false);
    if (startedOnline) {
      await shipper.page.getByRole("switch").click();
      await shipper.page.waitForTimeout(800);
    }
    await shot(shipper.page, OUT_DIR, "15-shipper-home.png");

    // --- customer: browse, add to cart, checkout ---
    await login(customer.page, "customer");
    await shot(customer.page, OUT_DIR, "03-customer-catalog-merchants.png");
    await customer.page.getByText("FastShip Demo Kitchen").click();
    await customer.page.waitForTimeout(500);
    await shot(customer.page, OUT_DIR, "04-customer-catalog-products.png");

    const addButton = customer.page.locator('[data-testid^="qty-add-"]').first();
    await addButton.click();
    await addButton.click();
    await customer.page.waitForTimeout(300);
    await shot(customer.page, OUT_DIR, "05-customer-cart-added.png");

    await customer.page.getByText(/View cart/).click();
    await customer.page.waitForTimeout(500);
    await shot(customer.page, OUT_DIR, "06-customer-checkout.png");
    await customer.page.getByText("Place order", { exact: true }).click();
    await customer.page.waitForTimeout(1000);
    await shot(customer.page, OUT_DIR, "07-customer-order-detail-new.png");

    // order/[id] is a root-stack screen (no tab bar) — navigate back to the tabs directly
    await customer.page.goto(BASE_WEB + "/(customer)/orders", { waitUntil: "networkidle" });
    await customer.page.waitForTimeout(500);
    await shot(customer.page, OUT_DIR, "08-customer-orders-list.png");

    await clickTab(customer.page, "Addresses");
    await customer.page.getByPlaceholder("Label (e.g. Home, Work)").fill("Home");
    await customer.page.getByPlaceholder("Address").fill("45 Le Loi, District 1, HCMC");
    await customer.page.getByPlaceholder("Latitude").fill("10.7769");
    await customer.page.getByPlaceholder("Longitude").fill("106.6980");
    await customer.page.getByText("Save address", { exact: true }).click();
    await customer.page.waitForTimeout(800);
    await shot(customer.page, OUT_DIR, "09-customer-addresses.png");

    // --- shipper: go online now, right before the merchant confirms, to keep the gap
    // between "online" and "offer created" short ---
    await shipper.page.bringToFront();
    await shipper.page.reload({ waitUntil: "networkidle" });
    await ensureShipperOnline(shipper.page);
    await shot(shipper.page, OUT_DIR, "16-shipper-home-online.png");

    // --- merchant: accept the incoming order (triggers matching -> shipper offer) ---
    await login(merchant.page, "merchant");
    await shot(merchant.page, OUT_DIR, "10-merchant-incoming-orders.png");
    await merchant.page.getByText("Accept", { exact: true }).first().click();
    await merchant.page.waitForTimeout(1000);
    await shot(merchant.page, OUT_DIR, "11-merchant-order-accepted.png");

    // --- shipper: live offer should have arrived over the socket by now ---
    await shipper.page.bringToFront();
    await shipper.page.waitForTimeout(1500);
    await shot(shipper.page, OUT_DIR, "17-shipper-offer-received.png");
    await shipper.page.getByText("Accept", { exact: true }).click();
    await shipper.page.waitForTimeout(1000);
    // accepting doesn't auto-navigate — visiting Active order redirects into order/[id]
    await shipper.page.getByText("Active order", { exact: true }).click();
    await shipper.page.waitForTimeout(1000);
    await shot(shipper.page, OUT_DIR, "18-shipper-active-order.png");

    await shipper.page.getByText("Mark picked up", { exact: true }).click();
    await shipper.page.waitForTimeout(800);
    await shot(shipper.page, OUT_DIR, "19-shipper-picked-up.png");

    await shipper.page.getByText("Start delivery", { exact: true }).click();
    await shipper.page.waitForTimeout(800);
    await shot(shipper.page, OUT_DIR, "20-shipper-delivering.png");

    await shipper.page.getByText("Mark delivered", { exact: true }).click();
    await shipper.page.waitForTimeout(800);
    await shot(shipper.page, OUT_DIR, "21-shipper-completed.png");

    // --- customer: rate the completed delivery ---
    await clickTab(customer.page, "My Orders");
    await customer.page.waitForTimeout(1000);
    await customer.page.getByText(/^Order #/).first().click();
    await customer.page.waitForTimeout(800);
    await customer.page.locator('[data-testid="star-5"]').click();
    await shot(customer.page, OUT_DIR, "22-customer-rating-selected.png");
    await customer.page.getByText("Submit rating", { exact: true }).click();
    await customer.page.waitForTimeout(800);
    await shot(customer.page, OUT_DIR, "23-customer-rating-submitted.png");

    // --- merchant: products + revenue after a completed order ---
    await clickTab(merchant.page, "Products");
    await merchant.page.waitForTimeout(500);
    await shot(merchant.page, OUT_DIR, "12-merchant-products.png");
    await merchant.page.getByText("Pho Bo", { exact: true }).click();
    await merchant.page.waitForTimeout(500);
    await shot(merchant.page, OUT_DIR, "13-merchant-product-edit.png");
    await clickTab(merchant.page, "Revenue");
    await merchant.page.waitForTimeout(500);
    await shot(merchant.page, OUT_DIR, "14-merchant-revenue.png");

    // --- second order that stays unmatched, to give ops something real to show ---
    await shipper.page.goto(BASE_WEB + "/(shipper)/home", { waitUntil: "networkidle" });
    await shipper.page.waitForTimeout(500);
    await shipper.page.getByRole("switch").click(); // go back offline
    await shipper.page.waitForTimeout(500);

    // rating happened on the root-stack order/[id] screen — go back to the tabs directly
    await customer.page.goto(BASE_WEB + "/(customer)/catalog", { waitUntil: "networkidle" });
    await customer.page.waitForTimeout(500);
    await customer.page.getByText("FastShip Demo Kitchen").click();
    await customer.page.waitForTimeout(500);
    await customer.page.locator('[data-testid^="qty-add-"]').first().click();
    await customer.page.getByText(/View cart/).click();
    await customer.page.waitForTimeout(500);
    await customer.page.getByText("Place order", { exact: true }).click();
    await customer.page.waitForTimeout(800);

    await clickTab(merchant.page, "Orders");
    await merchant.page.waitForTimeout(500);
    await merchant.page.getByText("Accept", { exact: true }).first().click();
    await merchant.page.waitForTimeout(1000);

    // --- ops: real live state (no shipper available -> unmatched order, empty heatmap) ---
    await login(ops.page, "ops");
    await shot(ops.page, OUT_DIR, "24-ops-dashboard.png");
    await clickTab(ops.page, "Heatmap");
    await ops.page.waitForTimeout(500);
    await shot(ops.page, OUT_DIR, "25-ops-heatmap.png");
    await clickTab(ops.page, "Complaints");
    await ops.page.waitForTimeout(500);
    await shot(ops.page, OUT_DIR, "26-ops-complaints.png");

    // --- dark mode supplementary set (reuses the state created above) ---
    console.log("Capturing dark-mode supplementary set...");
    const darkGuest = await newPersona(browser, "dark-guest", { colorScheme: "dark" });
    await darkGuest.page.goto(BASE_WEB, { waitUntil: "networkidle" });
    await shot(darkGuest.page, OUT_DIR_DARK, "login-dark.png");
    await darkGuest.context.close();

    const darkCustomer = await newPersona(browser, "dark-customer", { colorScheme: "dark" });
    await login(darkCustomer.page, "customer");
    await shot(darkCustomer.page, OUT_DIR_DARK, "customer-catalog-dark.png");
    await clickTab(darkCustomer.page, "My Orders");
    await darkCustomer.page.waitForTimeout(500);
    await darkCustomer.page.getByText(/^Order #/).first().click();
    await darkCustomer.page.waitForTimeout(800);
    await shot(darkCustomer.page, OUT_DIR_DARK, "customer-order-detail-dark.png");
    await darkCustomer.context.close();

    const darkShipper = await newPersona(browser, "dark-shipper", {
      colorScheme: "dark",
      geolocation: SHIPPER_COORDS,
      permissions: ["geolocation"],
    });
    await login(darkShipper.page, "shipper");
    await darkShipper.page.getByRole("switch").click();
    await darkShipper.page.waitForTimeout(1000);
    await shot(darkShipper.page, OUT_DIR_DARK, "shipper-home-online-dark.png");
    await darkShipper.context.close();

    const darkOps = await newPersona(browser, "dark-ops", { colorScheme: "dark" });
    await login(darkOps.page, "ops");
    await shot(darkOps.page, OUT_DIR_DARK, "ops-dashboard-dark.png");
    await darkOps.context.close();

    console.log(`\nDone. Runtime errors observed: ${errors.length}`);
    if (errors.length) console.log(JSON.stringify(errors, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
