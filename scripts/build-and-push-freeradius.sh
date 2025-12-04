#!/bin/bash
# scripts/build-and-push-freeradius.sh
# Build and push FreeRADIUS image to container registry

set -e

# Configuration from environment or arguments
VERSION="${1:-latest}"
REGISTRY="${REGISTRY:-}"
IMAGE_NAME="${IMAGE_NAME:-freeradius-postgresql}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print with color
print_info() {
    echo -e "${GREEN}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Show usage
usage() {
    cat <<EOF
Usage: $0 [version]

Arguments:
  version      Image version tag (default: latest)

Environment Variables:
  REGISTRY     Container registry URL (required for push)
               Examples:
                 - docker.io/username
                 - ghcr.io/organization
                 - 123456789012.dkr.ecr.us-east-1.amazonaws.com

  IMAGE_NAME   Image name (default: freeradius-postgresql)

  DOCKER_USERNAME   Username for registry login (optional)
  DOCKER_PASSWORD   Password for registry login (optional)

Registry Examples:

  Docker Hub:
    export REGISTRY=docker.io/myusername
    $0 v1.0.0

  GitHub Container Registry:
    export REGISTRY=ghcr.io/myorg
    export DOCKER_USERNAME=myusername
    export DOCKER_PASSWORD=\$GITHUB_TOKEN
    $0 v1.0.0

  AWS ECR:
    export REGISTRY=123456789012.dkr.ecr.us-east-1.amazonaws.com
    aws ecr get-login-password | docker login --username AWS --password-stdin \$REGISTRY
    $0 v1.0.0

  Google GCR:
    export REGISTRY=gcr.io/my-project
    gcloud auth configure-docker
    $0 v1.0.0
EOF
    exit 1
}

# Show usage if help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    usage
fi

echo "🚀 FreeRADIUS Multi-Arch Build and Push"
echo "========================================"
echo ""

# Check if registry is set
if [ -z "$REGISTRY" ]; then
    print_warning "REGISTRY environment variable not set"
    print_info "Building locally only (not pushing to registry)"
    FULL_IMAGE="${IMAGE_NAME}"
else
    FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}"
    print_info "Registry: $REGISTRY"
fi

print_info "Image: ${FULL_IMAGE}:${VERSION}"
echo ""

# Check prerequisites
print_info "Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi

# Check Docker buildx
if ! docker buildx version &> /dev/null; then
    print_error "Docker buildx is not available"
    echo "Install buildx: https://docs.docker.com/buildx/working-with-buildx/"
    exit 1
fi

# Check if Dockerfile exists
if [ ! -f "docker/Dockerfile.freeradius" ]; then
    print_error "Dockerfile not found: docker/Dockerfile.freeradius"
    exit 1
fi

print_info "✓ Prerequisites satisfied"
echo ""

# Login to registry if credentials are provided
if [ -n "$REGISTRY" ] && [ -n "$DOCKER_USERNAME" ] && [ -n "$DOCKER_PASSWORD" ]; then
    print_info "Logging in to registry..."
    echo "$DOCKER_PASSWORD" | docker login "$REGISTRY" -u "$DOCKER_USERNAME" --password-stdin
    print_info "✓ Logged in successfully"
    echo ""
fi

# Create or use existing buildx builder
BUILDER_NAME="dotmac-multiarch"

if docker buildx ls | grep -q "$BUILDER_NAME"; then
    print_info "Using existing builder: $BUILDER_NAME"
else
    print_info "Creating new builder: $BUILDER_NAME"
    docker buildx create --name "$BUILDER_NAME" --driver docker-container --bootstrap
fi

docker buildx use "$BUILDER_NAME"
docker buildx inspect --bootstrap

echo ""
print_info "Building multi-architecture image..."
echo "Platforms: linux/amd64, linux/arm64"
echo ""

# Build arguments
BUILD_ARGS=(
    --platform linux/amd64,linux/arm64
    -t "${FULL_IMAGE}:${VERSION}"
)

# Add latest tag if version is not latest
if [ "$VERSION" != "latest" ]; then
    BUILD_ARGS+=(-t "${FULL_IMAGE}:latest")
fi

# Add build metadata
BUILD_ARGS+=(
    --label "org.opencontainers.image.created=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    --label "org.opencontainers.image.version=${VERSION}"
    --label "org.opencontainers.image.title=DotMac FreeRADIUS"
    --label "org.opencontainers.image.description=FreeRADIUS with PostgreSQL support"
)

# Push or load based on registry setting
if [ -n "$REGISTRY" ]; then
    BUILD_ARGS+=(--push)
else
    print_warning "Loading single-platform image locally (multi-arch requires a registry)"
    BUILD_ARGS+=(--load --platform linux/amd64)
fi

# Add Dockerfile
BUILD_ARGS+=(-f docker/Dockerfile.freeradius)

# Add context
BUILD_ARGS+=(.)

# Execute build
docker buildx build "${BUILD_ARGS[@]}"

echo ""
print_info "✅ Build completed successfully!"
echo ""

if [ -n "$REGISTRY" ]; then
    echo "📦 Images pushed to registry:"
    echo "   ${FULL_IMAGE}:${VERSION}"
    if [ "$VERSION" != "latest" ]; then
        echo "   ${FULL_IMAGE}:latest"
    fi
    echo ""
    echo "Pull with:"
    echo "   docker pull ${FULL_IMAGE}:${VERSION}"
    echo ""
    echo "Update docker-compose.yml:"
    cat <<EOF
services:
  freeradius:
    image: ${FULL_IMAGE}:${VERSION}
EOF
else
    echo "📦 Image loaded locally:"
    echo "   ${FULL_IMAGE}:${VERSION}"
    echo ""
    echo "Run with:"
    echo "   docker run ${FULL_IMAGE}:${VERSION}"
fi

echo ""
print_info "🎉 Done!"
