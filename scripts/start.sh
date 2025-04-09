#!/bin/bash
#
# Snak Engine Startup Script
# An interactive launcher for the Snak Agent engine
# Version: 0.0.11
#

# ----- CONFIGURATION -----

# Text styling and colors
declare -r GREEN='\033[0;32m'
declare -r BLUE='\033[0;34m'
declare -r CYAN='\033[0;36m'
declare -r YELLOW='\033[0;33m'
declare -r RED='\033[0;31m'
declare -r BOLD='\033[1m'
declare -r DIM='\033[2m'
declare -r NC='\033[0m' # No Color

# Temporary files
declare -r LOG_FILE=$(mktemp)
declare -r ERROR_LOG_FILE=$(mktemp)

# ----- HELPER FUNCTIONS -----

# Cleanup function to remove temporary files
cleanup() {
  rm -f "$LOG_FILE" "$ERROR_LOG_FILE"
}
trap cleanup EXIT

# Check if a command is available in PATH
check_command() {
  command -v "$1" > /dev/null 2>&1
  return $?
}

# Creates an interactive selection menu with keyboard navigation
# Arguments: List of options
# Returns: Selected index
select_option() {
  local options=("$@")
  local selected=0
  local ESC=$(printf '\033')
  
  # Hide cursor during selection
  tput civis
  
  while true; do
    # Print all options with the selected one highlighted
    for i in "${!options[@]}"; do
      if [ $i -eq $selected ]; then
        echo -e "${CYAN}${BOLD}> ${options[$i]}${NC}"
      else
        echo -e "  ${options[$i]}"
      fi
    done
    
    # Read keystroke
    read -rsn3 key
    
    # Clear displayed options for redraw
    for i in "${!options[@]}"; do
      tput cuu1
      tput el
    done
    
    # Process key presses
    if [[ $key == $ESC[A ]]; then  # Up arrow
      ((selected--))
      [ $selected -lt 0 ] && selected=$((${#options[@]}-1))
    elif [[ $key == $ESC[B ]]; then  # Down arrow
      ((selected++))
      [ $selected -ge ${#options[@]} ] && selected=0
    elif [[ $key == "" ]]; then  # Enter key
      break
    fi
  done
  
  # Restore cursor
  tput cnorm
  
  return $selected
}

# Renders a progress bar with percentage
# Arguments: Progress percentage (0-100), Message to display
progress_bar() {
  local progress=$1
  local message=$2
  local width=50
  local bar_width=$((progress * width / 100))
  
  # Draw the progress bar
  printf "\r${BLUE}%s${NC} [" "$message"
  for ((i=0; i<width; i++)); do
    if [ $i -lt $bar_width ]; then
      printf "${CYAN}█${NC}"
    else
      printf "${CYAN}░${NC}"
    fi
  done
  printf "] ${YELLOW}%d%%${NC}" "$progress"
}

# Executes a command with an animated progress bar
# Arguments: Message to display, Command to run, Show logs on error (true/false)
# Returns: Command exit status
run_with_progress() {
  local message=$1
  local command=$2
  local show_logs_on_error=${3:-"false"}
  
  # Initialize progress display
  progress_bar 0 "$message"
  
  # Execute command in the background and capture output
  eval "$command" > "$LOG_FILE" 2>&1 &
  local pid=$!
  
  # Animate progress while command is running
  local progress=0
  while kill -0 $pid 2>/dev/null; do
    progress_bar $progress "$message"
    sleep 0.1
    progress=$((progress + 1))
    if [ $progress -ge 99 ]; then
      progress=99
    fi
  done
  
  # Wait for command to complete
  wait $pid
  local status=$?
  
  # Display final status
  if [ $status -eq 0 ]; then
    progress_bar 100 "$message"
    echo -e "\n${GREEN}✓ $message completed${NC}"
    return 0
  else
    echo -e "\n${RED}✗ $message failed${NC}"
    if [ "$show_logs_on_error" = "true" ]; then
      echo -e "${YELLOW}Error logs:${NC}"
      cat "$LOG_FILE"
    fi
    return 1
  fi
}

# ----- FUNCTIONAL MODULES -----

# Installs required dependencies using pnpm
install_dependencies() {
  echo -e "${YELLOW}${BOLD}Installing dependencies...${NC}\n"
  
  # Verify pnpm is available
  if ! check_command pnpm; then
    echo -e "${RED}pnpm is not installed. Installation required.${NC}"
    echo -e "You can install it with: npm install -g pnpm"
    exit 1
  fi
  
  # Run installation with progress indicator
  run_with_progress "Installing modules" "pnpm install" "true"
  local status=$?
  
  # Clear and redraw the UI after successful installation
  if [ $status -eq 0 ]; then
    clear
    draw_ascii_logo
    create_info_box "Welcome to Snak, an advanced Agent engine powered by Starknet." \
                    "For more informations, visit our documentation at https://docs.snakagent.com"
  fi
  
  return $status
}

# Removes all dependencies using pnpm clean:all
remove_dependencies() {
  echo -e "${YELLOW}${BOLD}Removing dependencies...${NC}\n"
  
  # Run clean:all command with progress indicator
  run_with_progress "Removing all dependencies" "pnpm run clean:all" "true"
  local status=$?
  
  # Clear and redraw the UI after successful removal
  if [ $status -eq 0 ]; then
    clear
    draw_ascii_logo
    create_info_box "Dependencies removed successfully." \
                    "You can reinstall them again to restart Snak."
  fi
  
  return $status
}

# Validates that all required tools and dependencies are available
check_prerequisites() {
  # Check if node_modules exists
  if [ ! -d "node_modules" ]; then
    echo -e "\n${YELLOW}Dependencies not found. What would you like to do?${NC}"
    echo ""
    select_option "Install dependencies" "Quit"
    local choice=$?
    
    if [ $choice -eq 0 ]; then
      install_dependencies
    else
      echo -e "${RED}Installation cancelled. Startup will fail.${NC}"
      clear
      exit 1
    fi
  fi
  
  # Verify lerna and turbo availability
  if ! check_command lerna || ! check_command turbo; then
    # Try to add local node_modules/.bin to PATH
    export PATH="$PATH:$(pwd)/node_modules/.bin"
    
    # Check again after PATH update
    if ! check_command lerna || ! check_command turbo; then
      echo -e "${RED}${BOLD}Required tools (lerna/turbo) not available.${NC}"
      echo ""
      select_option "Install dependencies" "Quit"
      local choice=$?
      
      if [ $choice -eq 0 ]; then
        install_dependencies
        # Refresh PATH after installation
        export PATH="$PATH:$(pwd)/node_modules/.bin"
      else
        echo -e "${RED}Installation cancelled. Startup will fail.${NC}"
        exit 1
      fi
    fi
  fi
}

# Launches the interactive Snak agent engine
run_interactive_command() {
  echo -e "\n${CYAN}${BOLD}Launching Snak...${NC}\n"
  
  # Launch lerna command directly to maintain proper terminal IO handling
  lerna run --scope @starknet-agent-kit/agents start -- || return $?
  
  # Return success
  return 0
}

# ----- UI FUNCTIONS -----

# Renders the Snak logo
draw_ascii_logo() {
  echo -e "\n"
  echo -e "${BOLD}${CYAN}   _____             __                ${NC}"
  echo -e "${BOLD}${CYAN}  / ___/____  ____ _/ /__              ${NC}"
  echo -e "${BOLD}${CYAN}  \\__ \\/ __ \\/ __ \`/ //_/              ${NC}"
  echo -e "${BOLD}${CYAN} ___/ / / / / /_/ / ,<                 ${NC}"
  echo -e "${BOLD}${CYAN}/____/_/ /_/\\__,_/_/|_|                ${NC}"
  echo -e "${BOLD}${CYAN}                                       ${NC}"
  echo -e "${CYAN}${DIM}v0.0.11 by ${NC}${CYAN}Kasar${NC}                   "
}

# Creates a styled information box
# Arguments: Main text, Subtext (optional)
create_info_box() {
  local text=$1
  local subtext=$2
  
  # Calculate box dimensions based on terminal width
  local term_width=$(tput cols)
  local max_width=80  # Maximum width
  
  # Use terminal width or max_width, whichever is smaller
  local box_width=$((term_width < max_width ? term_width : max_width))
  
  # Account for border characters
  local inner_width=$((box_width - 2))
  
  # Create horizontal border
  local horizontal_line=$(printf '%*s' "$inner_width" | tr ' ' '─')
  
  # Draw top border
  echo -e "${CYAN}╭${horizontal_line}╮${NC}"
  
  # Calculate padding for main text
  local text_length=${#text}
  local padding_spaces=$((inner_width - text_length))
  local left_padding=1
  local right_padding=$((padding_spaces - left_padding))
  
  # Draw main text with padding
  printf "${CYAN}│${NC}%${left_padding}s${YELLOW}%s${NC}%${right_padding}s${CYAN}│${NC}\n" "" "$text" ""
  
  # Draw middle border
  echo -e "${CYAN}├${horizontal_line}┤${NC}"
  
  # Draw subtext if provided
  if [ -n "$subtext" ]; then
    local subtext_length=${#subtext}
    local subtext_padding=$((inner_width - subtext_length))
    local subtext_left_padding=1
    local subtext_right_padding=$((subtext_padding - subtext_left_padding))
    
    printf "${CYAN}│${NC}%${subtext_left_padding}s%s%${subtext_right_padding}s${CYAN}│${NC}\n" "" "$subtext" ""
  fi
  
  # Draw bottom border
  echo -e "${CYAN}╰${horizontal_line}╯${NC}"
}

# ----- MAIN PROGRAM -----

main() {
  # Clear screen for clean UI
  clear
  
  # Display logo and welcome message
  draw_ascii_logo
  
  create_info_box "Welcome to Snak, an advanced Agent engine powered by Starknet." \
                  "For more informations, visit our documentation at https://docs.snakagent.com"

  # Verify dependencies and tools
  check_prerequisites
  
  # Present main options
  echo -e "\n${YELLOW}What would you like to do?${NC}"
  echo ""
  select_option "Launch Snak Engine" "Remove dependencies" "Quit"
  local choice=$?
  
  if [ $choice -eq 1 ]; then
    # Remove dependencies
    remove_dependencies
    exit 0
  elif [ $choice -eq 2 ]; then
    clear
    exit 0
  fi
  
  # Build packages
  if ! run_with_progress "Building packages" "turbo build" "true"; then
    exit 1
  fi

  # Launch interactive mode
  run_interactive_command
  local status=$?
  
  # Show final status
  if [ $status -eq 0 ]; then
    echo -e "\n${GREEN}${BOLD}✓ SNAK started successfully!${NC}\n"
  else
    echo -e "\n${RED}${BOLD}✗ SNAK could not start correctly.${NC}\n"
    exit $status
  fi
}

# Execute main program
main