#!/bin/bash

# Configuration
BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PROJECT_NAME="interventie_website"
FILENAME="${BACKUP_DIR}/${PROJECT_NAME}_${TIMESTAMP}.zip"

# Create backups directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create zip archive (DATA ONLY - Light Version)
# Includes: data/, uploads/, includes/ (config), assets/
echo "📦 Creating DATA backup: $FILENAME..."

zip -r "$FILENAME" \
    data/ \
    uploads/ \
    includes/ \
    assets/ \
    -x "*.git*" \
    -x ".DS_Store"

# Check if zip was successful
if [ $? -eq 0 ]; then
    echo "✅ Backup created successfully!"
    echo "📍 Location: $FILENAME"
    
    # List file size
    du -h "$FILENAME"
else
    echo "❌ Backup failed!"
    exit 1
fi
