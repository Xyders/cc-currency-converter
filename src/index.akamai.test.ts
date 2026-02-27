import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAkamaiConfig, shouldSendBody } from './index.js';

describe('Akamai integration', () => {
  describe('getAkamaiConfig', () => {
    it('should return default configuration when no env vars', () => {
      const env = {};
      const config = getAkamaiConfig(env);
      expect(config).toEqual({
        ignoreCachedResponses: false,
        maxBodySizeBytes: 1048576,
      });
    });

    it('should parse IGNORE_CACHED_RESPONSES=true', () => {
      const env = { IGNORE_CACHED_RESPONSES: 'true' };
      const config = getAkamaiConfig(env);
      expect(config.ignoreCachedResponses).toBe(true);
      expect(config.maxBodySizeBytes).toBe(1048576);
    });

    it('should parse IGNORE_CACHED_RESPONSES=false', () => {
      const env = { IGNORE_CACHED_RESPONSES: 'false' };
      const config = getAkamaiConfig(env);
      expect(config.ignoreCachedResponses).toBe(false);
    });

    it('should parse IGNORE_CACHED_RESPONSES case-insensitive', () => {
      const env = { IGNORE_CACHED_RESPONSES: 'TRUE' };
      const config = getAkamaiConfig(env);
      expect(config.ignoreCachedResponses).toBe(true);
    });

    it('should parse MAX_BODY_SIZE_BYTES', () => {
      const env = { MAX_BODY_SIZE_BYTES: '2048' };
      const config = getAkamaiConfig(env);
      expect(config.maxBodySizeBytes).toBe(2048);
    });

    it('should use default for invalid MAX_BODY_SIZE_BYTES (non-integer)', () => {
      const env = { MAX_BODY_SIZE_BYTES: 'not-a-number' };
      const config = getAkamaiConfig(env);
      expect(config.maxBodySizeBytes).toBe(1048576);
    });

    it('should use default for invalid MAX_BODY_SIZE_BYTES (zero)', () => {
      const env = { MAX_BODY_SIZE_BYTES: '0' };
      const config = getAkamaiConfig(env);
      expect(config.maxBodySizeBytes).toBe(1048576);
    });

    it('should use default for invalid MAX_BODY_SIZE_BYTES (negative)', () => {
      const env = { MAX_BODY_SIZE_BYTES: '-1' };
      const config = getAkamaiConfig(env);
      expect(config.maxBodySizeBytes).toBe(1048576);
    });

    it('should handle both env vars', () => {
      const env = {
        IGNORE_CACHED_RESPONSES: 'true',
        MAX_BODY_SIZE_BYTES: '512',
      };
      const config = getAkamaiConfig(env);
      expect(config).toEqual({
        ignoreCachedResponses: true,
        maxBodySizeBytes: 512,
      });
    });
  });

  describe('shouldSendBody', () => {
    it('should return false for null body', () => {
      const headers = new Headers();
      const result = shouldSendBody(null, headers, 1000);
      expect(result).toBe(false);
    });

    it('should return true when content-length not present', () => {
      const body = new ReadableStream();
      const headers = new Headers();
      const result = shouldSendBody(body, headers, 1000);
      expect(result).toBe(true);
    });

    it('should return true when content-length within limit', () => {
      const body = new ReadableStream();
      const headers = new Headers({ 'content-length': '500' });
      const result = shouldSendBody(body, headers, 1000);
      expect(result).toBe(true);
    });

    it('should return false when content-length exceeds limit', () => {
      const body = new ReadableStream();
      const headers = new Headers({ 'content-length': '1500' });
      const result = shouldSendBody(body, headers, 1000);
      expect(result).toBe(false);
    });

    it('should handle invalid content-length (non-numeric)', () => {
      const body = new ReadableStream();
      const headers = new Headers({ 'content-length': 'abc' });
      const result = shouldSendBody(body, headers, 1000);
      expect(result).toBe(true); // Should fall back to sending body
    });
  });

});