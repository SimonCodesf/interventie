#!/bin/bash

# Define output name
OUTPUT_ZIP="interventie_clean.zip"
DIST_DIR="dist_temp"

# Clean up previous run
rm -rf "$DIST_DIR"
rm -f "$OUTPUT_ZIP"

# Create dist directory
mkdir -p "$DIST_DIR"

# 1. Copy Core Files
echo "Copying core files..."
cp index.html "$DIST_DIR/"
cp style.css "$DIST_DIR/"
cp api.php "$DIST_DIR/"
cp config.php "$DIST_DIR/"
cp security.php "$DIST_DIR/"
cp app.js "$DIST_DIR/"
cp README.md "$DIST_DIR/"
if [ -f ".htaccess" ]; then
    cp .htaccess "$DIST_DIR/"
fi

# 2. Copy Directories (Recursive)
echo "Copying directories..."
cp -R js "$DIST_DIR/"
cp -R includes "$DIST_DIR/"
cp -R admin "$DIST_DIR/"
cp -R img "$DIST_DIR/"
cp -R assets "$DIST_DIR/"

# 3. Create Empty Uploads Structure
echo "Creating empty uploads structure..."
mkdir -p "$DIST_DIR/uploads"
mkdir -p "$DIST_DIR/uploads/thumbnails"
mkdir -p "$DIST_DIR/uploads/ar-layers"

# Copy .htaccess from uploads if it exists (important for security/access)
if [ -f "uploads/.htaccess" ]; then
    cp "uploads/.htaccess" "$DIST_DIR/uploads/"
fi

# 4. Setup Tools (Only necessary ones)
echo "Setting up tools..."
mkdir -p "$DIST_DIR/tools"
cp tools/optimize_images.php "$DIST_DIR/tools/"
cp tools/merge_mind_files.js "$DIST_DIR/tools/"
cp tools/package.json "$DIST_DIR/tools/"

# Copy node_modules for tools (required for merge_mind_files.js)
if [ -d "tools/node_modules" ]; then
    echo "  Copying tools/node_modules..."
    cp -R tools/node_modules "$DIST_DIR/tools/"
fi

# 5. Cleanup inside dist (remove .DS_Store, .git, etc)
echo "Cleaning up temporary files..."
find "$DIST_DIR" -name ".DS_Store" -delete
find "$DIST_DIR" -name ".git" -exec rm -rf {} +
find "$DIST_DIR" -name ".gitignore" -delete

# 6. Create ZIP
echo "Creating ZIP file..."
cd "$DIST_DIR"
zip -r "../$OUTPUT_ZIP" .
cd ..

# 7. Cleanup
echo "Removing temporary directory..."
rm -rf "$DIST_DIR"

echo "Done! Created $OUTPUT_ZIP"
