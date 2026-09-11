# API Contract Testing

This directory contains contract tests that validate the Eve API against its OpenAPI specification.

## Overview

Contract testing ensures that:
1. API responses match documented schemas
2. Request/response structures remain consistent
3. Breaking changes are caught before deployment
4. Mobile apps can rely on stable API contracts

## Running Contract Tests

```bash
# Generate OpenAPI spec first
npm run openapi:generate

# Run contract tests
npm run test:contracts

# Or run all tests including contracts
npm test
```

## OpenAPI Specification

The OpenAPI spec is generated from JSDoc comments in the codebase and separate YAML files.

### Viewing the Spec

After generation, view the spec at `backend/docs/openapi.json`.

You can serve it with Swagger UI:
```bash
npx swagger-ui-watcher docs/openapi.json
```

## Adding New Endpoints

1. Document with JSDoc comments:
```typescript
/**
 * @swagger
 * /api/example:
 *   get:
 *     summary: Example endpoint
 *     tags: [Example]
 *     responses:
 *       200:
 *         description: Success
 */
```

2. Or add to `docs/api/*.yml` files

3. Regenerate spec:
```bash
npm run openapi:generate
```

4. Add contract tests in `tests/contracts/`

## Best Practices

1. **Version your API**: Use semantic versioning for breaking changes
2. **Document all endpoints**: Every route should have OpenAPI docs
3. **Test request/response**: Validate both input and output schemas
4. **Update on changes**: Regenerate spec after API modifications
5. **Share with mobile teams**: Mobile apps should reference the same spec

## Integration with Mobile Apps

Mobile teams can:
1. Generate TypeScript types from OpenAPI spec
2. Validate API responses at runtime
3. Mock API responses for testing
4. Stay in sync with backend changes

## Tools

- **swagger-jsdoc**: Generate OpenAPI from JSDoc comments
- **express-openapi-validator**: Validate requests/responses in Express
- **OpenAPI Generator**: Generate client SDKs from spec
