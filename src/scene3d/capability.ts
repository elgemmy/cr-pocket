/**
 * Device-capability heuristics for the optional decorative 3D hero scene.
 *
 * The scene is eye candy only (spec F8): it must never run when the user asked
 * for reduced motion, when the device is likely too weak, or when WebGL is
 * missing. All decision logic lives here as pure functions so it can be
 * unit-tested without a browser.
 */

export interface DeviceSignals {
  /** User prefers reduced motion (OS setting). */
  reducedMotion: boolean;
  /** A WebGL(2) context can be created. */
  webgl: boolean;
  /** navigator.hardwareConcurrency (null when unknown). */
  hardwareConcurrency: number | null;
  /** navigator.deviceMemory in GB (null when unknown — most browsers). */
  deviceMemoryGB: number | null;
  /** navigator.connection.saveData — user asked to save data. */
  saveData: boolean;
}

/** Low-end heuristic: weak CPU/RAM or an explicit data-saver request. */
export function isLowEndDevice(signals: Pick<DeviceSignals, 'hardwareConcurrency' | 'deviceMemoryGB' | 'saveData'>): boolean {
  if (signals.saveData) return true;
  if (signals.hardwareConcurrency !== null && signals.hardwareConcurrency <= 4) return true;
  if (signals.deviceMemoryGB !== null && signals.deviceMemoryGB <= 4) return true;
  return false;
}

/** The 3D scene may mount only when every signal says it is safe. */
export function shouldUse3D(signals: DeviceSignals): boolean {
  if (!signals.webgl) return false;
  if (signals.reducedMotion) return false;
  if (isLowEndDevice(signals)) return false;
  return true;
}

/** Try creating a WebGL context without keeping it around. */
export function detectWebGL(doc: Pick<Document, 'createElement'> = document): boolean {
  try {
    const canvas = doc.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl' as 'webgl');
    return gl !== null;
  } catch {
    return false;
  }
}

interface NavigatorLike {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

interface WindowLike {
  matchMedia?: (query: string) => { matches: boolean };
}

/** Collect signals from the live browser (injectable for tests). */
export function collectDeviceSignals(
  nav: NavigatorLike = navigator,
  win: WindowLike = window,
  doc: Pick<Document, 'createElement'> = document,
): DeviceSignals {
  const cores = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 ? nav.hardwareConcurrency : null;
  const memory = typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0 ? nav.deviceMemory : null;
  return {
    reducedMotion: typeof win.matchMedia === 'function' ? win.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
    webgl: detectWebGL(doc),
    hardwareConcurrency: cores,
    deviceMemoryGB: memory,
    saveData: nav.connection?.saveData === true,
  };
}

let cached: DeviceSignals | null = null;

/**
 * Cached live signals. Evaluated once per session: hardware does not change
 * mid-visit, and a reduced-motion change applies on next load (MotionConfig
 * already handles CSS/motion reduction live).
 */
export function getDeviceSignals(): DeviceSignals {
  if (!cached) cached = collectDeviceSignals();
  return cached;
}
