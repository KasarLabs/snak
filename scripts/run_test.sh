#!/bin/bash

DEVNET_PORT=5050
DEVNET_SEED=42
DEVNET_ACCOUNTS=3
DEVNET_ACCOUNT_CLASS='cairo1'
DEVNET_INITIAL_BALANCE='10000000000000000000000'
FORK_NETWORK='https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/m_hRudwSAjlmKxI-Y5RwVD3Wmkj5AwTV'

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

run_single_test() {
    local test_name=$1
    local iterations=${2:-1}
    local log_file="test-results.log"
    
    if [ -z "$test_name" ]; then
        echo "❌ Error: Test name is required"
        echo "Usage: $0 <test_name> [iterations]"
        exit 1
    fi
    
    wait_for_port
    
    > "$log_file"
    echo "🧪 Running test '$test_name' $iterations times..."
    
    for i in $(seq 1 "$iterations"); do
        echo "🔄 Run $i - $(date '+%H:%M:%S')" >> "$log_file"
        npx jest --verbose --runInBand --testTimeout=100000 --config=jest.config.js -t "$test_name" 2>&1 | tee -a "$log_file"
        echo "" >> "$log_file"
    done
    
    FAIL_COUNT=$(grep -c "✕" "$log_file")
    
    echo "📊 ----------------------------------------" >> "$log_file"
    echo "❗ Total failed runs: $FAIL_COUNT" >> "$log_file"
    echo "✅ Test executed $iterations times" >> "$log_file"
    
    echo "📊 ----------------------------------------"
    echo "❗ Total failed runs: $FAIL_COUNT"
    echo "✅ Test executed $iterations times"
}

# Check if test name is provided
if [ $# -lt 1 ]; then
    echo "❌ Error: Test name is required"
    echo "Usage: $0 <test_name> [iterations]"
    exit 1
fi

TEST_NAME=$1
ITERATIONS=${2:-1}

trap cleanup SIGINT SIGTERM EXIT

launch_server &
SERVER_PID=$!

run_single_test "$TEST_NAME" "$ITERATIONS"