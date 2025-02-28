#!/bin/bash

if [ -z "$1" ]; then
  echo "Error: Plugin name is required"
  echo "Usage: ./build-plugin.sh <plugin-name>"
  exit 1
fi

lerna run build --scope @starknet-agent-kit/$1