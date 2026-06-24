import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDeviceFingerprint, getDeviceInfo } from '@/modules/attendance/services/attendance.service';

// Mock navigator and window.screen for a deterministic environment
beforeEach(() => {
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (TestAgent)',
    configurable: true,
  });
  Object.defineProperty(window, 'screen', {
    value: { width: 1920, height: 1080, colorDepth: 24 },
    configurable: true,
  });
  Object.defineProperty(window, 'devicePixelRatio', {
    value: 1,
    configurable: true,
  });
});

describe('getDeviceFingerprint', () => {
  it('devuelve un string con prefijo fp_', () => {
    const fp = getDeviceFingerprint();
    expect(fp).toMatch(/^fp_[0-9a-f]{8}$/);
  });

  it('es determinista — dos llamadas devuelven el mismo valor', () => {
    expect(getDeviceFingerprint()).toBe(getDeviceFingerprint());
  });
});

describe('getDeviceInfo', () => {
  it('devuelve browser, gpsAccuracy y connectionType', () => {
    const info = getDeviceInfo();
    expect(info).toHaveProperty('browser');
    expect(info).toHaveProperty('gpsAccuracy');
    expect(info).toHaveProperty('connectionType');
  });

  it('incluye motionSamples y locationSamples cuando se pasan', () => {
    const motionSamples = [{ timestamp: 1, accelerationMagnitude: 0.5, rotationRateMagnitude: 0.2 }];
    const locationSamples = [{ latitude: 13.7, longitude: -89.2, accuracyMeters: 10, timestamp: 1 }];
    const info = getDeviceInfo({ motionSamples, locationSamples });
    expect(info.motionSamples).toEqual(motionSamples);
    expect(info.locationSamples).toEqual(locationSamples);
  });

  it('gpsAccuracy toma el valor de location.accuracyMeters', () => {
    const info = getDeviceInfo({ location: { latitude: 0, longitude: 0, accuracyMeters: 42 } });
    expect(info.gpsAccuracy).toBe(42);
  });

  it('gpsAccuracy es null sin location', () => {
    const info = getDeviceInfo();
    expect(info.gpsAccuracy).toBeNull();
  });
});
