#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}======= PROMETHEUS DEPLOYMENT SCRIPT =======${NC}"

# Stage all changes
echo -e "${YELLOW}Staging all changes...${NC}"
git add .

# Ask for commit message
echo -e "${YELLOW}Enter commit message:${NC}"
read -p "> " commit_message

# Commit changes
echo -e "${YELLOW}Committing changes...${NC}"
git commit -m "$commit_message"

# Push to GitHub
echo -e "${YELLOW}Pushing to GitHub...${NC}"
git push origin master

# Check if GitHub push was successful
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Successfully pushed to GitHub${NC}"
else
  echo -e "\033[0;31m✗ Failed to push to GitHub. Aborting Heroku push.${NC}"
  exit 1
fi

# Push to Heroku
echo -e "${YELLOW}Pushing to Heroku...${NC}"
git push heroku master

# Check if Heroku push was successful
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Successfully pushed to Heroku${NC}"
else
  echo -e "\033[0;31m✗ Failed to push to Heroku.${NC}"
  exit 1
fi

echo -e "${GREEN}======= DEPLOYMENT COMPLETE =======${NC}"
echo -e "${GREEN}✓ Code pushed to GitHub (frontend will deploy via Vercel)${NC}"
echo -e "${GREEN}✓ Code pushed to Heroku (backend API)${NC}" 