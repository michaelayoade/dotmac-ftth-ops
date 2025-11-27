#!/bin/bash

###############################################################################
# Authenticated UI/UX Visual Test - Bypasses authentication
###############################################################################

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}Authenticated UI/UX Visual Test - ISP Operations App${NC}"
echo ""

ISP_URL="${ISP_OPS_URL:-http://localhost:3001}"
OUTPUT_DIR="ui-ux-screenshots-auth"

# Clean and create output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

echo -e "${YELLOW}Restarting ISP app with authentication bypass...${NC}"
echo ""

# Stop current ISP app
echo "Stopping current ISP app..."
pkill -f "next-server.*3001" || true
sleep 2

# Start ISP app with auth bypass
echo "Starting ISP app with NEXT_PUBLIC_AUTH_BYPASS_ENABLED=true..."
cd frontend
NEXT_PUBLIC_AUTH_BYPASS_ENABLED=true \
NEXT_PUBLIC_MSW_ENABLED=false \
pnpm --filter @dotmac/isp-ops-app dev > /tmp/isp-app-auth-bypass.log 2>&1 &

ISP_PID=$!
echo "ISP app started with PID: $ISP_PID"
cd ..

# Wait for app to be ready
echo "Waiting for app to be ready..."
for i in {1..30}; do
    if curl -s -f "$ISP_URL" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ App is ready${NC}"
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

# Give it a bit more time to fully initialize
sleep 5

echo ""
echo -e "${YELLOW}Capturing screenshots with authentication bypassed...${NC}"
echo ""

# Array of pages to test
declare -a pages=(
    "/:homepage"
    "/login:login"
    "/dashboard:dashboard"
    "/dashboard/subscribers:subscribers"
    "/dashboard/network:network"
    "/dashboard/billing-revenue:billing"
    "/dashboard/radius:radius"
    "/dashboard/devices:devices"
    "/dashboard/settings:settings"
    "/customer-portal:customer-portal"
)

# Function to capture screenshot
capture_screenshot() {
    local url=$1
    local name=$2
    
    echo -n "  Capturing $name... "
    
    # Use Playwright with longer timeout for initial page loads
    npx -y playwright screenshot \
        --browser chromium \
        --viewport-size=1920,1080 \
        --full-page \
        --timeout=60000 \
        "$ISP_URL$url" \
        "$OUTPUT_DIR/${name}.png" \
        2>/dev/null && echo -e "${GREEN}✓${NC}" || echo -e "${RED}✗${NC}"
    
    # Small delay between screenshots
    sleep 2
}

# Capture screenshots
for page in "${pages[@]}"; do
    IFS=':' read -r path name <<< "$page"
    capture_screenshot "$path" "$name"
done

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
    <title>UI/UX Visual Test Report - Authenticated</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 32px;
        }
        .meta {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .notice {
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 20px;
            color: #856404;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
            gap: 20px;
        }
        .card {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        .card:hover {
            transform: translateY(-4px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .card-header {
            padding: 15px;
            background: #4CAF50;
            color: white;
            font-weight: 600;
        }
        .card-image {
            width: 100%;
            height: auto;
            display: block;
            cursor: pointer;
        }
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            padding: 20px;
        }
        .modal-content {
            max-width: 90%;
            max-height: 90%;
            margin: auto;
            display: block;
        }
        .close {
            position: absolute;
            top: 20px;
            right: 40px;
            color: white;
            font-size: 40px;
            font-weight: bold;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 UI/UX Visual Test Report (Authenticated)</h1>
        <div class="meta">
            <strong>Application:</strong> ISP Operations App<br>
            <strong>Date:</strong> <span id="date"></span><br>
            <strong>Resolution:</strong> 1920x1080 (Desktop)<br>
            <strong>Mode:</strong> Authentication Bypassed
        </div>
        
        <div class="notice">
            <strong>ℹ️ Note:</strong> These screenshots were captured with authentication bypassed 
            (NEXT_PUBLIC_AUTH_BYPASS_ENABLED=true) to show the actual page content instead of login redirects.
        </div>
        
        <div class="grid">
            <div class="card">
                <div class="card-header">Homepage</div>
                <img src="homepage.png" alt="Homepage" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.display='none'">
            </div>
            <div class="card">
                <div class="card-header">Login Page</div>
                <img src="login.png" alt="Login" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.display='none'">
            </div>
            <div class="card">
                <div class="card-header">Dashboard</div>
                <img src="dashboard.png" alt="Dashboard" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.display='none'">
            </div>
            <div class="card">
                <div class="card-header">Subscribers</div>
                <img src="subscribers.png" alt="Subscribers" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.display='none'">
            </div>
            <div class="card">
                <div class="card-header">Network Dashboard</div>
                <img src="network.png" alt="Network" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.display='none'">
            </div>
            <div class="card">
                <div class="card-header">Billing & Revenue</div>
                <img src="billing.png" alt="Billing" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.display='none'">
            </div>
            <div class="card">
                <div class="card-header">RADIUS Dashboard</div>
                <img src="radius.png" alt="RADIUS" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.display='none'">
            </div>
            <div class="card">
                <div class="card-header">Devices</div>
                <img src="devices.png" alt="Devices" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.display='none'">
            </div>
            <div class="card">
                <div class="card-header">Settings</div>
                <img src="settings.png" alt="Settings" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.display='none'">
            </div>
            <div class="card">
                <div class="card-header">Customer Portal</div>
                <img src="customer-portal.png" alt="Customer Portal" class="card-image" onclick="openModal(this.src)" onerror="this.parentElement.style.display='none'">
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
    </script>
</body>
</html>
EOF

echo -e "${CYAN}HTML report generated: $OUTPUT_DIR/index.html${NC}"
echo ""

# Stop the auth-bypass app and restart normal app
echo -e "${YELLOW}Restarting ISP app in normal mode...${NC}"
kill $ISP_PID 2>/dev/null || true
sleep 2

cd frontend
pnpm --filter @dotmac/isp-ops-app dev > /tmp/isp-app-normal.log 2>&1 &
cd ..

echo ""
echo -e "${YELLOW}To view the authenticated screenshots:${NC}"
echo "  1. cd $OUTPUT_DIR && python3 -m http.server 9999"
echo "  2. Visit: http://149.102.135.97:9999"
echo ""
echo -e "${GREEN}✓ Authenticated UI/UX test complete!${NC}"
