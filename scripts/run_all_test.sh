#!/bin/bash

DEVNET_PORT=5050
DEVNET_SEED=42
DEVNET_ACCOUNTS=3
DEVNET_ACCOUNT_CLASS='cairo1'
DEVNET_INITIAL_BALANCE='10000000000000000000000'
FORK_NETWORK='https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_7/Xj-rCxxzGcBnS3HwqOnBqO8TMa8NRGky'

cleanup() {
    echo "🛑 Stopping server..."
    kill -9 $SERVER_PID 2>/dev/null
    lsof -ti:${DEVNET_PORT} | xargs -r kill -9
    echo "🧹 Port ${DEVNET_PORT} cleaned"
    exit 0
}

if ! command -v starknet-devnet &> /dev/null; then
    echo "❌ starknet-devnet not installed"
    exit 1
fi

wait_for_port() {
    echo "⏳ Waiting for server to be ready..."
    while ! lsof -i tcp:${DEVNET_PORT} > /dev/null 2>&1; do
        sleep 0.1
    done
    echo "✅ Server is ready!"
}

launch_server() {
    echo "🚀 Starting starknet-devnet..."
    starknet-devnet \
        --fork-network "$FORK_NETWORK" \
        --port "$DEVNET_PORT" \
        --seed "$DEVNET_SEED" \
        --accounts "$DEVNET_ACCOUNTS" \
        --account-class "$DEVNET_ACCOUNT_CLASS" \
        --initial-balance "$DEVNET_INITIAL_BALANCE"
}

run_tests() {
    local iterations=${1:-2}
    local log_file="test-results.log"
    
    wait_for_port
    
    > "$log_file"
    echo "🧪 Running tests $iterations times..."
    
    for i in $(seq 1 "$iterations"); do
        echo "🔄 Run $i - $(date '+%H:%M:%S')" >> "$log_file"
        pnpm start:test
        echo "" >> "$log_file"
    done
    
    FAIL_COUNT=$(grep -c "✕" "$log_file")
    
    echo "📊 ----------------------------------------" >> "$log_file"
    echo "❗ Total failed tests: $FAIL_COUNT" >> "$log_file"
    echo "✅ Tests executed $iterations times" >> "$log_file"
    
    echo "📊 ----------------------------------------"
    echo "❗ Total failed tests: $FAIL_COUNT"
    echo "✅ Tests executed $iterations times"
}

ITERATIONS=${1:-2}

trap cleanup SIGINT SIGTERM EXIT

launch_server &
SERVER_PID=$!

run_tests "$ITERATIONS"