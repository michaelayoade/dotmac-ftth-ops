/**
 * Tests for useFiberGraphQL hooks
 *
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { ReactNode } from 'react';
import {
  useFiberDashboardGraphQL,
  useFiberCableListGraphQL,
  useFiberCableDetailGraphQL,
  useFiberHealthMetricsGraphQL,
} from '../useFiberGraphQL';

// Mock wrapper component
function MockWrapper({ children }: { children: ReactNode }) {
  return (
    <MockedProvider mocks={[]} addTypename={false}>
      {children}
    </MockedProvider>
  );
}

describe('useFiberGraphQL', () => {
  describe('useFiberDashboardGraphQL', () => {
    it('should initialize with loading state', () => {
      const { result } = renderHook(() => useFiberDashboardGraphQL(), {
        wrapper: MockWrapper,
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.dashboard).toBeNull();
      expect(result.current.error).toBeUndefined();
    });

    it('should provide refetch function', () => {
      const { result } = renderHook(() => useFiberDashboardGraphQL(), {
        wrapper: MockWrapper,
      });

      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('useFiberCableListGraphQL', () => {
    it('should initialize with empty cables array', () => {
      const { result } = renderHook(() => useFiberCableListGraphQL(), {
        wrapper: MockWrapper,
      });

      expect(result.current.cables).toEqual([]);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.hasNextPage).toBe(false);
    });

    it('should accept filter options', () => {
      const { result } = renderHook(
        () =>
          useFiberCableListGraphQL({
            limit: 25,
            offset: 50,
            search: 'test',
          }),
        {
          wrapper: MockWrapper,
        }
      );

      expect(result.current.loading).toBe(true);
    });

    it('should provide fetchMore function', () => {
      const { result } = renderHook(() => useFiberCableListGraphQL(), {
        wrapper: MockWrapper,
      });

      expect(typeof result.current.fetchMore).toBe('function');
    });
  });

  describe('useFiberCableDetailGraphQL', () => {
    it('should skip query when cableId is undefined', () => {
      const { result } = renderHook(() => useFiberCableDetailGraphQL(undefined), {
        wrapper: MockWrapper,
      });

      expect(result.current.cable).toBeNull();
    });

    it('should query when cableId is provided', () => {
      const { result } = renderHook(() => useFiberCableDetailGraphQL('cable-123'), {
        wrapper: MockWrapper,
      });

      expect(result.current.loading).toBe(true);
    });
  });

  describe('useFiberHealthMetricsGraphQL', () => {
    it('should initialize with empty metrics', () => {
      const { result } = renderHook(() => useFiberHealthMetricsGraphQL(), {
        wrapper: MockWrapper,
      });

      expect(result.current.metrics).toEqual([]);
    });

    it('should accept filter options', () => {
      const { result } = renderHook(
        () =>
          useFiberHealthMetricsGraphQL({
            cableId: 'cable-123',
            pollInterval: 60000,
          }),
        {
          wrapper: MockWrapper,
        }
      );

      expect(result.current.loading).toBe(true);
    });
  });
});
