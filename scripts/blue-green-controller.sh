#!/bin/bash
# Blue-Green Deployment Controller
# Manages traffic switching and health validation

set -e

# Configuration
ACTIVE_COLOR_FILE="/tmp/active_deployment.color"
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_INTERVAL=${HEALTH_CHECK_INTERVAL:-30}
DEPLOYMENT_TIMEOUT=${DEPLOYMENT_TIMEOUT:-300}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get current active deployment
get_active_deployment() {
    if [ -f "$ACTIVE_COLOR_FILE" ]; then
        cat "$ACTIVE_COLOR_FILE"
    else
        echo "blue"  # Default to blue
    fi
}

# Set active deployment
set_active_deployment() {
    local color=$1
    echo "$color" > "$ACTIVE_COLOR_FILE"
    echo -e "${GREEN}✓ Active deployment set to: $color${NC}"
}

# Get inactive deployment color
get_inactive_deployment() {
    local active=$(get_active_deployment)
    if [ "$active" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Health check function
health_check() {
    local color=$1
    local service=$2
    local port=$3
    local endpoint=${4:-/health}

    local container_name="dotmac-${service}-${color}"

    echo -e "${YELLOW}Checking health for $container_name...${NC}"

    # Check if container is running
    if ! docker ps --format "{{.Names}}" | grep -q "^${container_name}$"; then
        echo -e "${RED}✗ Container $container_name is not running${NC}"
        return 1
    fi

    # Check HTTP health endpoint
    local health_url="http://localhost:${port}${endpoint}"
    if docker exec "$container_name" curl -f -s "$health_url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Health check passed for $container_name${NC}"
        return 0
    else
        echo -e "${RED}✗ Health check failed for $container_name${NC}"
        return 1
    fi
}

# Wait for deployment to be ready
wait_for_deployment() {
    local color=$1
    local max_retries=$HEALTH_CHECK_RETRIES
    local retry_count=0

    echo -e "${YELLOW}Waiting for $color deployment to be ready...${NC}"

    while [ $retry_count -lt $max_retries ]; do
        if health_check "$color" "app" "8000" "/health" && \
           health_check "$color" "frontend" "3000" "/api/health"; then
            echo -e "${GREEN}✓ $color deployment is ready!${NC}"
            return 0
        fi

        retry_count=$((retry_count + 1))
        echo -e "${YELLOW}Retry $retry_count/$max_retries - waiting ${HEALTH_CHECK_INTERVAL}s...${NC}"
        sleep $HEALTH_CHECK_INTERVAL
    done

    echo -e "${RED}✗ $color deployment failed to become ready after $max_retries attempts${NC}"
    return 1
}

# Deploy to inactive environment
deploy() {
    local version=${1:-latest}
    local inactive=$(get_inactive_deployment)

    echo -e "${BLUE}════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Starting deployment to $inactive environment${NC}"
    echo -e "${BLUE}Version: $version${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════${NC}"

    # Set version for deployment
    if [ "$inactive" = "green" ]; then
        export GREEN_VERSION=$version
    else
        export BLUE_VERSION=$version
    fi

    # Pull latest images
    echo -e "${YELLOW}Pulling latest images...${NC}"
    docker-compose -f docker-compose.blue-green.yml pull app-$inactive frontend-$inactive

    # Deploy to inactive environment
    echo -e "${YELLOW}Deploying to $inactive environment...${NC}"
    docker-compose -f docker-compose.blue-green.yml up -d \
        app-$inactive \
        frontend-$inactive \
        postgres \
        redis \
        openbao \
        minio

    # Run database migrations
    echo -e "${YELLOW}Running database migrations...${NC}"
    docker-compose -f docker-compose.blue-green.yml exec app-$inactive \
        /docker-entrypoint.sh migrate

    # Wait for deployment to be ready
    if ! wait_for_deployment "$inactive"; then
        echo -e "${RED}Deployment failed! Rolling back...${NC}"
        docker-compose -f docker-compose.blue-green.yml stop app-$inactive frontend-$inactive
        return 1
    fi

    echo -e "${GREEN}✓ Deployment to $inactive environment successful!${NC}"
    echo -e "${YELLOW}Run 'switch' command to activate this deployment${NC}"
}

# Switch traffic to inactive deployment
switch() {
    local active=$(get_active_deployment)
    local inactive=$(get_inactive_deployment)

    echo -e "${BLUE}════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Switching traffic from $active to $inactive${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════${NC}"

    # Verify inactive deployment is healthy
    if ! health_check "$inactive" "app" "8000" "/health" || \
       ! health_check "$inactive" "frontend" "3000" "/api/health"; then
        echo -e "${RED}✗ Cannot switch - $inactive deployment is not healthy${NC}"
        return 1
    fi

    # Update Traefik routing rules
    echo -e "${YELLOW}Updating routing rules...${NC}"

    # Primary routes to new deployment
    docker exec dotmac-traefik sh -c "
        # Update dynamic configuration
        cat > /etc/traefik/dynamic/routing.yml <<EOF
http:
  routers:
    api-main:
      rule: Host(\`api.yourdomain.com\`)
      service: api-$inactive
      tls:
        certResolver: letsencrypt

    frontend-main:
      rule: Host(\`app.yourdomain.com\`)
      service: frontend-$inactive
      tls:
        certResolver: letsencrypt

  services:
    api-$inactive:
      loadBalancer:
        servers:
          - url: http://app-$inactive:8000

    frontend-$inactive:
      loadBalancer:
        servers:
          - url: http://frontend-$inactive:3000
EOF
    "

    # Update active deployment marker
    set_active_deployment "$inactive"

    # Verify switch was successful
    sleep 5
    if health_check "$inactive" "app" "8000" "/health"; then
        echo -e "${GREEN}✓ Traffic successfully switched to $inactive deployment!${NC}"
        echo -e "${YELLOW}Old $active deployment is still running for rollback if needed${NC}"
    else
        echo -e "${RED}✗ Switch verification failed!${NC}"
        return 1
    fi
}

# Rollback to previous deployment
rollback() {
    local active=$(get_active_deployment)
    local previous=$(get_inactive_deployment)

    echo -e "${YELLOW}⚠️  Rolling back from $active to $previous${NC}"

    # Quick switch back
    set_active_deployment "$previous"

    # Update routing immediately
    switch

    echo -e "${GREEN}✓ Rollback completed!${NC}"
}

# Stop inactive deployment
cleanup() {
    local inactive=$(get_inactive_deployment)

    echo -e "${YELLOW}Stopping $inactive deployment...${NC}"
    docker-compose -f docker-compose.blue-green.yml stop \
        app-$inactive \
        frontend-$inactive

    echo -e "${GREEN}✓ $inactive deployment stopped${NC}"
}

# Show deployment status
status() {
    local active=$(get_active_deployment)
    local inactive=$(get_inactive_deployment)

    echo -e "${BLUE}════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Deployment Status${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════${NC}"

    echo -e "Active deployment: ${GREEN}$active${NC}"
    echo -e "Inactive deployment: ${YELLOW}$inactive${NC}"

    echo -e "\n${BLUE}Container Status:${NC}"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep dotmac

    echo -e "\n${BLUE}Health Status:${NC}"
    health_check "$active" "app" "8000" "/health" || true
    health_check "$active" "frontend" "3000" "/api/health" || true
    health_check "$inactive" "app" "8000" "/health" || true
    health_check "$inactive" "frontend" "3000" "/api/health" || true
}

# Canary deployment (gradual traffic shift)
canary() {
    local percentage=${1:-10}
    local inactive=$(get_inactive_deployment)
    local active=$(get_active_deployment)

    echo -e "${BLUE}════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Starting canary deployment${NC}"
    echo -e "${BLUE}Routing $percentage% traffic to $inactive${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════${NC}"

    # Configure weighted routing in Traefik
    docker exec dotmac-traefik sh -c "
        cat > /etc/traefik/dynamic/canary.yml <<EOF
http:
  services:
    api-canary:
      weighted:
        services:
          - name: api-$active
            weight: $((100 - percentage))
          - name: api-$inactive
            weight: $percentage

    frontend-canary:
      weighted:
        services:
          - name: frontend-$active
            weight: $((100 - percentage))
          - name: frontend-$inactive
            weight: $percentage
EOF
    "

    echo -e "${GREEN}✓ Canary deployment configured: $percentage% → $inactive${NC}"
    echo -e "${YELLOW}Monitor metrics and run 'canary <higher-percentage>' to increase traffic${NC}"
}

# Monitor deployment metrics
monitor() {
    echo -e "${BLUE}════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Monitoring Deployment Metrics${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════${NC}"

    while true; do
        clear
        echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] Deployment Monitor${NC}"
        echo -e "${BLUE}════════════════════════════════════════════════${NC}"

        status

        echo -e "\n${BLUE}Resource Usage:${NC}"
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
            $(docker ps --format "{{.Names}}" | grep dotmac)

        echo -e "\n${YELLOW}Press Ctrl+C to exit monitoring${NC}"
        sleep $HEALTH_CHECK_INTERVAL
    done
}

# Main command handler
case "$1" in
    deploy)
        deploy "$2"
        ;;
    switch)
        switch
        ;;
    rollback)
        rollback
        ;;
    cleanup)
        cleanup
        ;;
    status)
        status
        ;;
    canary)
        canary "$2"
        ;;
    monitor)
        monitor
        ;;
    *)
        echo "Blue-Green Deployment Controller"
        echo ""
        echo "Usage: $0 {deploy|switch|rollback|cleanup|status|canary|monitor} [options]"
        echo ""
        echo "Commands:"
        echo "  deploy [version]  - Deploy to inactive environment"
        echo "  switch            - Switch traffic to inactive deployment"
        echo "  rollback          - Rollback to previous deployment"
        echo "  cleanup           - Stop inactive deployment"
        echo "  status            - Show deployment status"
        echo "  canary [percent]  - Route percentage of traffic to new deployment"
        echo "  monitor           - Monitor deployment metrics continuously"
        echo ""
        echo "Examples:"
        echo "  $0 deploy v1.2.3"
        echo "  $0 switch"
        echo "  $0 canary 25"
        echo "  $0 rollback"
        exit 1
        ;;
esac