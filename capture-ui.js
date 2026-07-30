const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\HomePC\\.gemini\\antigravity\\brain\\f6577b59-86fe-43d4-bdda-618de745a507\\';
const BASE_URL = 'http://localhost:3000';

async function run() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'], defaultViewport: { width: 1280, height: 800 } });
    const page = await browser.newPage();

    try {
        console.log('Navigating to login...');
        await page.goto(`${BASE_URL}/auth/signin`);

        // Wait for inputs
        await page.waitForSelector('input[type="email"]');
        await page.type('input[type="email"]', 'admin@example.com');
        await page.type('input[type="password"]', 'password123');

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]') // Assuming it's a submit button
        ]);

        console.log('Logged in successfully!');

        // Screenshot Regions Page
        console.log('Navigating to Regions...');
        await page.goto(`${BASE_URL}/dashboard/regions`, { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 1000)); // allow animations
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'regions_page.png') });

        // Open New Region modal and screenshot
        const newRegionBtn = await page.$('button:has-text("New Region"), button:has(.PiPlus)');
        if (newRegionBtn) {
            await newRegionBtn.click();
            await new Promise(r => setTimeout(r, 500));
            await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'new_region_modal.png') });
            // close modal (click escape)
            await page.keyboard.press('Escape');
            await new Promise(r => setTimeout(r, 500));
        }

        // Screenshot Branches Page
        console.log('Navigating to Branches...');
        await page.goto(`${BASE_URL}/dashboard/branches`, { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'branches_page.png') });

        // Open New Branch modal and screenshot
        const newBranchBtn = await page.$('button:has-text("New Branch"), button:has(.PiPlus)');
        if (newBranchBtn) {
            await newBranchBtn.click();
            await new Promise(r => setTimeout(r, 500));
            await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'new_branch_modal.png') });
            await page.keyboard.press('Escape');
            await new Promise(r => setTimeout(r, 500));
        }

        // Open Bulk Import modal and screenshot
        const bulkBtn = await page.$('button:has-text("Bulk Import"), button:has(.PiUploadSimple)');
        if (bulkBtn) {
            await bulkBtn.click();
            await new Promise(r => setTimeout(r, 500));
            await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'bulk_import_modal.png') });
            await page.keyboard.press('Escape');
            await new Promise(r => setTimeout(r, 500));
        }

        // Screenshot Branch Approvals Page
        console.log('Navigating to Branch Approvals...');
        await page.goto(`${BASE_URL}/dashboard/branch-approvals`, { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'branch_approvals_page.png') });

        // Requisitions Form
        console.log('Navigating to New Requisition...');
        await page.goto(`${BASE_URL}/dashboard/requisitions/new`, { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'new_requisition_form.png') });

        console.log('Successfully captured all screenshots.');
    } catch (e) {
        console.error('Error during automation:', e);
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'error_screenshot.png') });
    } finally {
        await browser.close();
    }
}

run();
