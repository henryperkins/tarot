# Installation Guide

Quick installation guide for the Tarot Astro Plugins marketplace.

## Prerequisites

- Claude Code installed and running
- Node.js and npm installed on your system
- Basic command-line familiarity

## Step-by-Step Installation

### 1. Add the Marketplace

From your tarot project directory:

```bash
# Navigate to your project root
cd /home/azureuser/tarot

# Start Claude Code
claude

# In Claude Code, add the marketplace
/plugin marketplace add ./plugins/tarot-astro-plugins
```

### 2. Install the Plugins

```bash
# Install both plugins
/plugin install ephemeris-server@tarot-astro-plugins
/plugin install symbolism-server@tarot-astro-plugins
```

Select "Install now" when prompted for each plugin.

### 3. Install Dependencies and Download Ephemeris Files

Open a new terminal and run:

```bash
# Install ephemeris server dependencies
cd /home/azureuser/tarot/plugins/tarot-astro-plugins/ephemeris-server
npm install

# Download Swiss Ephemeris data files (required for calculations)
cd ephe
wget https://github.com/aloistr/swisseph/raw/master/ephe/sepl_18.se1
wget https://github.com/aloistr/swisseph/raw/master/ephe/semo_18.se1
cd ..

# Install symbolism server dependencies
cd ../symbolism-server
npm install
```

Expected output:
```
✅ Swiss Ephemeris data files found!
   Location: /home/azureuser/tarot/plugins/tarot-astro-plugins/ephemeris-server/ephe
   Files: sepl_18.se1, semo_18.se1

added 2 packages in 12s
```

**Note:** The ephemeris server uses Swiss Ephemeris, which requires data files for calculations. The `npm install` postinstall script will check for these files and provide guidance if they're missing.

### 4. Restart Claude Code

Exit and restart Claude Code to activate the MCP servers:

```bash
# Exit Claude Code
/exit

# Start again
claude
```

### 5. Verify Installation

Check that everything is working:

```bash
# Check plugins are installed
/plugin

# Check MCP servers are running
/mcp

# Try the custom commands
/astro-reading
/symbol-analysis The Fool
```

## Verification Checklist

✅ Marketplace appears in `/plugin marketplace list`
✅ Both plugins show as "Enabled" in `/plugin`
✅ Both MCP servers show as "Connected" in `/mcp`
✅ `/astro-reading` command is available
✅ `/symbol-analysis` command is available
✅ MCP tools are accessible (try asking "What's the current moon phase?")

## Troubleshooting

### Issue: Plugins not appearing

**Solution:**
```bash
# Verify marketplace was added correctly
/plugin marketplace list

# If not listed, re-add the marketplace
/plugin marketplace add ./plugins/tarot-astro-plugins
```

### Issue: MCP servers not connecting

**Solution:**
```bash
# Check that dependencies are installed
cd /home/azureuser/tarot/plugins/tarot-astro-plugins/ephemeris-server
ls node_modules

# If empty, run:
npm install

# Do the same for symbolism-server
cd ../symbolism-server
npm install

# Restart Claude Code
```

### Issue: "astronomy-engine not found"

**Solution:**
```bash
# Reinstall dependencies
cd /home/azureuser/tarot/plugins/tarot-astro-plugins/ephemeris-server
rm -rf node_modules
npm install
```

### Issue: Commands not working

**Solution:**
```bash
# Verify plugins are enabled
/plugin

# If disabled, enable them:
/plugin enable ephemeris-server@tarot-astro-plugins
/plugin enable symbolism-server@tarot-astro-plugins

# Restart Claude Code
```

## Testing the Installation

Try these commands to ensure everything works:

### Test Ephemeris Server

```bash
# Ask for current planetary positions
> "What are the current planetary positions?"

# Use the astro-reading command
/astro-reading

# Ask about moon phase
> "What's today's moon phase and what does it mean?"
```

Expected: Claude should use the ephemeris MCP tools to provide real astronomical data.

### Test Symbolism Server

```bash
# Use the symbol-analysis command
/symbol-analysis The Magician

# Ask about a specific symbol
> "What does the serpent symbolize in tarot?"

# Search for related symbols
> "Find all symbols related to transformation"
```

Expected: Claude should use the symbolism MCP tools to provide detailed symbol meanings.

### Test Integration

```bash
# Ask for a reading with both contexts
> "I'd like a one-card reading. Please include current astrological
   context and analyze the symbols in the card that comes up."
```

Expected: Claude should use both servers together to provide a rich, contextual reading.

## Next Steps

Once installed successfully:

1. **Explore the documentation**: See README.md for full feature documentation
2. **Try the slash commands**: `/astro-reading` and `/symbol-analysis`
3. **Integrate with readings**: Ask Claude to include cosmic context in your spreads
4. **Customize**: Add your own symbols or modify interpretations as needed

## Uninstallation

To remove the plugins:

```bash
# Uninstall both plugins
/plugin uninstall ephemeris-server@tarot-astro-plugins
/plugin uninstall symbolism-server@tarot-astro-plugins

# Remove the marketplace (optional)
/plugin marketplace remove tarot-astro-plugins
```

## Getting Help

If you encounter issues not covered here:

1. Check the main README.md for detailed documentation
2. Run `claude --debug` to see detailed error logs
3. Verify Node.js and npm are properly installed: `node --version && npm --version`
4. Check file permissions on the plugin directories

---

**Installation complete!** You're now ready to enhance your tarot readings with cosmic wisdom. ✨
