/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEffectiveModel } from './modelCheck.js';
import { DEFAULT_GEMINI_MODEL, DEFAULT_GEMINI_FLASH_MODEL } from '../config/models.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('modelCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getEffectiveModel', () => {
    it('should return the current model with isTemporaryFallback=false when model is not rate limited', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: 'test' }] } }] }),
      });

      const result = await getEffectiveModel('test-api-key', DEFAULT_GEMINI_MODEL);
      
      expect(result).toEqual({
        model: DEFAULT_GEMINI_MODEL,
        isTemporaryFallback: false,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should return flash model with isTemporaryFallback=true when pro model returns 429', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce({
        status: 429,
      });

      const result = await getEffectiveModel('test-api-key', DEFAULT_GEMINI_MODEL);
      
      expect(result).toEqual({
        model: DEFAULT_GEMINI_FLASH_MODEL,
        isTemporaryFallback: true,
      });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('temporarily unavailable')
      );
    });

    it('should return the current model when it is not the default pro model', async () => {
      const customModel = 'gemini-custom-model';
      const result = await getEffectiveModel('test-api-key', customModel);
      
      expect(result).toEqual({
        model: customModel,
        isTemporaryFallback: false,
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return the current model on fetch error', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getEffectiveModel('test-api-key', DEFAULT_GEMINI_MODEL);
      
      expect(result).toEqual({
        model: DEFAULT_GEMINI_MODEL,
        isTemporaryFallback: false,
      });
    });

    it('should return the current model on timeout', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 100);
        })
      );

      const result = await getEffectiveModel('test-api-key', DEFAULT_GEMINI_MODEL);
      
      expect(result).toEqual({
        model: DEFAULT_GEMINI_MODEL,
        isTemporaryFallback: false,
      });
    });

    it('should return the current model for non-429 error responses', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce({
        status: 500,
      });

      const result = await getEffectiveModel('test-api-key', DEFAULT_GEMINI_MODEL);
      
      expect(result).toEqual({
        model: DEFAULT_GEMINI_MODEL,
        isTemporaryFallback: false,
      });
    });
  });
});