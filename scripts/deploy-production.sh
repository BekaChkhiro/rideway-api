#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting production deployment...${NC}"
echo -e "${RED}WARNING: You are deploying to PRODUCTION!${NC}"

# Confirm production deployment
read -p "Are you sure you want to deploy to production? (yes/no) " -r
echo
if [[ ! $REPLY == "yes" ]]; then
    echo -e "${YELLOW}Deployment cancelled.${NC}"
    exit 0
fi

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${RED}Railway CLI is not installed. Installing...${NC}"
    npm install -g @railway/cli
fi

# Check for Railway token
if [ -z "$RAILWAY_TOKEN" ]; then
    echo -e "${RED}RAILWAY_TOKEN environment variable is not set.${NC}"
    echo "Please set it with: export RAILWAY_TOKEN=your-production-token"
    exit 1
fi

# Get current version
VERSION=$(node -p "require('./package.json').version")
echo -e "${YELLOW}Deploying version: $VERSION${NC}"

# Ensure we're on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${RED}Production deployments should be from 'main' branch.${NC}"
    echo "Current branch: $CURRENT_BRANCH"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}There are uncommitted changes.${NC}"
    git status --short
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Run full test suite
echo -e "${YELLOW}Running full test suite...${NC}"
npm run test
if [ $? -ne 0 ]; then
    echo -e "${RED}Tests failed. Aborting deployment.${NC}"
    exit 1
fi
echo -e "${GREEN}Tests passed!${NC}"

# Build the project
echo -e "${YELLOW}Building project...${NC}"
npm run build

# Create backup tag
BACKUP_TAG="pre-deploy-$(date +%Y%m%d-%H%M%S)"
echo -e "${YELLOW}Creating backup tag: $BACKUP_TAG${NC}"
git tag "$BACKUP_TAG"

# Deploy to Railway
echo -e "${YELLOW}Deploying to Railway production...${NC}"
railway up --service bike-area-api

echo -e "${GREEN}Production deployment initiated!${NC}"

# Wait for deployment
echo -e "${YELLOW}Waiting for deployment to complete...${NC}"
sleep 45

# Run smoke tests
echo -e "${YELLOW}Running smoke tests...${NC}"
PROD_URL="https://api.bikearea.ge"

for i in {1..5}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/api/v1/health/live")
    if [ "$response" == "200" ]; then
        echo -e "${GREEN}Health check passed!${NC}"
        break
    fi
    echo "Attempt $i: Health check returned $response, retrying..."
    sleep 10
done

if [ "$response" != "200" ]; then
    echo -e "${RED}Health check failed after 5 attempts.${NC}"
    echo -e "${YELLOW}You may need to rollback. Run: ./scripts/rollback.sh${NC}"
    exit 1
fi

# Ready check
response=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/api/v1/health/ready")
if [ "$response" != "200" ]; then
    echo -e "${RED}Ready check failed with status: $response${NC}"
    echo -e "${YELLOW}You may need to rollback. Run: ./scripts/rollback.sh${NC}"
    exit 1
fi
echo -e "${GREEN}Ready check passed!${NC}"

# Detailed health check
echo -e "${YELLOW}Running detailed health check...${NC}"
curl -s "$PROD_URL/api/v1/health/detailed" | jq .

echo -e "${GREEN}Production deployment completed successfully!${NC}"
echo -e "${YELLOW}Version $VERSION is now live at $PROD_URL${NC}"
