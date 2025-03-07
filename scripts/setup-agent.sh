#!/bin/bash

set -e

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

for cmd in git curl pnpm; do
    if ! command_exists $cmd; then
        echo -e "${RED}Error: $cmd is not installed. Please install $cmd first.${NC}"
        exit 1
    fi
done

error() {
    local message="$1"
    local exit_code="${2:-1}"  # Default exit code is 1 if not provided

    echo -e "${RED}[ERROR ✗]: $message${NC}" >&2
    exit "$exit_code"
}

success() {
    local message="$1"

    echo -e "${GREEN}[SUCCESS ✓] : $message${NC}"
}

info() {
    local message="$1"

    echo -e "${BLUE}[INFO] : $message${NC}"
}

cleanup() {
    if [ -d "$INSTALL_DIR" ] && [ ! "$(ls -A $INSTALL_DIR)" ]; then
        echo -e "${BLUE}Cleaning up empty installation directory...${NC}"
        rm -rf "$INSTALL_DIR"
    fi
}

trap cleanup EXIT    # Will run cleanup when script exits

main () {
	if [ $# -eq 0 ]; then
		error "No config ID provided\nUsage: $0 <config_id>"
	elif [ $# -gt 1 ]; then
		error "Too many arguments. Only one config ID is allowed\nUsage: $0 <config_id>"
	fi

	CONFIG_ID="$1"

	if [ ${#CONFIG_ID} -ne 16 ]; then
		error "Config ID must be exactly 16 characters long"
	fi

	info "Starting Starknet Agent Kit setup with config ID: $CONFIG_ID"

	INSTALL_DIR="$HOME/.starknet-agent-kit"

	if [ -d "$INSTALL_DIR" ]; then
		info "Directory $INSTALL_DIR already exists, using existing installation..."
	else
		info "Creating installation directory..."
		mkdir -p "$INSTALL_DIR"

		info "Cloning repository..."
		if ! git clone https://github.com/kasarlabs/snak.git "$INSTALL_DIR"; then
			error "Failed to clone repository."
		fi
		success "Repository has been successfully cloned to $INSTALL_DIR"
	fi

	AGENT_CONFIG_DIR="$INSTALL_DIR/config/agents"

	info "Fetching agent configuration..."

	if ! HTTP_RESPONSE=$(curl -sL -w "\n%{http_code}" --connect-timeout 10 "https://starkagent.ai/api/agents/$CONFIG_ID"); then
		error "Could not connect to the server. Please check your internet connection and try again."
	fi

	if [ -z "$HTTP_RESPONSE" ]; then
		error "Empty response from server."
	fi

	HTTP_BODY=$(echo "$HTTP_RESPONSE" | sed -n '1p')
	HTTP_STATUS=$(echo "$HTTP_RESPONSE" | sed -n '2p')

	if [ -z "$HTTP_STATUS" ] || [ -z "$HTTP_BODY" ]; then
		error "Invalid response from server."
	fi

	if [ "$HTTP_STATUS" = "404" ]; then
		error "No configuration found with ID: $CONFIG_ID."
	elif [ "$HTTP_STATUS" != "200" ]; then
		error "Failed to fetch configuration (Status : $HTTP_STATUS).\nResponse : $HTTP_BODY."
	fi

	info "Updating agent configuration..."

	AGENT_NAME=$(echo "$HTTP_BODY" | grep -o '"name":[^,}]*' | sed 's/"name"://; s/"//g' | tr -d '[:space:]')

	if [ -z "$AGENT_NAME" ]; then
		error "Could not extract agent name from configuration."
	fi

	CONFIG_FILE="$AGENT_CONFIG_DIR/$AGENT_NAME.agent.json"

	if [ -f "$CONFIG_FILE" ]; then
		info "A configuration file for '$AGENT_NAME' already exists."
		if [ ! -t 0 ]; then
			if [ ! -t 1 ]; then
				error "Unable to run interactively."
			fi
			read -p "Do you want to overwrite it? (y/N) " -n 1 -r < /dev/tty
		else
			read -p "Do you want to overwrite it? (y/N) " -n 1 -r
		fi
		echo

		if [[ $REPLY =~ ^[Yy]$ ]]; then
			echo "$HTTP_BODY" > "$CONFIG_FILE"
		fi
	else
		echo "$HTTP_BODY" > "$CONFIG_FILE"
	fi

	success "Configuration has been successfully saved to $CONFIG_FILE."
	info "Changing to installation directory..."

	cd "$INSTALL_DIR"

	info "Installing dependencies..."
	if ! pnpm install; then
		error "Failed to install dependencies."
	fi
	success "Dependencies installed successfully."

	info "Starting the agent..."
	pnpm run local --agent=$AGENT_NAME.agent.json < /dev/tty

}

main "$@" || exit 1
