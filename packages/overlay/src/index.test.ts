import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isAvailable, hasPermission, requestPermission, show, hide } from './index';

describe('JcurveOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('should return false when module is not available', () => {
      expect(isAvailable()).toBe(false); // In test environment, module is not available
    });
  });

  describe('hasPermission', () => {
    it('should return false when module is not available', () => {
      expect(hasPermission()).toBe(false);
    });
  });

  describe('requestPermission', () => {
    it('should not throw when module is not available', () => {
      expect(() => requestPermission()).not.toThrow();
    });
  });

  describe('show', () => {
    it('should return false when module is not available', async () => {
      const result = await show({
        imageUrl: 'https://example.com/image.jpg',
        name: 'Product Name',
        price: '₩10,000',
        durationSec: 5,
      });
      expect(result).toBe(false);
    });

    it('should handle missing parameters gracefully', async () => {
      const result = await show({
        imageUrl: '',
        name: '',
        price: '',
        durationSec: 0,
      });
      expect(result).toBe(false);
    });
  });

  describe('hide', () => {
    it('should not throw when module is not available', () => {
      expect(() => hide()).not.toThrow();
    });
  });
});
