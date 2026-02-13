#!/usr/bin/env node
// Take mobile screenshots of pullcord pages
// Usage: node screenshot.mjs [url] [output.png]
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4200/';
const output = process.argv[3] || 'screenshot.png';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, // iPhone 14 size
  deviceScaleFactor: 2,
});
const page = await context.newPage();
await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(1000); // let animations settle
await page.screenshot({ path: output, fullPage: false });
await browser.close();
console.log(`📸 ${output} (${url})`);
