#!/bin/bash

# Script to fix hardcoded IDs in primitives components

echo "🔧 Fixing hardcoded IDs in primitives components..."

PRIMITIVES_DIR="/Users/michaelayoade/Downloads/Projects/dotmac-platform-services/frontend/shared/packages/primitives/src"

# Files with hardcoded IDs
FILES=(
  "$PRIMITIVES_DIR/patterns/index.tsx"
  "$PRIMITIVES_DIR/data-display/RealTimeWidget.tsx"
  "$PRIMITIVES_DIR/data-display/AdvancedDataTable.tsx"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing: $file"

    # Replace hardcoded IDs with dynamic ones using template literals
    # Pattern: htmlFor='input-XXXXXXXXXX-YYYYYYYYY'
    sed -i '' "s/htmlFor='input-[0-9]*-[a-z0-9]*'/htmlFor={\`input-\${Math.random().toString(36).substr(2, 9)}\`}/g" "$file"

    # Also handle double quotes
    sed -i '' "s/htmlFor=\"input-[0-9]*-[a-z0-9]*\"/htmlFor={\`input-\${Math.random().toString(36).substr(2, 9)}\`}/g" "$file"

    echo "✅ Fixed: $file"
  else
    echo "⚠️  File not found: $file"
  fi
done

echo "✨ Hardcoded ID fixing complete!"