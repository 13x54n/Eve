# Security Policy

## Reporting Security Issues

If you discover a security vulnerability in the Eve platform, please email [security@eve.example.com](mailto:security@eve.example.com) with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to acknowledge security reports within 48 hours and provide a detailed response within 7 days.

## Security Improvements Implemented

### Critical Vulnerabilities Fixed

#### 1. Internal API Authentication
- **Issue**: Internal service endpoints (`/internal/*`) were unauthenticated
- **Fix**: Added `requireInternalService` middleware requiring `X-Internal-Secret` header
- **Action Required**: Set `INTERNAL_SERVICE_SECRET` environment variable in production

#### 2. Password Reset Code Leakage
- **Issue**: Reset codes were logged to stdout and returned in API responses
- **Fix**: Removed all logging and API exposure of verification codes
- **Action Required**: Integrate proper email service (SendGrid, AWS SES) for code delivery

#### 3. WebSocket IDOR Vulnerability
- **Issue**: Any authenticated user could subscribe to any trip's real-time events
- **Fix**: Added database verification to ensure user is trip participant before allowing subscription
- **Impact**: Prevents unauthorized access to live location tracking and trip updates

### High-Priority Fixes

#### 4. JWT Algorithm Specification
- **Issue**: JWT signing/verification lacked explicit algorithm specification
- **Fix**: Added `algorithm: 'HS256'` to all JWT operations
- **Impact**: Prevents algorithm confusion attacks

#### 5. Driver Route Authorization
- **Issue**: Driver API routes only checked authentication, not role
- **Fix**: Added `requireRole('DRIVER')` middleware at router level
- **Impact**: Prevents riders from accessing driver-only endpoints

#### 6. Rate Limiting
- **Previous**: 600 requests/15min for most APIs, 300 for public endpoints
- **New**: 150 requests/15min for authenticated APIs, 30 for public courier tracking
- **Impact**: Better protection against abuse and DoS attempts

#### 7. Mobile App Deep Link Security
- **Issue**: Rider app routes were accessible via deep links without authentication
- **Fix**: Implemented `Stack.Protected` wrapper with authentication guards
- **Impact**: Prevents unauthorized access via malicious deep links

#### 8. SecureStore Configuration
- **Issue**: Default keychain settings allowed broader device access
- **Fix**: Added `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY`
- **Impact**: Tokens only accessible when device is unlocked

#### 9. 401 Error Handling
- **Issue**: 401 responses only cleared Eve token, not the identity-provider session
- **Fix**: Added navigation to auth screen, allowing logout hook to clear the Privy session
- **Impact**: Proper session cleanup on token expiry

## Environment Variables

### Required for Production

```bash
# Backend - Internal Service Authentication
INTERNAL_SERVICE_SECRET=<generate-a-long-random-secret>

# Backend - JWT Secret
JWT_ACCESS_SECRET=<long-random-secret>

# Backend - Privy
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret

# Backend - Database
DATABASE_URL=postgresql://user:pass@host:5432/eve

# Optional - CORS
CORS_ORIGINS=https://admin.yourdomain.com
```

### Generating Secrets

```bash
# Generate a strong secret for INTERNAL_SERVICE_SECRET
openssl rand -base64 48

# Generate a strong secret for JWT_ACCESS_SECRET  
openssl rand -base64 64
```

## Remaining Security Tasks

### High Priority (Requires Development)

1. **Token Refresh Mechanism**: Implement refresh token rotation and reduce mobile JWT TTL from 30 days to 1-4 hours
2. **Admin Input Validation**: Create Zod schemas for all admin mutation endpoints
3. **Public Tracking Security**: Add expiration, stricter rate limits, and HTTPS universal links
4. **Document Upload Verification**: Server-side ImageKit verification and MIME type allowlist

### Medium Priority (Configuration & Development)

1. **Passkey associated domains**: Keep AASA and Digital Asset Links in sync with Apple Team ID and Play/App Store cert fingerprints
2. **Separate Privy App Clients**: Distinct rider (`ca.sherpafoods.eve`) and driver (`ca.sherpafoods.evedriver`) clients
3. **GDPR Compliance**: Implement data export, account deletion, and consent management
4. **Centralized Logging**: Set up CloudWatch/DataDog with security alerts
5. **CI Security Testing**: Add npm audit, SAST, and secret scanning to GitHub Actions

### Infrastructure (DevOps)

1. **Containerized Deployment**: Migrate from SSH deployment to container orchestration (ECS/Kubernetes)
2. **Network Segmentation**: Bind internal services to `127.0.0.1` or use firewall rules
3. **Security Headers**: Verify Helmet configuration in production

## Security Best Practices

### Development

- Never commit secrets, API keys, or passwords to git
- Use environment variables for all sensitive configuration
- Test with production-like security settings in staging
- Run `npm audit` before deploying

### Production

- Use managed secrets (AWS Secrets Manager, HashiCorp Vault)
- Enable HTTPS only with valid TLS certificates
- Configure proper CORS origins
- Monitor authentication failures and rate limit violations
- Keep dependencies updated with security patches

### Mobile Apps

- Never store sensitive data in AsyncStorage
- Use SecureStore with strictest keychain settings
- Validate all deep link parameters
- Implement certificate pinning for API calls (future enhancement)

## Audit Log

| Date | Type | Description | Severity |
|------|------|-------------|----------|
| 2026-09-01 | Fix | Internal API authentication | Critical |
| 2026-09-01 | Fix | Password reset code leakage | Critical |
| 2026-09-01 | Fix | WebSocket IDOR vulnerability | Critical |
| 2026-09-01 | Fix | JWT algorithm specification | High |
| 2026-09-01 | Fix | Driver route authorization | High |
| 2026-09-01 | Improvement | Rate limiting tightened | Medium |
| 2026-09-01 | Improvement | Mobile deep link auth guards | High |
| 2026-09-01 | Improvement | SecureStore configuration | Medium |
| 2026-09-01 | Improvement | 401 error handling | Medium |

## Security Checklist

- [ ] `INTERNAL_SERVICE_SECRET` configured in production
- [ ] Email service integrated for password resets
- [ ] Secrets generated with `openssl rand`
- [ ] CORS_ORIGINS set to production domains
- [ ] Internal services bound to localhost or firewalled
- [ ] SSL/TLS certificates valid and auto-renewing
- [ ] Database credentials rotated regularly
- [ ] Monitoring and alerting configured
- [ ] Incident response plan documented
- [ ] Security contact email published

## Contact

For security concerns or questions about this policy:
- Email: security@eve.example.com
- Security Audit Reports: Share privately via encrypted email

**Do not** open public GitHub issues for security vulnerabilities.
