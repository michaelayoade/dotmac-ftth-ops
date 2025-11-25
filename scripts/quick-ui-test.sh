#!/bin/bash

###############################################################################
# Quick UI/UX Visual Test - Captures screenshots of all pages
###############################################################################

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}Quick UI/UX Visual Test - ISP Operations App${NC}"
echo ""

ISP_URL="${ISP_OPS_URL:-http://localhost:3001}"
OUTPUT_DIR="ui-ux-screenshots"

mkdir -p "$OUTPUT_DIR"

echo -e "${YELLOW}Testing pages and capturing screenshots...${NC}"
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

# Function to capture screenshot using Playwright CLI
capture_screenshot() {
    local url=$1
    local name=$2
    
    echo -n "  Capturing $name... "
    
    npx -y playwright screenshot \
        --browser chromium \
        --viewport-size=1920,1080 \
        --full-page \
        "$ISP_URL$url" \
        "$OUTPUT_DIR/${name}.png" \
        2>/dev/null && echo -e "${GREEN}✓${NC}" || echo -e "${YELLOW}⚠${NC}"
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
    <title>UI/UX Visual Test Report</title>
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
        <h1>🎨 UI/UX Visual Test Report</h1>
        <div class="meta">
            <strong>Application:</strong> ISP Operations App<br>
            <strong>Date:</strong> <span id="date"></span><br>
            <strong>Resolution:</strong> 1920x1080 (Desktop)
        </div>
        
        <div class="grid">
            <div class="card">
                <div class="card-header">Homepage</div>
                <img src="homepage.png" alt="Homepage" class="card-image" onclick="openModal(this.src)">
            </div>
            <div class="card">
                <div class="card-header">Login Page</div>
                <img src="login.png" alt="Login" class="card-image" onclick="openModal(this.src)">
            </div>
            <div class="card">
                <div class="card-header">Dashboard</div>
                <img src="dashboard.png" alt="Dashboard" class="card-image" onclick="openModal(this.src)">
            </div>
            <div class="card">
                <div class="card-header">Subscribers</div>
                <img src="subscribers.png" alt="Subscribers" class="card-image" onclick="openModal(this.src)">
            </div>
            <div class="card">
                <div class="card-header">Network Dashboard</div>
                <img src="network.png" alt="Network" class="card-image" onclick="openModal(this.src)">
            </div>
            <div class="card">
                <div class="card-header">Billing & Revenue</div>
                <img src="billing.png" alt="Billing" class="card-image" onclick="openModal(this.src)">
            </div>
            <div class="card">
                <div class="card-header">RADIUS Dashboard</div>
                <img src="radius.png" alt="RADIUS" class="card-image" onclick="openModal(this.src)">
            </div>
            <div class="card">
                <div class="card-header">Devices</div>
                <img src="devices.png" alt="Devices" class="card-image" onclick="openModal(this.src)">
            </div>
            <div class="card">
                <div class="card-header">Settings</div>
                <img src="settings.png" alt="Settings" class="card-image" onclick="openModal(this.src)">
            </div>
            <div class="card">
                <div class="card-header">Customer Portal</div>
                <img src="customer-portal.png" alt="Customer Portal" class="card-image" onclick="openModal(this.src)">
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
echo -e "${YELLOW}To view the report:${NC}"
echo "  1. Open $OUTPUT_DIR/index.html in a browser"
echo "  2. Or run: python3 -m http.server 8080 --directory $OUTPUT_DIR"
echo "     Then visit: http://149.102.135.97:8080"
echo ""
echo -e "${GREEN}✓ Quick UI/UX test complete!${NC}"
