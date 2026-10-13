/**
 * Optional decorative 3D hero scene — public API.
 * Only `HeroScene` (and capability helpers for tests) are exported; the
 * three.js chunk is loaded lazily inside `HeroScene`.
 */
export { HeroScene, type HeroSceneProps } from './HeroScene';
export { getDeviceSignals, isLowEndDevice, shouldUse3D, type DeviceSignals } from './capability';
