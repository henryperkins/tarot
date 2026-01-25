#!/bin/bash

# Test script for Tarot Astro Plugins MCP servers

echo "🧪 Testing Tarot Astro Plugins MCP Servers"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test if a command succeeds
test_command() {
    local description=$1
    local command=$2

    echo -n "Testing: $description... "

    if eval $command > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Check Node.js is installed
echo "Prerequisites:"
test_command "Node.js is installed" "command -v node"
test_command "npm is installed" "command -v npm"
echo ""

# Check dependencies are installed
echo "Dependencies:"
test_command "Ephemeris server has node_modules" "test -d ephemeris-server/node_modules"
test_command "Symbolism server has node_modules" "test -d symbolism-server/node_modules"
test_command "sweph is installed" "test -d ephemeris-server/node_modules/sweph"
test_command "MCP SDK is installed (ephemeris)" "test -d ephemeris-server/node_modules/@modelcontextprotocol"
test_command "MCP SDK is installed (symbolism)" "test -d symbolism-server/node_modules/@modelcontextprotocol"
echo ""

# Check file structure
echo "File Structure:"
test_command "Marketplace manifest exists" "test -f .claude-plugin/marketplace.json"
test_command "Ephemeris plugin manifest exists" "test -f ephemeris-server/.claude-plugin/plugin.json"
test_command "Ephemeris MCP config exists" "test -f ephemeris-server/.mcp.json"
test_command "Ephemeris server code exists" "test -f ephemeris-server/server/index.js"
test_command "Ephemeris calculations exist" "test -f ephemeris-server/server/ephemeris.js"
test_command "Symbolism plugin manifest exists" "test -f symbolism-server/.claude-plugin/plugin.json"
test_command "Symbolism MCP config exists" "test -f symbolism-server/.mcp.json"
test_command "Symbolism server code exists" "test -f symbolism-server/server/index.js"
test_command "Symbolism database exists" "test -f symbolism-server/server/database.js"
test_command "Symbol data file exists" "test -f symbolism-server/data/symbols.json"
echo ""

# Check custom commands
echo "Custom Commands:"
test_command "Astro-reading command exists" "test -f ephemeris-server/commands/astro-reading.md"
test_command "Symbol-analysis command exists" "test -f symbolism-server/commands/symbol-analysis.md"
echo ""

# Check JSON files are valid
echo "JSON Validation:"
test_command "Marketplace JSON is valid" "node -e 'require(\"./.claude-plugin/marketplace.json\")'"
test_command "Ephemeris plugin JSON is valid" "node -e 'require(\"./ephemeris-server/.claude-plugin/plugin.json\")'"
test_command "Ephemeris MCP JSON is valid" "node -e 'require(\"./ephemeris-server/.mcp.json\")'"
test_command "Symbolism plugin JSON is valid" "node -e 'require(\"./symbolism-server/.claude-plugin/plugin.json\")'"
test_command "Symbolism MCP JSON is valid" "node -e 'require(\"./symbolism-server/.mcp.json\")'"
test_command "Symbol database JSON is valid" "node -e 'require(\"./symbolism-server/data/symbols.json\")'"
echo ""

# Test symbol database content
echo "Symbol Database Content:"
test_command "Animals category exists" "node -e 'const db = require(\"./symbolism-server/data/symbols.json\"); if (!db.animals) process.exit(1)'"
test_command "Colors category exists" "node -e 'const db = require(\"./symbolism-server/data/symbols.json\"); if (!db.colors) process.exit(1)'"
test_command "Numbers category exists" "node -e 'const db = require(\"./symbolism-server/data/symbols.json\"); if (!db.numbers) process.exit(1)'"
test_command "Elements category exists" "node -e 'const db = require(\"./symbolism-server/data/symbols.json\"); if (!db.elements) process.exit(1)'"
test_command "Plants category exists" "node -e 'const db = require(\"./symbolism-server/data/symbols.json\"); if (!db.plants) process.exit(1)'"
test_command "Celestial category exists" "node -e 'const db = require(\"./symbolism-server/data/symbols.json\"); if (!db.celestial) process.exit(1)'"
echo ""

# Summary
echo "=========================================="
echo "Test Summary:"
echo -e "  ${GREEN}Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "  ${RED}Failed: $TESTS_FAILED${NC}"
else
    echo -e "  ${GREEN}Failed: $TESTS_FAILED${NC}"
fi
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed! Plugins are ready to use.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Start Claude Code: claude"
    echo "2. Add marketplace: /plugin marketplace add ./plugins/tarot-astro-plugins"
    echo "3. Install plugins: /plugin install ephemeris-server@tarot-astro-plugins"
    echo "                    /plugin install symbolism-server@tarot-astro-plugins"
    echo "4. Restart Claude Code"
    echo "5. Test with: /astro-reading and /symbol-analysis"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please review the errors above.${NC}"
    exit 1
fi
