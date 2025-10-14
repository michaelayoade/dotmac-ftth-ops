#!/bin/bash
# Simple deployment script for VPS/EC2/DigitalOcean

set -e

echo "🚀 Deploying DotMac Platform Services"

# Pull latest changes
git pull origin main

# Load environment variables
source .env.prod

# Build and start services
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# Wait for health checks
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check health
curl -f http://localhost/health || exit 1

echo "✅ Deployment complete!"