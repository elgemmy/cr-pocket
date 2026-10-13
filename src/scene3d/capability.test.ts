import { describe, expect, it } from 'vitest';
import { collectDeviceSignals, isLowEndDevice, shouldUse3D, type DeviceSignals } from './capability';

const capable: DeviceSignals = {
  reducedMotion: false,
  webgl: true,
  hardwareConcurrency: 8,
  deviceMemoryGB: 8,
  saveData: false,
};

describe('isLowEndDevice', () => {
  it('treats 4 or fewer cores as low-end', () => {
    expect(isLowEndDevice({ hardwareConcurrency: 4, deviceMemoryGB: 8, saveData: false })).toBe(true);
    expect(isLowEndDevice({ hardwareConcurrency: 2, deviceMemoryGB: null, saveData: false })).toBe(true);
  });

  it('treats 4GB or less device memory as low-end', () => {
    expect(isLowEndDevice({ hardwareConcurrency: 8, deviceMemoryGB: 4, saveData: false })).toBe(true);
    expect(isLowEndDevice({ hardwareConcurrency: 8, deviceMemoryGB: 2, saveData: false })).toBe(true);
  });

  it('treats saveData as low-end regardless of hardware', () => {
    expect(isLowEndDevice({ hardwareConcurrency: 16, deviceMemoryGB: 16, saveData: true })).toBe(true);
  });

  it('treats unknown signals (null) as capable', () => {
    expect(isLowEndDevice({ hardwareConcurrency: null, deviceMemoryGB: null, saveData: false })).toBe(false);
  });

  it('treats decent hardware as not low-end', () => {
    expect(isLowEndDevice({ hardwareConcurrency: 6, deviceMemoryGB: 6, saveData: false })).toBe(false);
  });
});

describe('shouldUse3D', () => {
  it('allows 3D on a capable device', () => {
    expect(shouldUse3D(capable)).toBe(true);
  });

  it('never uses 3D with prefers-reduced-motion', () => {
    expect(shouldUse3D({ ...capable, reducedMotion: true })).toBe(false);
  });

  it('never uses 3D without WebGL', () => {
    expect(shouldUse3D({ ...capable, webgl: false })).toBe(false);
  });

  it('never uses 3D on low-end devices or with saveData', () => {
    expect(shouldUse3D({ ...capable, hardwareConcurrency: 4 })).toBe(false);
    expect(shouldUse3D({ ...capable, deviceMemoryGB: 4 })).toBe(false);
    expect(shouldUse3D({ ...capable, saveData: true })).toBe(false);
  });

  it('allows 3D when hardware signals are unknown but WebGL works', () => {
    expect(shouldUse3D({ ...capable, hardwareConcurrency: null, deviceMemoryGB: null })).toBe(true);
  });
});

describe('collectDeviceSignals', () => {
  const fakeDoc = { createElement: () => ({ getContext: () => ({}) }) as unknown as HTMLCanvasElement };

  it('reads browser signals and normalizes invalid values to null', () => {
    const signals = collectDeviceSignals(
      { hardwareConcurrency: 8, deviceMemory: 8, connection: { saveData: false } },
      { matchMedia: () => ({ matches: false }) },
      fakeDoc,
    );
    expect(signals).toEqual({
      reducedMotion: false,
      webgl: true,
      hardwareConcurrency: 8,
      deviceMemoryGB: 8,
      saveData: false,
    });
  });

  it('maps missing navigator fields to null/false', () => {
    const signals = collectDeviceSignals({}, {}, fakeDoc);
    expect(signals.hardwareConcurrency).toBeNull();
    expect(signals.deviceMemoryGB).toBeNull();
    expect(signals.saveData).toBe(false);
    expect(signals.reducedMotion).toBe(false);
  });

  it('detects reduced motion from matchMedia', () => {
    const signals = collectDeviceSignals(
      {},
      { matchMedia: (q: string) => ({ matches: q.includes('reduce') }) },
      fakeDoc,
    );
    expect(signals.reducedMotion).toBe(true);
  });

  it('reports no WebGL when context creation fails', () => {
    const signals = collectDeviceSignals({}, {}, {
      createElement: () => ({ getContext: () => null }) as unknown as HTMLCanvasElement,
    });
    expect(signals.webgl).toBe(false);
  });

  it('reports no WebGL when getContext throws', () => {
    const signals = collectDeviceSignals({}, {}, {
      createElement: () => {
        throw new Error('no canvas');
      },
    });
    expect(signals.webgl).toBe(false);
  });
});
