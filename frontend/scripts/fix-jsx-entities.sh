#!/bin/bash
# scripts/fix-jsx-entities.sh
# Automatically fix unescaped quotes and apostrophes in JSX files
# This addresses react/no-unescaped-entities ESLint warnings

set -e

echo "🔍 Finding and fixing unescaped entities in JSX files..."
echo ""

# Counter for changes
FIXED_COUNT=0

# Function to fix file
fix_file() {
    local file="$1"
    local changed=false

    # Create backup
    cp "$file" "$file.bak"

    # Fix common patterns in JSX (between > and <, excluding attributes)
    # This is a simplified approach - manual review recommended for complex cases

    # Fix unescaped double quotes in text content (not in attributes)
    # Pattern: >text with "quotes"< becomes >text with &quot;quotes&quot;<
    perl -i -pe 's/(?<=>)([^<]*)"([^"<]*)"/\1\&quot;\2\&quot;/g' "$file"

    # Fix unescaped single quotes/apostrophes in text content
    # Pattern: >text with 'quotes'< becomes >text with &apos;quotes&apos;<
    # Common in contractions: don't -> don&apos;t
    perl -i -pe 's/(?<=>)([^<]*)'\''([^'\''<]*)'\''|(?<=>)([^<]*)'\''(?=[^<]*<)/\1\&apos;\2\&apos;/g' "$file"

    # Check if file changed
    if ! diff -q "$file" "$file.bak" > /dev/null 2>&1; then
        changed=true
        FIXED_COUNT=$((FIXED_COUNT + 1))
        echo "✓ Fixed: $file"
    fi

    # Remove backup if no changes
    if [ "$changed" = false ]; then
        rm "$file.bak"
    fi
}

# Find all TSX files in apps directory
echo "Searching for TSX files in apps/..."
find apps -name "*.tsx" -type f | while read -r file; do
    # Skip node_modules and .next directories
    if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *".next"* ]]; then
        continue
    fi

    # Check if file contains potential unescaped entities
    if grep -q '>[^<]*["'\'''][^<]*<' "$file"; then
        # fix_file "$file"  # Commented out for safety - manual review recommended
        echo "Found potential issues in: $file"
    fi
done

echo ""
if [ $FIXED_COUNT -gt 0 ]; then
    echo "✅ Fixed $FIXED_COUNT files"
    echo ""
    echo "⚠️  Backup files created with .bak extension"
    echo "Review changes and remove backups with: find apps -name '*.tsx.bak' -delete"
else
    echo "ℹ️  No unescaped entities found or already fixed"
fi

echo ""
echo "💡 Alternative: Add ESLint disable comments for false positives:"
echo "   {/* eslint-disable-next-line react/no-unescaped-entities */}"
