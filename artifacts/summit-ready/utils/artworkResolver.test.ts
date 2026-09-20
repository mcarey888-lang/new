import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveTrainingBasecampArtwork } from './artworkResolver';

const originalDev = global.__DEV__;
const originalFetch = global.fetch;

describe('resolveTrainingBasecampArtwork', () => {
  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.__DEV__ = originalDev;
    global.fetch = originalFetch;
  });

  it('returns null in production without fetching', async () => {
    global.__DEV__ = false;
    const result = await resolveTrainingBasecampArtwork();
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns url on DEV success', async () => {
    global.__DEV__ = true;
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://example.com/hero.jpg' })
    });

    const result = await resolveTrainingBasecampArtwork();
    expect(result).toBe('https://example.com/hero.jpg');
    expect(global.fetch).toHaveBeenCalledWith('/api/artwork/resolve/SR-TRAIN-BASECAMP-001/hero');
  });

  it('returns null on DEV non-2xx failure', async () => {
    global.__DEV__ = true;
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404
    });

    const result = await resolveTrainingBasecampArtwork();
    expect(result).toBeNull();
  });

  it('returns null on DEV malformed JSON', async () => {
    global.__DEV__ = true;
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ unexpected: 'data' })
    });

    const result = await resolveTrainingBasecampArtwork();
    expect(result).toBeNull();
  });
});
