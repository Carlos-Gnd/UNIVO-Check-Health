import { describe, it, expect } from 'vitest';
import { analyzeFakeGpsPattern } from '@/shared/backend/checkHealthBackend';
import type { DeviceInfo } from '@/modules/attendance/types';

const baseInfo: DeviceInfo = {
  browser: 'Chrome',
  gpsAccuracy: 15,
  connectionType: '4g',
};

describe('analyzeFakeGpsPattern', () => {
  it('devuelve undefined si no hay deviceInfo', () => {
    expect(analyzeFakeGpsPattern(undefined)).toBeUndefined();
  });

  it('no detecta GPS falso con sensores normales', () => {
    const info = analyzeFakeGpsPattern({
      ...baseInfo,
      motionSamples: Array.from({ length: 10 }, (_, i) => ({
        timestamp: i * 100,
        accelerationMagnitude: 9.8 + Math.random() * 0.5,
        rotationRateMagnitude: 0.3 + Math.random() * 0.3,
      })),
    });
    expect(info?.isFakeGps).toBe(false);
  });

  it('detecta GPS falso con sensores planos + GPS de alta precisión + drift', () => {
    // Condición 1 (+0.45): acelerómetro plano (variance ≈ 0)
    // Condición 2 (+0.35): GPS drift ≥ 25 m entre muestras
    // Condición 3 (+0.15): gpsAccuracy ≤ 5 con sensores activos
    // Total: 0.95 > umbral 0.8
    const info = analyzeFakeGpsPattern({
      ...baseInfo,
      gpsAccuracy: 3,
      motionSamples: Array.from({ length: 10 }, (_, i) => ({
        timestamp: i * 100,
        accelerationMagnitude: 9.8000, // varianza cero
        rotationRateMagnitude: 0.0000,
      })),
      locationSamples: [
        { latitude: 13.7000, longitude: -89.2000, accuracyMeters: 3, timestamp: 0 },
        { latitude: 13.7003, longitude: -89.2003, accuracyMeters: 3, timestamp: 100 }, // ~45 m de drift
      ],
    });
    expect(info?.isFakeGps).toBe(true);
    expect(info?.fakeGpsConfidence).toBeGreaterThan(0.8);
  });

  it('adjunta fakeGpsAnalysis al resultado', () => {
    const info = analyzeFakeGpsPattern(baseInfo);
    expect(info).toHaveProperty('fakeGpsAnalysis');
    expect(info?.fakeGpsAnalysis).toHaveProperty('confidence');
    expect(info?.fakeGpsAnalysis).toHaveProperty('reasons');
  });

  it('confianza está en rango [0, 1]', () => {
    const info = analyzeFakeGpsPattern(baseInfo);
    expect(info?.fakeGpsConfidence).toBeGreaterThanOrEqual(0);
    expect(info?.fakeGpsConfidence).toBeLessThanOrEqual(1);
  });
});
