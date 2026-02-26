import type { WebSearchRequest } from '@j52/shared';

const TAVILY_API_URL = 'https://api.tavily.com';

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface ExtractResult {
  url: string;
  raw_content: string;
}

export class WebSearchTool {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TAVILY_API_KEY || '';
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  async search(request: WebSearchRequest): Promise<SearchResult[]> {
    if (!this.apiKey) throw new Error('Tavily API key not configured');

    const response = await fetch(`${TAVILY_API_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.apiKey,
        query: request.query,
        search_depth: request.searchDepth || 'basic',
        max_results: 5,
        include_answer: true
      })
    });

    if (!response.ok) throw new Error(`Tavily search failed: ${response.status}`);
    const data = await response.json() as { results: SearchResult[] };
    return data.results;
  }

  async extract(urls: string[]): Promise<ExtractResult[]> {
    if (!this.apiKey) throw new Error('Tavily API key not configured');

    const response = await fetch(`${TAVILY_API_URL}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.apiKey,
        urls: urls.slice(0, 5)
      })
    });

    if (!response.ok) throw new Error(`Tavily extract failed: ${response.status}`);
    const data = await response.json() as { results: ExtractResult[] };
    return data.results;
  }
}
