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

  it('returns only the exact approved asset, version, placement and derivative on DEV success', async () => {
    global.__DEV__ = true;
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assetId: 'SR-MTN-MONTBLANC-001',
        version: 1,
        placement: 'hero',
        derivativePath: '/api/artwork/batches/batch-01/SR-MTN-MONTBLANC-001/v1/hero',
        url: '/api/artwork/approved/SR-MTN-MONTBLANC-001/hero',
      })
    });

    const result = await resolveTrainingBasecampArtwork(pilotContext);
    expect(result).toEqual({
      assetId: 'SR-MTN-MONTBLANC-001',
      version: 1,
      placement: 'hero',
      derivativePath: '/api/artwork/batches/batch-01/SR-MTN-MONTBLANC-001/v1/hero',
      url: '/api/artwork/approved/SR-MTN-MONTBLANC-001/hero',
      uri: '/api/artwork/approved/SR-MTN-MONTBLANC-001/hero',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/artwork/resolve/SR-MTN-MONTBLANC-001/hero',
      { signal: expect.any(AbortSignal) },
    );
  });

  it('rejects a URI whose asset identity does not match the requested approved derivative', async () => {
    global.__DEV__ = true;
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assetId: 'SR-MTN-MATTERHORN-001',
        version: 1,
        placement: 'hero',
        derivativePath: '/api/artwork/batches/batch-01/SR-MTN-MATTERHORN-001/v1/hero',
        url: '/api/artwork/approved/SR-MTN-MATTERHORN-001/hero',
      }),
    });

    expect(await resolveTrainingBasecampArtwork(pilotContext)).toBeNull();
  });

  it('rejects a different version or derivative even when a URI is present', async () => {
    global.__DEV__ = true;
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assetId: 'SR-MTN-MONTBLANC-001',
        version: 2,
        placement: 'hero',
        derivativePath: '/api/artwork/batches/batch-01/SR-MTN-MONTBLANC-001/v2/hero',
        url: '/api/artwork/approved/SR-MTN-MONTBLANC-001/hero',
      }),
    });

    expect(await resolveTrainingBasecampArtwork(pilotContext)).toBeNull();
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
