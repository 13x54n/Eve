'use client';

import { useState, useEffect } from 'react';

interface QAMetrics {
  coverage: {
    backend: { statements: number; branches: number; functions: number; lines: number };
    frontend: { rider: number; driver: number; admin: number };
  };
  tests: {
    total: number;
    passing: number;
    failing: number;
    skipped: number;
    duration: number;
  };
  ci: {
    totalRuns: number;
    successRate: number;
    avgDuration: number;
    lastRunStatus: 'success' | 'failure' | 'pending';
    lastRunTime: string;
  };
  bugs: {
    production: number;
    staging: number;
    caught: number;
    escapeRate: number;
  };
  quality: {
    codeReviews: number;
    avgReviewTime: number;
    cycleTime: number;
    deploymentFrequency: number;
  };
}

const mockMetrics: QAMetrics = {
  coverage: {
    backend: { statements: 72, branches: 61, functions: 68, lines: 73 },
    frontend: { rider: 15, driver: 12, admin: 8 },
  },
  tests: {
    total: 19,
    passing: 19,
    failing: 0,
    skipped: 0,
    duration: 4200,
  },
  ci: {
    totalRuns: 156,
    successRate: 94.2,
    avgDuration: 480,
    lastRunStatus: 'success',
    lastRunTime: new Date().toISOString(),
  },
  bugs: {
    production: 3,
    staging: 8,
    caught: 45,
    escapeRate: 6.25,
  },
  quality: {
    codeReviews: 87,
    avgReviewTime: 4.5,
    cycleTime: 2.3,
    deploymentFrequency: 12,
  },
};

