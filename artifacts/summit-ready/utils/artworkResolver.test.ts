import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveTrainingBasecampArtwork } from './artworkResolver';

const originalDev = global.__DEV__;
const originalFetch = global.fetch;

describe('resolveTrainingBasecampArtwork', () => {
  const pilotContext = {
    devProfileId: 'active_hillwalker',
    mountainName: 'Mont Blanc',
  };

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
    const result = await resolveTrainingBasecampArtwork(pilotContext);
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns url on DEV success', async () => {
    global.__DEV__ = true;
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://example.com/hero.jpg' })
    });

    const result = await resolveTrainingBasecampArtwork(pilotContext);
    expect(result).toBe('https://example.com/hero.jpg');
    expect(global.fetch).toHaveBeenCalledWith('/api/artwork/resolve/SR-MTN-MONTBLANC-001/hero');
  });

  it('returns null on DEV non-2xx failure', async () => {
    global.__DEV__ = true;
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404
    });

    const result = await resolveTrainingBasecampArtwork(pilotContext);
    expect(result).toBeNull();
  });

  it('returns null on DEV malformed JSON', async () => {
    global.__DEV__ = true;
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ unexpected: 'data' })
    });

    const result = await resolveTrainingBasecampArtwork(pilotContext);
    expect(result).toBeNull();
  });

  it('does not fetch for a different DEV profile', async () => {
    global.__DEV__ = true;
    const result = await resolveTrainingBasecampArtwork({
      devProfileId: 'beginner',
      mountainName: 'Mont Blanc',
    });
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not fetch after the pilot goal changes', async () => {
    global.__DEV__ = true;
    const result = await resolveTrainingBasecampArtwork({
      devProfileId: 'active_hillwalker',
      mountainName: 'Mam Tor',
    });
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
