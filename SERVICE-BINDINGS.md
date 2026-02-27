# Akamai Service Binding Configuration

This document outlines the service binding configuration for the Akamai integration in the Currency Converter API.

## Critical Prerequisite

**The `akamai-service` must exist in your Cloudflare account before deployment.** Service bindings reference existing services; they do NOT auto-create services.

To create the service:
1. Go to Cloudflare Dashboard > Workers & Pages > Services
2. Create a new service named `akamai-service`
3. Deploy your Akamai worker code to this service

## Configuration Files

### `wrangler.toml`
Service bindings are configured per environment (production and preview). Top-level bindings are **not** inherited by environment-specific sections.

```toml
# Production environment
[env.production]
routes = [...]

[[env.production.services]]
binding = "akamaiService"
service = "akamai-service"

# Preview environment (PR deployments)
[env.preview]
# Routes set dynamically via CLI

[[env.preview.services]]
binding = "akamaiService"
service = "akamai-service"
```

### Test Environment (`wrangler.test.toml`)
Test environment includes a service binding configuration with a mock implementation:

```toml
[[services]]
binding = "akamaiService"
service = "akamai-service"
```

## Development Environment

The development environment (`wrangler dev`) uses the top-level configuration (without environment-specific overrides). Since top-level service bindings are commented out, the dev environment will not have the binding. This is acceptable as the PRD only requires bindings in preview and production environments.

## Testing with Mock Service Binding

Unit and integration tests use a mock service binding defined in `vitest.config.ts`:

```typescript
serviceBindings: {
  akamaiService: {
    async handleWorkerRequest(...args) {
      console.log('[Mock Akamai] handleWorkerRequest called');
      return Promise.resolve();
    },
  },
},
```

The mock ensures tests can run without requiring a real Akamai service.

## CI/CD Verification

The GitHub Actions workflow includes a verification step that checks if the service binding exists in the deployed worker using the Cloudflare API:

```yaml
- name: Verify service binding via Cloudflare API
  if: matrix.deploy_condition
  run: |
    # Fetches worker script details and checks for akamaiService binding
```

This step runs after deployment but before smoke tests for both preview and production environments.

## Error Handling

The worker gracefully handles missing service bindings:

1. If `env.akamaiService` or `env.akamaiService.handleWorkerRequest` is missing, an error is logged but the request continues
2. Errors in the Akamai promise are caught and logged using `ctx.waitUntil()`
3. The main API functionality continues to work even if Akamai integration fails

## Troubleshooting

### Binding Not Appearing in Dashboard
- Ensure `akamai-service` exists in your Cloudflare account
- Verify the service name matches exactly in `wrangler.toml`
- Check that you have permissions to create service bindings

### "Service binding missing" Errors in Logs
- Development environment: Expected (binding not configured)
- Preview/Production: Verify deployment succeeded and binding configuration is correct
- Check Cloudflare dashboard to confirm binding appears in worker settings

### Tests Failing Due to Missing Binding
- Ensure `wrangler.test.toml` includes the service binding configuration
- Verify `vitest.config.ts` has the mock service binding
- Run `npm test` to confirm tests pass locally

## Architecture Notes

- Service bindings are configured per environment, not inherited
- The binding name (`akamaiService`) must match the `Env` interface in `src/index.ts`
- The service name (`akamai-service`) references the actual service in Cloudflare
- Test environment uses same binding name with mock implementation
- Development environment intentionally lacks binding (per PRD requirements)

## References

- [Cloudflare Workers Service Bindings Documentation](https://developers.cloudflare.com/workers/configuration/service-bindings/)
- [Wrangler Configuration Reference](https://developers.cloudflare.com/workers/wrangler/configuration/)