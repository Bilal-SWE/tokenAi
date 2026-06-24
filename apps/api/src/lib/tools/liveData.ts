export interface LiveDataArgs {
  domain: 'sports';
  query: string;
}

interface CompactMatch {
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  utcDate: string;
  competition?: string;
}

export async function executeLiveDataTool(args: LiveDataArgs): Promise<string> {
  try {
    switch (args.domain) {
      case 'sports':
        return await fetchSportsData(args.query);
      default:
        return JSON.stringify({ error: 'unsupported domain' });
    }
  } catch {
    return JSON.stringify({ error: 'live data unavailable' });
  }
}

async function fetchSportsData(query: string): Promise<string> {
  const baseUrl = process.env.SPORTS_API_BASE_URL;
  const apiKey = process.env.SPORTS_API_KEY;

  if (!baseUrl || !apiKey) {
    return JSON.stringify({ error: 'sports API not configured' });
  }

  const q = query.toLowerCase();
  let url: string;

  if (q.includes('world cup') || q.includes('wc 2026') || q.includes('fifa 2026')) {
    url = `${baseUrl}/competitions/WC/matches?status=LIVE,IN_PLAY,FINISHED&limit=20`;
  } else if (q.includes('today') || q.includes('live') || q.includes('score')) {
    const today = new Date().toISOString().split('T')[0];
    url = `${baseUrl}/matches?dateFrom=${today}&dateTo=${today}`;
  } else {
    // Generic: search recent matches
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    url = `${baseUrl}/matches?dateFrom=${weekAgo}&dateTo=${today}`;
  }

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { 'X-Auth-Token': apiKey },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return JSON.stringify({ error: 'sports API request timed out' });
  }

  if (!resp.ok) {
    return JSON.stringify({ error: `sports API error ${resp.status}` });
  }

  const data = await resp.json() as Record<string, unknown>;
  return parseSportsResponse(data);
}

// Exported so it can be unit-tested independently
export function parseSportsResponse(data: Record<string, unknown>): string {
  const rawMatches = data.matches;
  if (!Array.isArray(rawMatches)) {
    // Some APIs return a single match at the top level
    if (typeof data.homeTeam === 'object') {
      return JSON.stringify(trimMatch(data));
    }
    return JSON.stringify({ error: 'unexpected response shape', keys: Object.keys(data) });
  }

  const matches: CompactMatch[] = (rawMatches as Record<string, unknown>[])
    .slice(0, 20)
    .map(trimMatch);

  return JSON.stringify({
    matches,
    total: rawMatches.length,
    competition: (data.competition as Record<string, string> | undefined)?.name,
  });
}

function trimMatch(m: Record<string, unknown>): CompactMatch {
  const score = m.score as Record<string, Record<string, number | null> | null> | undefined;
  // football-data.org uses fullTime; some APIs use regularTime or score directly
  const ft = score?.fullTime ?? score?.regularTime ?? score?.winner as unknown as Record<string, number | null> | undefined;
  return {
    home: (m.homeTeam as Record<string, string> | undefined)?.name ?? 'Unknown',
    away: (m.awayTeam as Record<string, string> | undefined)?.name ?? 'Unknown',
    homeScore: ft?.home ?? null,
    awayScore: ft?.away ?? null,
    status: (m.status as string | undefined) ?? 'UNKNOWN',
    utcDate: (m.utcDate as string | undefined) ?? '',
    competition: (m.competition as Record<string, string> | undefined)?.name,
  };
}
