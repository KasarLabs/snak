#!/bin/bash

# Simple wrapper script for Snak startup
# This script bypasses the npm docker commands and runs the start script directly
# Version: 1.0.0

# Set script to exit immediately if a command exits with a non-zero status
set -e

# Colors for formatting
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}Snak Startup Wrapper${NC}"
echo -e "${YELLOW}Checking Docker availability...${NC}"

# Check if Docker is available
if command -v docker >/dev/null 2>&1; then
  echo -e "${GREEN}Docker is available. Setting up database containers...${NC}"
  docker compose -f ./packages/database/compose.yaml up -d
  
  # Save the exit code for later use
  DOCKER_UP_EXIT_CODE=$?
  
  if [ $DOCKER_UP_EXIT_CODE -ne 0 ]; then
    echo -e "${YELLOW}Warning: Docker setup failed, but continuing anyway.${NC}"
  fi
else
  echo -e "${YELLOW}Docker is not available. Skipping database container setup.${NC}"
  echo -e "${YELLOW}Some features may not work correctly without Docker.${NC}"
fi

# Run the start script
echo -e "${GREEN}Launching Snak...${NC}"
./scripts/start.sh
START_EXIT_CODE=$?

# Teardown Docker if it was available
if command -v docker >/dev/null 2>&1; then
  echo -e "${YELLOW}Cleaning up database containers...${NC}"
  docker compose -f ./packages/database/compose.yaml rm -fsv || true
fi

# Exit with the same code as the start script
exit $START_EXIT_CODE