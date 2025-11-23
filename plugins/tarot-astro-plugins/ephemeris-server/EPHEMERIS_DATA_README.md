# Swiss Ephemeris Data Files

This server requires Swiss Ephemeris data files for astronomical calculations.

## Quick Setup

### Option 1: Download Essential Files (Recommended)

Download the minimal required files for planetary calculations:

```bash
# Create data directory
mkdir -p /home/azureuser/tarot/plugins/tarot-astro-plugins/ephemeris-server/ephe

# Download essential planetary files (planets 1800-2400)
cd /home/azureuser/tarot/plugins/tarot-astro-plugins/ephemeris-server/ephe
curl -O https://www.astro.com/ftp/swisseph/ephe/sepl_18.se1
curl -O https://www.astro.com/ftp/swisseph/ephe/semo_18.se1

# Or use wget
wget https://www.astro.com/ftp/swisseph/ephe/sepl_18.se1
wget https://www.astro.com/ftp/swisseph/ephe/semo_18.se1
```

### Option 2: Download Complete Dataset

For extended date ranges and asteroid support:

```bash
# Download all files (warning: ~200MB)
cd /home/azureuser/tarot/plugins/tarot-astro-plugins/ephemeris-server/ephe
wget -r -np -nH --cut-dirs=3 -R "index.html*" https://www.astro.com/ftp/swisseph/ephe/
```

## File Types

### Essential Files (Required)

- **sepl_18.se1** - Planets 1800-2400 AD (main planets, ~3MB)
- **semo_18.se1** - Moon 1800-2400 AD (~8MB)

### Extended Files (Optional)

- **sepl_*.se1** - Planets for different date ranges:
  - sepl_00.se1: 0-600 AD
  - sepl_06.se1: 600-1200 AD
  - sepl_12.se1: 1200-1800 AD
  - sepl_24.se1: 2400-3000 AD

- **seas_18.se1** - Asteroids 1800-2400 AD (for asteroid calculations)

## Configuration

The server automatically looks for data files in:

1. `./ephe` (relative to server directory)
2. `./ephemeris-server/ephe` (plugin root)
3. `/usr/share/swisseph` (system-wide)
4. Environment variable: `SE_EPHE_PATH`

You can override the path by setting the environment variable:

```bash
export SE_EPHE_PATH=/path/to/your/ephe/files
```

Or in the `.mcp.json` configuration:

```json
{
  "mcpServers": {
    "ephemeris": {
      "type": "stdio",
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server/index.js"],
      "env": {
        "SE_EPHE_PATH": "${CLAUDE_PLUGIN_ROOT}/ephe"
      }
    }
  }
}
```

## Verifying Installation

After downloading the files, test the server:

```bash
# Navigate to plugin directory
cd /home/azureuser/tarot/plugins/tarot-astro-plugins/ephemeris-server

# Run the server test
npm test
```

You should see planetary positions calculated successfully.

## Date Ranges

Each file covers a specific date range:

| File Range | Dates Covered | File Prefix |
|------------|---------------|-------------|
| _00 | 0 - 600 AD | sepl_00, semo_00 |
| _06 | 600 - 1200 AD | sepl_06, semo_06 |
| _12 | 1200 - 1800 AD | sepl_12, semo_12 |
| _18 | 1800 - 2400 AD | sepl_18, semo_18 |
| _24 | 2400 - 3000 AD | sepl_24, semo_24 |

For tarot readings, **sepl_18.se1 and semo_18.se1** cover all modern dates (1800-2400).

## Troubleshooting

### "Ephemeris file not found" error

1. Check that files are downloaded:
   ```bash
   ls -lh ephe/
   ```

2. Verify file permissions:
   ```bash
   chmod 644 ephe/*.se1
   ```

3. Set explicit path:
   ```bash
   export SE_EPHE_PATH=/home/azureuser/tarot/plugins/tarot-astro-plugins/ephemeris-server/ephe
   ```

### Wrong date range

Download the appropriate file for your date range (see table above).

### Asteroid calculations failing

Download the asteroid ephemeris files (seas_*.se1).

## Sources

- **Swiss Ephemeris Data**: https://www.astro.com/ftp/swisseph/ephe/
- **Documentation**: https://www.astro.com/swisseph/
- **GitHub Repository**: https://github.com/aloistr/swisseph

## License

Swiss Ephemeris data files are based on JPL planetary ephemeris data (public domain)
and are distributed under the same license as the Swiss Ephemeris library (AGPL-3.0
or Professional License).

See the main LICENSE file for complete licensing information.
