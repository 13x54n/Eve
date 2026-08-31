import React from 'react';
import { render } from '@testing-library/react-native';

/**
 * Custom render function that wraps components with common providers
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options = {}
) {
  // Add any global providers here (Theme, Context, etc.)
  return render(ui, options);
}

/**
 * Mock API response helper
 */
export function mockApiSuccess(data: any) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => data,
  });
}

/**
 * Mock API error helper
 */
export function mockApiError(status: number, message: string) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ message }),
  });
}

/**
 * Wait for async updates
 */
export const waitFor = (callback: () => void, options = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      callback();
      resolve(undefined);
    }, 0);
  });
};
