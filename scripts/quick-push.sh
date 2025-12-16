#!/bin/bash
# Quick push script - Automatiseert commit + push

set -e

# Parse arguments
MESSAGE="${1:-Snelle update}"
BRANCH="${2:-main}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Quick Push Script${NC}"
echo "Commit message: $MESSAGE"
echo "Branch: $BRANCH"
echo ""

# Check if there are changes
if [ -z "$(git status --porcelain)" ]; then
    echo "ℹ️  No changes to commit"
    exit 0
fi

# Show what's changing
echo -e "${BLUE}📝 Changes:${NC}"
git status --short
echo ""

# Add, commit, push
echo -e "${BLUE}📦 Adding files...${NC}"
git add -A

echo -e "${BLUE}💾 Committing...${NC}"
git commit -m "$MESSAGE"

echo -e "${BLUE}📤 Pushing to $BRANCH...${NC}"
git push origin "$BRANCH"

echo ""
echo -e "${GREEN}✅ Done! Pushing naar GitHub...${NC}"
echo -e "${GREEN}GitHub Actions draait nu: https://github.com/SimonCodesf/interventie/actions${NC}"
