#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting staging deployment...${NC}"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${RED}Railway CLI is not installed. Installing...${NC}"
    npm install -g @railway/cli
fi

# Check for Railway token
if [ -z "$RAILWAY_TOKEN" ]; then
    echo -e "${RED}RAILWAY_TOKEN environment variable is not set.${NC}"
    echo "Please set it with: export RAILWAY_TOKEN=your-token"
    exit 1
fi

# Run tests before deployment (optional)
read -p "Run tests before deployment? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Running tests...${NC}"
    npm test
    if [ $? -ne 0 ]; then
        echo -e "${RED}Tests failed. Aborting deployment.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Tests passed!${NC}"
fi

# Build the project
echo -e "${YELLOW}Building project...${NC}"
npm run build

# Deploy to Railway
echo -e "${YELLOW}Deploying to Railway staging...${NC}"
railway up --service bike-area-api-staging

echo -e "${GREEN}Staging deployment initiated!${NC}"

# Wait for deployment
echo -e "${YELLOW}Waiting for deployment to complete...${NC}"
sleep 30

# Run smoke tests
echo -e "${YELLOW}Running smoke tests...${NC}"
STAGING_URL="https://staging-api.bikearea.ge"

for i in {1..5}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_URL/api/v1/health/live")
    if [ "$response" == "200" ]; then
        echo -e "${GREEN}Health check passed!${NC}"
        break
    fi
    echo "Attempt $i: Health check returned $response, retrying..."
    sleep 10
done

if [ "$response" != "200" ]; then
    echo -e "${RED}Health check failed after 5 attempts.${NC}"
    exit 1
fi

# Detailed health check
echo -e "${YELLOW}Running detailed health check...${NC}"
curl -s "$STAGING_URL/api/v1/health/detailed" | jq .

echo -e "${GREEN}Staging deployment completed successfully!${NC}"
