const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.ISP_OPS_URL || 'http://localhost:3001';
const OUTPUT_DIR = 'ui-ux-screenshots-intercept';

// Mock Session Data
const MOCK_SESSION = {
    user: {
        id: "dev-user",
        email: "admin@test.com",
        emailVerified: true,
        name: "Admin User",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        role: "super_admin",
        tenant_id: "default-tenant",
        activeOrganization: {
            id: "default-tenant",
            role: "tenant_owner",
            permissions: [],
        },
    },
    session: {
        id: "dev-session",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: "dev-user",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        token: "dev-token",
        ipAddress: "127.0.0.1",
    }
};

const pages = [
    { path: '/', name: 'homepage' },
    { path: '/login', name: 'login' },
    { path: '/dashboard', name: 'dashboard' },
    { path: '/dashboard/subscribers', name: 'subscribers' },
    { path: '/dashboard/network', name: 'network' },
    { path: '/dashboard/billing-revenue', name: 'billing' },
    { path: '/dashboard/radius', name: 'radius' },
    { path: '/dashboard/devices', name: 'devices' },
    { path: '/dashboard/settings', name: 'settings' },
    { path: '/customer-portal', name: 'customer-portal' },
];

(async () => {
    console.log('🚀 Starting Authenticated Screenshot Capture (Network Interception)...');

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR);
    }

    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });

    // Enable Network Interception to Mock Auth
    await context.route('**/api/auth/**/session', async route => {
        console.log('  ⚡ Intercepting session request');
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_SESSION)
        });
    });

    // Also intercept get-session
    await context.route('**/api/auth/get-session', async route => {
        console.log('  ⚡ Intercepting get-session request');
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_SESSION)
        });
    });

    const page = await context.newPage();

    for (const pageInfo of pages) {
        const url = `${BASE_URL}${pageInfo.path}`;
        console.log(`\n📸 Capturing ${pageInfo.name} (${url})...`);

        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

            // Wait a bit for rendering
            await page.waitForTimeout(2000);

            await page.screenshot({
                path: path.join(OUTPUT_DIR, `${pageInfo.name}.png`),
                fullPage: true
            });
            console.log(`  ✅ Saved to ${OUTPUT_DIR}/${pageInfo.name}.png`);
        } catch (e) {
            console.error(`  ❌ Failed to capture ${pageInfo.name}: ${e.message}`);
        }
    }

    await browser.close();
    console.log('\n✨ Capture Complete!');
})();
