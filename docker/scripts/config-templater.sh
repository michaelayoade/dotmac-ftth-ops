#!/bin/sh
# docker/scripts/config-templater.sh
# Simple environment variable substitution for configuration templates

set -e

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <input_template> <output_file>"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="$2"

if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: Template file not found: $INPUT_FILE"
    exit 1
fi

# Perform environment variable substitution
# This replaces ${VAR_NAME} with the value of the environment variable
envsubst < "$INPUT_FILE" > "$OUTPUT_FILE"

# Verify output was created
if [ ! -f "$OUTPUT_FILE" ]; then
    echo "Error: Failed to create output file: $OUTPUT_FILE"
    exit 1
fi

# Set appropriate permissions
chmod 644 "$OUTPUT_FILE"

exit 0
