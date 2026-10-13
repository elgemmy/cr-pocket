import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useOnlineStatus } from './online';

const originalDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

afterEach(() => {
  if (originalDescriptor) Object.defineProperty(Navigator.prototype, 'onLine', originalDescriptor);
});

describe('useOnlineStatus', () => {
  it('reflects navigator.onLine', () => {
    setOnLine(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it('updates on offline/online events', () => {
    setOnLine(true);
    const { result } = renderHook(() => useOnlineStatus());

    setOnLine(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    setOnLine(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });

  it('stops listening after unmount', () => {
    setOnLine(true);
    const { result, unmount } = renderHook(() => useOnlineStatus());
    unmount();
    setOnLine(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(true); // snapshot not re-read after unmount
  });
});
