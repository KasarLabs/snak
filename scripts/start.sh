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

# Global variables
declare SELECTED_AGENT_CONFIG="default.agent.json"
declare SELECTED_MODELS_CONFIG="default.models.json"

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
select_option() {
  local options=("$@")
  local selected=0
  local ESC=$(printf '\033')
  
  tput civis  # Hide cursor
  
  while true; do
    # Print options with selected one highlighted
    for i in "${!options[@]}"; do
      if [ $i -eq $selected ]; then
        echo -e "${CYAN}${BOLD}❯ ${options[$i]}${NC}"
      else
        echo -e "  ${options[$i]}"
      fi
    done
    
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
  
  tput cnorm  # Restore cursor
  
  return $selected
}

# Renders a progress bar with percentage
progress_bar() {
  local progress=$1
  local message=$2
  local width=50
  local bar_width=$((progress * width / 100))
  
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
run_with_progress() {
  local message=$1
  local command=$2
  local show_logs_on_error=${3:-"false"}
  
  progress_bar 0 "$message"
  
  eval "$command" > "$LOG_FILE" 2>&1 &
  local pid=$!
  
  local progress=0
  while kill -0 $pid 2>/dev/null; do
    progress_bar $progress "$message"
    sleep 0.1
    progress=$((progress + 1))
    if [ $progress -ge 99 ]; then
      progress=99
    fi
  done
  
  wait $pid
  local status=$?
  
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
  
  if ! check_command pnpm; then
    echo -e "${RED}pnpm is not installed. Installation required.${NC}"
    echo -e "You can install it with: npm install -g pnpm"
    exit 1
  fi
  
  run_with_progress "Installing modules" "pnpm install" "true"
  local status=$?
  
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
  
  run_with_progress "Removing all dependencies" "pnpm run clean:all" "true"
  local status=$?
  
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
  # Select agent configuration first
  select_agent_config
  local agent_config_status=$?
  
  if [ $agent_config_status -ne 0 ]; then
    echo -e "\n${RED}${BOLD}✗ Agent configuration selection failed.${NC}\n"
    return $agent_config_status
  fi

  # Select models configuration
  select_models_config
  local models_config_status=$?
  
  if [ $models_config_status -ne 0 ]; then
    echo -e "\n${RED}${BOLD}✗ Models configuration selection failed.${NC}\n"
    return $models_config_status
  fi
  
  echo -e "\n${CYAN}${BOLD}Launching Snak...${NC}\n"
  
  # Pass both --agent and --models arguments
  lerna run --scope @starknet-agent-kit/agents start -- --agent="${SELECTED_AGENT_CONFIG}" --models="${SELECTED_MODELS_CONFIG}" || return $?
  
  return 0
}

select_agent_config() {
  # Clear screen before displaying agent configs
  clear
  draw_ascii_logo
  create_info_box "Welcome to Snak, an advanced Agent engine powered by Starknet." \
                  "For more informations, visit our documentation at https://docs.snakagent.com"
                  
  local config_dir="./config/agents"
  local available_configs=()
  
  if [ ! -d "$config_dir" ]; then
    echo -e "${RED}Config directory not found: $config_dir${NC}"
    return 1
  fi
  
  # Collect available configurations
  for config in "$config_dir"/*.agent.json; do
    if [ -f "$config" ]; then
      local config_name=$(basename "$config" .agent.json)
      available_configs+=("$config_name")
    fi
  done
  
  # Function to get autocompleted suggestion based on current input
  get_suggestion() {
    local input=$1
    local suggestion=""
    
    if [ -n "$input" ]; then
      for config in "${available_configs[@]}"; do
        if [[ "$config" == "$input"* ]]; then
          suggestion="${config:${#input}}"
          break
        fi
      done
    fi
    
    echo "$suggestion"
  }
  
  echo -e "\n${YELLOW}Enter the name of the Agent configuration to use (without .agent.json extension):${NC}"
  echo -e "\n${YELLOW}You can also create a custom configuration.${NC}"
  echo -e "${DIM}For more information, visit: https://docs.starkagent.ai/customize-your-agent${NC}"

  local input=""
  local key=""
  
  # Save terminal settings
  local old_settings=$(stty -g)
  
  # Set terminal to raw mode
  stty raw -echo min 1
  
  while true; do
    # Display prompt with current input and suggestion
    echo -en "\r\033[K> ${input}${DIM}$(get_suggestion "$input")${NC}"
    
    key=$(dd bs=1 count=1 2> /dev/null)
    
    # Handle Enter key
    if [ "$key" = $'\r' ] || [ "$key" = $'\n' ]; then
      echo ""
      break
    fi
    
    # Handle backspace or delete
    if [ "$key" = $'\177' ] || [ "$key" = $'\b' ]; then
      if [ ${#input} -gt 0 ]; then
        input="${input:0:${#input}-1}"
      fi
      continue
    fi
    
    # Handle tab for autocomplete
    if [ "$key" = $'\t' ]; then
      suggestion=$(get_suggestion "$input")
      if [ -n "$suggestion" ]; then
        input="$input$suggestion"
      fi
      continue
    fi
    
    # Handle Ctrl+C to exit
    if [ "$key" = $'\3' ]; then
      stty "$old_settings"  # Restore terminal settings
      echo -e "\n${RED}Cancelled.${NC}"
      exit 1
    fi
    
    # Add printable characters to input
    if [[ "$key" =~ [[:print:]] ]]; then
      input="$input$key"
    fi
  done
  
  # Restore terminal settings
  stty "$old_settings"
  
  # Validate input
  if [ -z "$input" ]; then
    echo -e "${YELLOW}No configuration specified. Using default configuration.${NC}"
    SELECTED_AGENT_CONFIG="default.agent.json"
    
    clear
    draw_ascii_logo
    create_info_box "Welcome to Snak, an advanced Agent engine powered by Starknet." \
                    "For more informations, visit our documentation at https://docs.snakagent.com"
    return 0
  fi
  
  # Add extension if not present
  local config_file="${input}.agent.json"
  
  # Check if config exists
  if [ -f "$config_dir/$config_file" ]; then
    echo -e "${GREEN}Configuration found: ${config_file}${NC}"
    SELECTED_AGENT_CONFIG="$config_file"
    
    clear
    draw_ascii_logo
    create_info_box "Welcome to Snak, an advanced Agent engine powered by Starknet." \
                    "For more informations, visit our documentation at https://docs.snakagent.com"
    return 0
  else
    echo -e "${RED}Configuration not found: ${config_file}${NC}"
    echo -e "${YELLOW}Would you like to create this configuration? (y/n)${NC}"
    read -r -p "> " create_config
    
    if [[ "$create_config" =~ ^[Yy]$ ]]; then
      echo -e "${YELLOW}Please create your configuration file at: $config_dir/$config_file${NC}"
      echo -e "${DIM}For assistance, visit: https://docs.starkagent.ai/customize-your-agent${NC}"
      echo -e "${YELLOW}Press Enter when you're done...${NC}"
      read -r
      
      # Check if config was created
      if [ -f "$config_dir/$config_file" ]; then
        echo -e "${GREEN}Configuration created successfully: ${config_file}${NC}"
        SELECTED_AGENT_CONFIG="$config_file"
        
        clear
        draw_ascii_logo
        create_info_box "Welcome to Snak, an advanced Agent engine powered by Starknet." \
                      "For more informations, visit our documentation at https://docs.snakagent.com"
        return 0
      else
        echo -e "${RED}Configuration wasn't created. Using default configuration.${NC}"
        SELECTED_AGENT_CONFIG="default.agent.json"
        
        clear
        draw_ascii_logo
        create_info_box "Welcome to Snak, an advanced Agent engine powered by Starknet." \
                      "For more informations, visit our documentation at https://docs.snakagent.com"
        return 0
      fi
    else
      echo -e "${YELLOW}Using default configuration.${NC}"
      SELECTED_AGENT_CONFIG="default.agent.json"

      clear
      draw_ascii_logo
      create_info_box "Welcome to Snak, an advanced Agent engine powered by Starknet." \
                    "For more informations, visit our documentation at https://docs.snakagent.com"
      return 0
    fi
  fi
}

select_models_config() {
  # Clear screen before displaying models configs
  clear
  draw_ascii_logo
  create_info_box "Welcome to Snak, an advanced Agent engine powered by Starknet." \
                  "For more informations, visit our documentation at https://docs.snakagent.com"
                  
  local config_dir="./config/models"
  local available_configs=()
  
  if [ ! -d "$config_dir" ]; then
    echo -e "${RED}Models config directory not found: $config_dir${NC}"
    return 1
  fi
  
  # Collect available configurations
  for config in "$config_dir"/*.models.json; do
    if [ -f "$config" ]; then
      local config_name=$(basename "$config" .models.json)
      available_configs+=("$config_name")
    fi
  done
  
  # Function to get autocompleted suggestion based on current input
  get_suggestion() {
    local input=$1
    local suggestion=""
    
    if [ -n "$input" ]; then
      for config in "${available_configs[@]}"; do
        if [[ "$config" == "$input"* ]]; then
          suggestion="${config:${#input}}"
          break
        fi
      done
    fi
    
    echo "$suggestion"
  }
  
  echo -e "\n${YELLOW}Enter the name of the Models configuration to use (without .models.json extension):${NC}"
  echo -e "\n${YELLOW}You can also create a custom configuration.${NC}"
  echo -e "${DIM}For more information, visit: https://docs.starkagent.ai/customize-your-models${NC}"

  local input=""
  local key=""
  
  # Save terminal settings
  local old_settings=$(stty -g)
  
  # Set terminal to raw mode
  stty raw -echo min 1
  
  while true; do
    # Display prompt with current input and suggestion
    echo -en "\r\033[K> ${input}${DIM}$(get_suggestion "$input")${NC}"
    
    key=$(dd bs=1 count=1 2> /dev/null)
    
    # Handle Enter key
    if [ "$key" = $'\r' ] || [ "$key" = $'\n' ]; then
      echo ""
      break
    fi
    
    # Handle backspace or delete
    if [ "$key" = $'\177' ] || [ "$key" = $'\b' ]; then
      if [ ${#input} -gt 0 ]; then
        input="${input:0:${#input}-1}"
      fi
      continue
    fi
    
    # Handle tab for autocomplete
    if [ "$key" = $'\t' ]; then
      suggestion=$(get_suggestion "$input")
      if [ -n "$suggestion" ]; then
        input="$input$suggestion"
      fi
      continue
    fi
    
    # Handle Ctrl+C to exit
    if [ "$key" = $'\3' ]; then
      stty "$old_settings"  # Restore terminal settings
      echo -e "\n${RED}Cancelled.${NC}"
      exit 1
    fi
    
    # Add printable characters to input
    if [[ "$key" =~ [[:print:]] ]]; then
      input="$input$key"
    fi
  done
  
  # Restore terminal settings
  stty "$old_settings"
  
  # Validate input
  if [ -z "$input" ]; then
    echo -e "${YELLOW}No models configuration specified. Using default configuration.${NC}"
    SELECTED_MODELS_CONFIG="default.models.json"
    
    clear
    draw_ascii_logo
    create_info_box "Welcome to Snak, an advanced Agent engine powered by Starknet." \
                    "For more informations, visit our documentation at https://docs.snakagent.com"
    return 0
  fi
  
  # Add extension if not present
  local config_file="${input}.models.json"
  
  # Check if config exists
  if [ -f "$config_dir/$config_file" ]; then
    echo -e "${GREEN}Models configuration found: ${config_file}${NC}"
    SELECTED_MODELS_CONFIG="$config_file"
    
    clear
    draw_ascii_logo
    create_info_box "Welcome to Snak, an advanced Agent engine powered by Starknet." \
                    "For more informations, visit our documentation at https://docs.snakagent.com"
    return 0
  else
    echo -e "${RED}Models configuration not found: ${config_file}${NC}"
    echo -e "${YELLOW}Would you like to create this configuration? (y/n)${NC}"
    read -r -p "> " create_config
    
    if [[ "$create_config" =~ ^[Yy]$ ]]; then
      echo -e "${YELLOW}Please create your models configuration file at: $config_dir/$config_file${NC}"
      echo -e "${DIM}For assistance, visit: https://docs.starkagent.ai/customize-your-models${NC}"
      echo -e "${YELLOW}Press Enter when you're done...${NC}"
      read -r
      
      # Check if config was created
      if [ -f "$config_dir/$config_file" ]; then
        echo -e "${GREEN}Models configuration created successfully: ${config_file}${NC}"
        SELECTED_MODELS_CONFIG="$config_file"
        
        clear
        draw_ascii_logo
        create_info_box "Welcome to Snak, an advanced Agent engine powered by Starknet." \
                      "For more informations, visit our documentation at https://docs.snakagent.com"
        return 0
      else
        echo -e "${RED}Models configuration wasn't created. Using default configuration.${NC}"
        SELECTED_MODELS_CONFIG="default.models.json"
        
        clear
        draw_ascii_logo
        create_info_box "Welcome to Snak, an advanced Agent engine powered by Starknet." \
                      "For more informations, visit our documentation at https://docs.snakagent.com"
        return 0
      fi
    else
      echo -e "${YELLOW}Using default models configuration.${NC}"
      SELECTED_MODELS_CONFIG="default.models.json"

      clear
      draw_ascii_logo
      create_info_box "Welcome to Snak, an advanced Agent engine powered by Starknet." \
                    "For more informations, visit our documentation at https://docs.snakagent.com"
      return 0
    fi
  fi
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
create_info_box() {
  local text=$1
  local subtext=$2
  
  # Calculate box dimensions based on terminal width
  local term_width=$(tput cols)
  local max_width=80
  local box_width=$((term_width < max_width ? term_width : max_width))
  local inner_width=$((box_width - 2))
  
  # Create horizontal border
  local horizontal_line=$(printf '%*s' "$inner_width" | tr ' ' '─')
  
  # Draw borders and content
  echo -e "${CYAN}╭${horizontal_line}╮${NC}"
  
  local text_length=${#text}
  local padding_spaces=$((inner_width - text_length))
  local left_padding=1
  local right_padding=$((padding_spaces - left_padding))
  
  printf "${CYAN}│${NC}%${left_padding}s${YELLOW}%s${NC}%${right_padding}s${CYAN}│${NC}\n" "" "$text" ""
  echo -e "${CYAN}├${horizontal_line}┤${NC}"
  
  if [ -n "$subtext" ]; then
    local subtext_length=${#subtext}
    local subtext_padding=$((inner_width - subtext_length))
    local subtext_left_padding=1
    local subtext_right_padding=$((subtext_padding - subtext_left_padding))
    
    printf "${CYAN}│${NC}%${subtext_left_padding}s%s%${subtext_right_padding}s${CYAN}│${NC}\n" "" "$subtext" ""
  fi
  
  echo -e "${CYAN}╰${horizontal_line}╯${NC}"
}

# ----- MAIN PROGRAM -----

main() {
  clear
  
  draw_ascii_logo
  create_info_box "Welcome to Snak, an advanced Agent engine powered by Starknet." \
                  "For more informations, visit our documentation at https://docs.snakagent.com"

  check_prerequisites
  
  echo -e "\n${YELLOW}What would you like to do?${NC}"
  echo ""
  select_option "Launch Snak Engine" "Remove dependencies" "Quit"
  local choice=$?
  
  if [ $choice -eq 1 ]; then
    remove_dependencies
    exit 0
  elif [ $choice -eq 2 ]; then
    clear
    exit 0
  fi
  
  if ! run_with_progress "Building packages" "turbo build" "true"; then
    exit 1
  fi

  run_interactive_command
  local status=$?
  
  if [ $status -eq 0 ]; then
    echo -e "\n${GREEN}${BOLD}Snak runned successfully!${NC}\n"
  else
    echo -e "\n${RED}${BOLD}Snak could not run correctly.${NC}\n"
    exit $status
  fi
}

# Execute main program
main