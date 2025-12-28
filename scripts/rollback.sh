#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}=== PRODUCTION ROLLBACK ===${NC}"

# Check for Railway token
if [ -z "$RAILWAY_TOKEN" ]; then
    echo -e "${RED}RAILWAY_TOKEN environment variable is not set.${NC}"
    echo "Please set it with: export RAILWAY_TOKEN=your-production-token"
    exit 1
fi

# List recent deployments
echo -e "${YELLOW}Recent pre-deploy tags:${NC}"
git tag -l "pre-deploy-*" | tail -5

echo ""
read -p "Enter the tag to rollback to (or press Enter to use Railway rollback): " TAG

if [ -n "$TAG" ]; then
    # Git-based rollback
    echo -e "${YELLOW}Checking out tag: $TAG${NC}"
    git checkout "$TAG"

    # Build and deploy
    echo -e "${YELLOW}Building from $TAG...${NC}"
    npm run build

    echo -e "${YELLOW}Deploying rollback to Railway...${NC}"
    railway up --service bike-area-api
else
    # Railway-based rollback
    echo -e "${YELLOW}Using Railway's built-in rollback...${NC}"
    echo "To rollback using Railway CLI:"
    echo "  railway rollback --service bike-area-api"
    echo ""
    echo "Or use the Railway dashboard to select a previous deployment."

    read -p "Attempt Railway CLI rollback now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        railway rollback --service bike-area-api
    fi
fi

# Wait and verify
echo -e "${YELLOW}Waiting for rollback to complete...${NC}"
sleep 30

# Health check
PROD_URL="https://api.bikearea.ge"
for i in {1..5}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/api/v1/health/live")
    if [ "$response" == "200" ]; then
        echo -e "${GREEN}Health check passed after rollback!${NC}"
        break
    fi
    echo "Attempt $i: Health check returned $response, retrying..."
    sleep 10
done

if [ "$response" != "200" ]; then
    echo -e "${RED}Health check failed after rollback.${NC}"
    echo -e "${RED}Manual intervention required!${NC}"
    exit 1
fi

echo -e "${GREEN}Rollback completed successfully!${NC}"
