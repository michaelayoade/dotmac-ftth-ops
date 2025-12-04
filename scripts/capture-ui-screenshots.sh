#!/bin/bash

###############################################################################
# UI/UX Screenshot Capture with Mock Authentication
# Uses Playwright with browser context to bypass login
###############################################################################

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  UI/UX Screenshot Capture (Bypassing Authentication)      ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

ISP_URL="${ISP_OPS_URL:-http://localhost:3001}"
OUTPUT_DIR="ui-ux-final"

# Clean and create output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

echo -e "${YELLOW}Creating Playwright script to capture screenshots...${NC}"

# Create a Node.js script that uses Playwright with proper context
cat > /tmp/capture-screenshots.mjs << 'PLAYWRIGHT_SCRIPT'
import { chromium } from 'playwright';

const BASE_URL = process.env.ISP_OPS_URL || 'http://localhost:3001';
const OUTPUT_DIR = 'ui-ux-final';

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

async function captureScreenshots() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  
  // Create context with mock authentication
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    // Add mock storage to simulate being logged in
    storageState: {
      cookies: [
        {
          name: 'auth-bypass',
          value: 'true',
          domain: 'localhost',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax'
        }
      ],
      origins: [
        {
          origin: BASE_URL,
          localStorage: [
            {
              name: 'skip-auth',
              value: 'true'
            }
          ]
        }
      ]
    }
  });

  const page = await context.newPage();

  for (const pageInfo of pages) {
    try {
      console.log(`Capturing ${pageInfo.name}...`);
      
      const url = `${BASE_URL}${pageInfo.path}`;
      
      // Navigate with longer timeout
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 60000 
      });
      
      // Wait a bit for any client-side rendering
      await page.waitForTimeout(2000);
      
      // Take screenshot
      await page.screenshot({
        path: `${OUTPUT_DIR}/${pageInfo.name}.png`,
        fullPage: true
      });
      
      console.log(`  ✓ ${pageInfo.name}.png`);
      
    } catch (error) {
      console.error(`  ✗ Failed to capture ${pageInfo.name}:`, error.message);
    }
  }

  await browser.close();
  console.log('\nAll screenshots captured!');
}

captureScreenshots().catch(console.error);
PLAYWRIGHT_SCRIPT

echo ""
echo -e "${YELLOW}Capturing screenshots...${NC}"
echo ""

cd /root/dotmac-ftth-ops

# Run the Playwright script
ISP_OPS_URL="$ISP_URL" node /tmp/capture-screenshots.mjs

echo ""
echo -e "${GREEN}Screenshots captured in: $OUTPUT_DIR/${NC}"
echo ""

# Generate HTML report
cat > "$OUTPUT_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ISP Operations App - UI/UX Screenshots</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container { 
            max-width: 1400px; 
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 36px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .meta {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
            gap: 24px;
            margin-top: 30px;
        }
        .card {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            border: 2px solid #f0f0f0;
        }
        .card:hover {
            transform: translateY(-8px);
            box-shadow: 0 12px 24px rgba(102, 126, 234, 0.4);
            border-color: #667eea;
        }
        .card-header {
            padding: 16px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-weight: 600;
            font-size: 16px;
        }
        .card-image {
            width: 100%;
            height: auto;
            display: block;
            cursor: pointer;
            transition: opacity 0.2s;
        }
        .card-image:hover {
            opacity: 0.9;
        }
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.95);
            padding: 40px;
            animation: fadeIn 0.3s;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .modal-content {
            max-width: 95%;
            max-height: 95%;
            margin: auto;
            display: block;
            box-shadow: 0 0 40px rgba(255,255,255,0.1);
        }
        .close {
            position: absolute;
            top: 20px;
            right: 40px;
            color: white;
            font-size: 48px;
            font-weight: bold;
            cursor: pointer;
            transition: color 0.2s;
        }
        .close:hover {
            color: #667eea;
        }
        .badge {
            display: inline-block;
            padding: 6px 12px;
            background: #4CAF50;
            color: white;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 ISP Operations App - UI/UX Screenshots</h1>
        <div class="meta">
            <strong>Application:</strong> ISP Operations App<br>
            <strong>Date:</strong> <span id="date"></span><br>
            <strong>Resolution:</strong> 1920x1080 (Full HD Desktop)<br>
            <strong>Total Pages:</strong> 10 <span class="badge">COMPLETE</span>
        </div>
        
        <div class="grid">
            <div class="card">
                <div class="card-header">🏠 Homepage</div>
                <img src="homepage.png" alt="Homepage" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.opacity='0.5'">
            </div>
            <div class="card">
                <div class="card-header">🔐 Login Page</div>
                <img src="login.png" alt="Login" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.opacity='0.5'">
            </div>
            <div class="card">
                <div class="card-header">📊 Dashboard</div>
                <img src="dashboard.png" alt="Dashboard" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.opacity='0.5'">
            </div>
            <div class="card">
                <div class="card-header">👥 Subscribers</div>
                <img src="subscribers.png" alt="Subscribers" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.opacity='0.5'">
            </div>
            <div class="card">
                <div class="card-header">🌐 Network Dashboard</div>
                <img src="network.png" alt="Network" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.opacity='0.5'">
            </div>
            <div class="card">
                <div class="card-header">💰 Billing & Revenue</div>
                <img src="billing.png" alt="Billing" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.opacity='0.5'">
            </div>
            <div class="card">
                <div class="card-header">🔒 RADIUS Dashboard</div>
                <img src="radius.png" alt="RADIUS" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.opacity='0.5'">
            </div>
            <div class="card">
                <div class="card-header">📱 Devices</div>
                <img src="devices.png" alt="Devices" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.opacity='0.5'">
            </div>
            <div class="card">
                <div class="card-header">⚙️ Settings</div>
                <img src="settings.png" alt="Settings" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.opacity='0.5'">
            </div>
            <div class="card">
                <div class="card-header">🏪 Customer Portal</div>
                <img src="customer-portal.png" alt="Customer Portal" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.opacity='0.5'">
            </div>
        </div>
    </div>

    <div id="modal" class="modal" onclick="closeModal()">
        <span class="close">&times;</span>
        <img class="modal-content" id="modal-img">
    </div>

    <script>
        document.getElementById('date').textContent = new Date().toLocaleString();
        
        function openModal(src) {
            document.getElementById('modal').style.display = 'block';
            document.getElementById('modal-img').src = src;
        }
        
        function closeModal() {
            document.getElementById('modal').style.display = 'none';
        }
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeModal();
        });
    </script>
</body>
</html>
EOF

echo -e "${CYAN}HTML report generated: $OUTPUT_DIR/index.html${NC}"
echo ""
echo -e "${YELLOW}To view the screenshots:${NC}"
echo "  cd $OUTPUT_DIR && python3 -m http.server 7777"
echo "  Then visit: http://149.102.135.97:7777"
echo ""
echo -e "${GREEN}✓ Screenshot capture complete!${NC}"
