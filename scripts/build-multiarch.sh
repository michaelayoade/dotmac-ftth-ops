#!/bin/bash
# scripts/build-multiarch.sh
# Build multi-architecture Docker images using buildx

set -e

IMAGE_NAME=${1:-freeradius-postgresql}
VERSION=${2:-latest}
REGISTRY=${3:-}

# Usage information
usage() {
    cat <<EOF
Usage: $0 [image_name] [version] [registry]

Arguments:
  image_name   Name of the image (default: freeradius-postgresql)
  version      Image version tag (default: latest)
  registry     Container registry URL (optional)
               Examples: docker.io/username, ghcr.io/org, 123.dkr.ecr.region.amazonaws.com

Examples:
  $0                                          # Build locally as freeradius-postgresql:latest
  $0 freeradius v1.0.0                       # Build as freeradius:v1.0.0
  $0 freeradius latest docker.io/myuser      # Build and push to Docker Hub
  $0 freeradius v1.0.0 ghcr.io/myorg        # Build and push to GitHub Container Registry

Environment Variables:
  BUILD_PLATFORMS   Comma-separated list of platforms (default: linux/amd64,linux/arm64)
  PUSH_IMAGE       Set to 'true' to push to registry (default: false if no registry)
  CACHE_FROM       Cache source (default: type=gha)
  CACHE_TO         Cache destination (default: type=gha,mode=max)
EOF
    exit 1
}

# Show usage if help flag is provided
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    usage
fi

# Default platforms
PLATFORMS=${BUILD_PLATFORMS:-linux/amd64,linux/arm64}

# Construct full image name
if [ -n "$REGISTRY" ]; then
    FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}"
    PUSH_IMAGE=${PUSH_IMAGE:-true}
else
    FULL_IMAGE_NAME="${IMAGE_NAME}"
    PUSH_IMAGE=${PUSH_IMAGE:-false}
fi

echo "🏗️  Building multi-architecture Docker image"
echo ""
echo "Configuration:"
echo "  Image:        ${FULL_IMAGE_NAME}:${VERSION}"
echo "  Platforms:    ${PLATFORMS}"
echo "  Push:         ${PUSH_IMAGE}"
echo ""

# Check if Docker buildx is available
if ! docker buildx version &> /dev/null; then
    echo "❌ Error: Docker buildx is not available"
    echo "   Install buildx: https://docs.docker.com/buildx/working-with-buildx/"
    exit 1
fi

# Create builder instance if it doesn't exist
BUILDER_NAME="dotmac-multiarch-builder"

if ! docker buildx ls | grep -q "$BUILDER_NAME"; then
    echo "📦 Creating buildx builder instance: $BUILDER_NAME"
    docker buildx create --name "$BUILDER_NAME" --driver docker-container --bootstrap
    echo "✅ Builder created"
else
    echo "✓ Using existing builder: $BUILDER_NAME"
fi

# Use the builder
docker buildx use "$BUILDER_NAME"

# Verify builder supports required platforms
echo "🔍 Verifying platform support..."
docker buildx inspect --bootstrap

# Build arguments
BUILD_ARGS=(
    --platform "$PLATFORMS"
    -t "${FULL_IMAGE_NAME}:${VERSION}"
    -t "${FULL_IMAGE_NAME}:latest"
    -f docker/Dockerfile.freeradius
)

# Add cache arguments if available (GitHub Actions cache)
if [ -n "${CACHE_FROM:-}" ]; then
    BUILD_ARGS+=(--cache-from "$CACHE_FROM")
fi

if [ -n "${CACHE_TO:-}" ]; then
    BUILD_ARGS+=(--cache-to "$CACHE_TO")
fi

# Add push flag if enabled
if [ "$PUSH_IMAGE" = "true" ]; then
    BUILD_ARGS+=(--push)
    echo "📤 Will push image to registry"
else
    BUILD_ARGS+=(--load)
    echo "💾 Will load image locally (single platform only)"
fi

# Build the image
echo ""
echo "🔨 Building image..."
echo "Command: docker buildx build ${BUILD_ARGS[*]} ."
echo ""

docker buildx build "${BUILD_ARGS[@]}" .

echo ""
echo "✅ Build complete!"
echo ""

if [ "$PUSH_IMAGE" = "true" ]; then
    echo "📋 Image pushed to:"
    echo "   ${FULL_IMAGE_NAME}:${VERSION}"
    echo "   ${FULL_IMAGE_NAME}:latest"
    echo ""
    echo "Pull with:"
    echo "   docker pull ${FULL_IMAGE_NAME}:${VERSION}"
else
    echo "📋 Image loaded locally:"
    echo "   ${FULL_IMAGE_NAME}:${VERSION}"
    echo ""
    echo "Run with:"
    echo "   docker run ${FULL_IMAGE_NAME}:${VERSION}"
fi