export function QAMetricsDashboard() {
  const [metrics, setMetrics] = useState<QAMetrics>(mockMetrics);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // In production, fetch real metrics from API
    // fetch('/api/qa-metrics').then(res => res.json()).then(setMetrics);
  }, []);

  const getCoverageColor = (value: number) => {
    if (value >= 70) return 'text-green-600';
    if (value >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'failure':
        return 'bg-red-500';
      default:
        return 'bg-yellow-500';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">QA Metrics Dashboard</h1>
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      {/* Test Coverage */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Test Coverage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium mb-3">Backend Coverage</h3>
            <div className="space-y-2">
              {Object.entries(metrics.coverage.backend).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="capitalize">{key}:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${value >= 70 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span className={`font-mono ${getCoverageColor(value)}`}>{value}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-3">Frontend Coverage</h3>
            <div className="space-y-2">
              {Object.entries(metrics.coverage.frontend).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="capitalize">{key}:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${value >= 70 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span className={`font-mono ${getCoverageColor(value)}`}>{value}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                ⚠️ Frontend coverage is low. Prioritize adding tests.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Test Results */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Test Execution</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded">
            <div className="text-3xl font-bold text-blue-600">{metrics.tests.total}</div>
            <div className="text-sm text-gray-600">Total Tests</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded">
            <div className="text-3xl font-bold text-green-600">{metrics.tests.passing}</div>
            <div className="text-sm text-gray-600">Passing</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded">
            <div className="text-3xl font-bold text-red-600">{metrics.tests.failing}</div>
            <div className="text-sm text-gray-600">Failing</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded">
            <div className="text-3xl font-bold text-gray-600">{metrics.tests.skipped}</div>
            <div className="text-sm text-gray-600">Skipped</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded">
            <div className="text-3xl font-bold text-purple-600">
              {(metrics.tests.duration / 1000).toFixed(1)}s
            </div>
            <div className="text-sm text-gray-600">Duration</div>
          </div>
        </div>
      </section>

      {/* CI/CD Metrics */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">CI/CD Pipeline</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-600 mb-1">Total Runs</div>
            <div className="text-2xl font-bold">{metrics.ci.totalRuns}</div>
          </div>
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-600 mb-1">Success Rate</div>
            <div className="text-2xl font-bold text-green-600">
              {metrics.ci.successRate.toFixed(1)}%
            </div>
          </div>
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-600 mb-1">Avg Duration</div>
            <div className="text-2xl font-bold">{metrics.ci.avgDuration}s</div>
          </div>
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-600 mb-1">Last Run</div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(metrics.ci.lastRunStatus)}`} />
              <span className="font-medium capitalize">{metrics.ci.lastRunStatus}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Bug Tracking */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Bug Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-red-50 rounded">
            <div className="text-3xl font-bold text-red-600">{metrics.bugs.production}</div>
            <div className="text-sm text-gray-600">Production Bugs</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded">
            <div className="text-3xl font-bold text-yellow-600">{metrics.bugs.staging}</div>
            <div className="text-sm text-gray-600">Staging Bugs</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded">
            <div className="text-3xl font-bold text-green-600">{metrics.bugs.caught}</div>
            <div className="text-sm text-gray-600">Caught in Testing</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded">
            <div className="text-3xl font-bold text-blue-600">
              {metrics.bugs.escapeRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Escape Rate</div>
          </div>
        </div>
        {metrics.bugs.escapeRate < 10 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-sm text-green-800">✅ Bug escape rate is within target (&lt;10%)</p>
          </div>
        )}
      </section>

      {/* Quality Metrics */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Quality & Process Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-600 mb-1">Code Reviews</div>
            <div className="text-2xl font-bold">{metrics.quality.codeReviews}</div>
            <div className="text-xs text-gray-500">This month</div>
          </div>
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-600 mb-1">Avg Review Time</div>
            <div className="text-2xl font-bold">{metrics.quality.avgReviewTime}h</div>
            <div className="text-xs text-gray-500">Per PR</div>
          </div>
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-600 mb-1">Cycle Time</div>
            <div className="text-2xl font-bold">{metrics.quality.cycleTime}d</div>
            <div className="text-xs text-gray-500">PR to production</div>
          </div>
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-600 mb-1">Deploys/Week</div>
            <div className="text-2xl font-bold">{metrics.quality.deploymentFrequency}</div>
            <div className="text-xs text-gray-500">Average</div>
          </div>
        </div>
      </section>

      {/* Recommendations */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Recommendations</h2>
        <ul className="space-y-2">
          {metrics.coverage.frontend.rider < 60 && (
            <li className="flex items-start gap-2 p-3 bg-yellow-50 rounded">
              <span className="text-yellow-600">⚠️</span>
              <div>
                <strong>Improve Rider App Coverage:</strong> Current coverage is{' '}
                {metrics.coverage.frontend.rider}%. Add unit tests for critical components.
              </div>
            </li>
          )}
          {metrics.coverage.frontend.driver < 60 && (
            <li className="flex items-start gap-2 p-3 bg-yellow-50 rounded">
              <span className="text-yellow-600">⚠️</span>
              <div>
                <strong>Improve Driver App Coverage:</strong> Current coverage is{' '}
                {metrics.coverage.frontend.driver}%. Add unit tests for critical components.
              </div>
            </li>
          )}
          {metrics.coverage.frontend.admin < 60 && (
            <li className="flex items-start gap-2 p-3 bg-yellow-50 rounded">
              <span className="text-yellow-600">⚠️</span>
              <div>
                <strong>Add Admin E2E Tests:</strong> Admin console has {metrics.coverage.frontend.admin}
                % coverage. E2E tests are now configured in admin/e2e/.
              </div>
            </li>
          )}
          {metrics.bugs.production > 0 && (
            <li className="flex items-start gap-2 p-3 bg-red-50 rounded">
              <span className="text-red-600">🔴</span>
              <div>
                <strong>Production Bugs Detected:</strong> {metrics.bugs.production} bugs in
                production. Review test coverage for affected areas.
              </div>
            </li>
          )}
          {metrics.ci.successRate < 95 && (
            <li className="flex items-start gap-2 p-3 bg-yellow-50 rounded">
              <span className="text-yellow-600">⚠️</span>
              <div>
                <strong>CI Success Rate Low:</strong> Current rate is {metrics.ci.successRate.toFixed(1)}
                %. Investigate flaky tests.
              </div>
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
