# Configuration Files

This directory contains configuration examples and templates for the Forminator fraud detection system.

## Files

### `fraud-config.example.json`

Complete fraud detection configuration example showing all available options with default values.

**Usage:**
1. Review the example to understand available configuration options
2. Create a partial override JSON with only the values you want to change
3. Set via environment variable:
   ```bash
   # Using wrangler secret
   echo '{"risk":{"blockThreshold":80}}' | wrangler secret put FRAUD_CONFIG

   # Using Cloudflare dashboard
   Workers & Pages → forminator → Settings → Variables → Add Variable
   Name: FRAUD_CONFIG
   Value: {"risk":{"blockThreshold":80}}
   ```

**Documentation:** See [../docs/CONFIGURATION-SYSTEM.md](../docs/CONFIGURATION-SYSTEM.md) for complete configuration guide.

## Configuration Features

✅ **Deep Merge** - Specify only values you want to change, rest use defaults
✅ **Type-Safe** - Full TypeScript validation
✅ **Environment-Based** - Deploy different configs per environment
✅ **Zero Hardcoded Values** - All thresholds configurable
✅ **API Exposure** - Frontend access via `/api/config` endpoint

## Example Configurations

### Lenient (Lower False Positives)
```json
{
  "risk": {
    "blockThreshold": 80
  },
  "detection": {
    "ephemeralIdSubmissionThreshold": 3,
    "validationFrequencyBlockThreshold": 5
  }
}
```

### Strict (Higher Security)
```json
{
  "risk": {
    "blockThreshold": 60
  },
  "detection": {
    "ephemeralIdSubmissionThreshold": 1,
    "validationFrequencyBlockThreshold": 2
  }
}
```

### Development/Testing
```json
{
  "risk": {
    "blockThreshold": 90
  },
  "detection": {
    "ephemeralIdSubmissionThreshold": 10,
    "validationFrequencyBlockThreshold": 10
  }
}
```
