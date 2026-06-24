import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseSportsResponse, executeLiveDataTool } from '../lib/tools/liveData';

// ─── parseSportsResponse ──────────────────────────────────────────────────────

describe('parseSportsResponse', () => {
  it('returns compact match list for standard football-data.org shape', () => {
    const raw = {
      competition: { name: 'Premier League' },
      matches: [
        {
          homeTeam: { name: 'Arsenal' },
          awayTeam: { name: 'Chelsea' },
          score: { fullTime: { home: 2, away: 1 } },
          status: 'FINISHED',
          utcDate: '2026-06-20T20:00:00Z',
        },
        {
          homeTeam: { name: 'Liverpool' },
          awayTeam: { name: 'Man City' },
          score: { fullTime: { home: null, away: null } },
          status: 'SCHEDULED',
          utcDate: '2026-06-21T15:00:00Z',
        },
      ],
    };

    const result = JSON.parse(parseSportsResponse(raw));
    expect(result.matches).toHaveLength(2);
    expect(result.competition).toBe('Premier League');
    expect(result.total).toBe(2);

    const [m1, m2] = result.matches;
    expect(m1.home).toBe('Arsenal');
    expect(m1.away).toBe('Chelsea');
    expect(m1.homeScore).toBe(2);
    expect(m1.awayScore).toBe(1);
    expect(m1.status).toBe('FINISHED');

    expect(m2.home).toBe('Liverpool');
    expect(m2.homeScore).toBeNull();
    expect(m2.status).toBe('SCHEDULED');
  });

  it('caps output at 20 matches even when more are present', () => {
    const matches = Array.from({ length: 35 }, (_, i) => ({
      homeTeam: { name: `Home ${i}` },
      awayTeam: { name: `Away ${i}` },
      score: { fullTime: { home: 0, away: 0 } },
      status: 'FINISHED',
      utcDate: '2026-06-20T20:00:00Z',
    }));

    const result = JSON.parse(parseSportsResponse({ matches }));
    expect(result.matches).toHaveLength(20);
    expect(result.total).toBe(35);
  });

  it('handles regularTime fallback score', () => {
    const raw = {
      matches: [
        {
          homeTeam: { name: 'Team A' },
          awayTeam: { name: 'Team B' },
          score: { regularTime: { home: 3, away: 0 } },
          status: 'FINISHED',
          utcDate: '2026-06-19T18:00:00Z',
        },
      ],
    };

    const result = JSON.parse(parseSportsResponse(raw));
    expect(result.matches[0].homeScore).toBe(3);
    expect(result.matches[0].awayScore).toBe(0);
  });

  it('returns error for unexpected API shape', () => {
    const result = JSON.parse(parseSportsResponse({ something: 'weird' }));
    expect(result.error).toBeDefined();
  });
});

// ─── executeLiveDataTool (iteration cap + env guard) ─────────────────────────

describe('executeLiveDataTool', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns error JSON when sports API env vars are not configured', async () => {
    delete process.env.SPORTS_API_BASE_URL;
    delete process.env.SPORTS_API_KEY;

    const result = JSON.parse(await executeLiveDataTool({ domain: 'sports', query: 'live scores' }));
    expect(result.error).toBe('sports API not configured');
  });

  it('returns error JSON for unsupported domain', async () => {
    // TypeScript would normally prevent this, but we test the runtime guard
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = JSON.parse(await executeLiveDataTool({ domain: 'finance' as any, query: 'AAPL' }));
    expect(result.error).toBe('unsupported domain');
  });

  it('returns error JSON when fetch throws (simulates timeout)', async () => {
    process.env.SPORTS_API_BASE_URL = 'https://api.football-data.org/v4';
    process.env.SPORTS_API_KEY = 'test-key';

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('AbortError')));

    const result = JSON.parse(await executeLiveDataTool({ domain: 'sports', query: 'world cup' }));
    expect(result.error).toMatch(/timed out|unavailable/);
  });

  it('returns error JSON when API responds with non-ok status', async () => {
    process.env.SPORTS_API_BASE_URL = 'https://api.football-data.org/v4';
    process.env.SPORTS_API_KEY = 'test-key';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    }));

    const result = JSON.parse(await executeLiveDataTool({ domain: 'sports', query: 'live' }));
    expect(result.error).toMatch(/429/);
  });
});
