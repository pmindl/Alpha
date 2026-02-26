const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        console.log('Navigating to dashboard...');
        await page.setViewport({ width: 1280, height: 1024 });
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

        console.log('Taking screenshot...');
        const screenshotPath = 'public/dashboard-preview.png';
        await page.screenshot({ path: screenshotPath, fullPage: true });

        console.log(`Screenshot saved to ${screenshotPath}`);
        await browser.close();
        process.exit(0);
    } catch (error) {
        console.error('Screenshot error:', error);
        process.exit(1);
    }
})();
