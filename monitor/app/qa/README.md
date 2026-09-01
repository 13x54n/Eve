# QA Metrics Dashboard

A comprehensive dashboard for tracking quality assurance metrics across the Eve platform.

## Features

### Test Coverage Tracking
- Backend coverage (statements, branches, functions, lines)
- Frontend coverage (rider, driver, admin apps)
- Visual progress bars with color-coded thresholds
- Automatic alerts when coverage drops

### Test Execution Metrics
- Total, passing, failing, and skipped tests
- Test suite duration
- Historical trends

### CI/CD Pipeline Metrics
- Total pipeline runs
- Success rate tracking
- Average build duration
- Last run status

### Bug Tracking
- Production vs staging bug counts
- Bugs caught in testing
- Bug escape rate calculation
- Target threshold monitoring

### Quality & Process Metrics
- Code review count and average time
- PR cycle time (PR to production)
- Deployment frequency
- Team velocity indicators

### Automated Recommendations
- Low coverage warnings
- Production bug alerts
- CI success rate notifications
- Actionable improvement suggestions

## Usage

### View Dashboard

Navigate to http://localhost:3010/qa after starting the monitor app:

```bash
cd monitor
npm install
npm run dev
```

### Collect Metrics

Run the metrics collection script:

```bash
npm run metrics
```

### Integration with CI

Add to your CI pipeline to track metrics over time:

```yaml
- name: Collect QA Metrics
  run: |
    cd monitor
    npm run metrics
```

## Data Sources

The dashboard aggregates data from:

1. **Backend Coverage**: `backend/coverage/coverage-summary.json`
2. **Test Results**: Vitest/Jest test output
3. **CI Metrics**: GitHub Actions API
4. **Bug Tracking**: Issue tracking system (GitHub Issues, Jira, etc.)

## Configuration

### Coverage Thresholds

Edit thresholds in:
- Backend: `backend/vitest.config.ts`
- Frontend: `rider/jest.config.js`, `driver/jest.config.js`

### Alert Conditions

Customize alert thresholds in `components/qa-metrics.tsx`:

```typescript
const getCoverageColor = (value: number) => {
  if (value >= 70) return 'text-green-600';  // Good
  if (value >= 50) return 'text-yellow-600'; // Warning
  return 'text-red-600';                      // Critical
};
```

## Real-Time Data

For production deployment, replace mock data with API calls:

```typescript
useEffect(() => {
  fetch('/api/qa-metrics')
    .then(res => res.json())
    .then(setMetrics);
}, []);
```

## Metrics API Endpoints

Create these endpoints to serve real data:

- `GET /api/qa-metrics/coverage` - Test coverage data
- `GET /api/qa-metrics/tests` - Test execution results
- `GET /api/qa-metrics/ci` - CI/CD pipeline stats
- `GET /api/qa-metrics/bugs` - Bug tracking data

## Historical Data

Store metrics over time to show trends:

```typescript
interface HistoricalMetric {
  timestamp: string;
  coverage: number;
  tests: number;
  bugs: number;
}
```

Display with charts:
- Coverage trends over time
- Test count growth
- Bug escape rate trends
- CI success rate history

## Alerts & Notifications

Set up automated alerts:

1. **Slack Notifications**: Post to #qa channel when metrics drop
2. **Email Reports**: Weekly summary of QA metrics
3. **Dashboard Badges**: Add to README with real-time status

## Best Practices

1. **Review Daily**: Check metrics every morning
2. **Set Targets**: Define and communicate coverage goals
3. **Track Trends**: Focus on direction, not just absolute values
4. **Act on Data**: Use insights to prioritize testing work
5. **Share Widely**: Make metrics visible to entire team

## Troubleshooting

### Metrics not updating

```bash
# Regenerate coverage reports
cd backend && npm run test:coverage

# Check data files exist
ls backend/coverage/coverage-summary.json
```

### Dashboard not loading

```bash
# Clear Next.js cache
cd monitor
rm -rf .next
npm run dev
```

## Contributing

To add new metrics:

1. Update `QAMetrics` interface in `components/qa-metrics.tsx`
2. Add data collection in `scripts/collect-metrics.ts`
3. Add visualization in dashboard component
4. Document new metric in this README
