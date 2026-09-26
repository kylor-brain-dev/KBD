const { SearchProvider, validateResults } = require("./index");

const DEFAULT_TIMEOUT = 15000;
const MAX_RESULTS = 10;

class FreeWebSearch extends SearchProvider {
  constructor(options = {}) {
    super({
      name: "free-web-search"
    });

    this.maxResults = Math.min(
      Math.max(Number(options.maxResults) || 10, 1),
      MAX_RESULTS
    );

    this.timeout = Number(options.timeout) || DEFAULT_TIMEOUT;
  }

  buildUrl(query) {
    const params = new URLSearchParams({
      q: String(query || "").trim()
    });

    return `https://html.duckduckgo.com/html/?${params.toString()}`;
  }

  parseResults(html) {
    const results = [];
    const text = String(html || "");

    const blocks = text.match(
      /<div[^>]+class="[^"]*result[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi
    ) || [];

    for (const block of blocks) {
      if (results.length >= this.maxResults) {
        break;
      }

      const linkMatch = block.match(
        /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"/i
      );

      if (!linkMatch) {
        continue;
      }

      const titleMatch = block.match(
        /<a[^>]+class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i
      );

      const snippetMatch = block.match(
        /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>/i
      );

      const clean = value =>
        String(value || "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/gi, "&")
          .replace(/&quot;/gi, '"')
          .replace(/&#x27;/gi, "'")
          .replace(/&#39;/gi, "'")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .replace(/\s+/g, " ")
          .trim();

      let resultUrl = linkMatch[1];

      resultUrl = resultUrl
        .replace(/&amp;/gi, "&")
        .replace(/^\/\//, "https://");

      try {
        const parsed = new URL(resultUrl);

        if (
          parsed.hostname === "duckduckgo.com" ||
          parsed.hostname === "www.duckduckgo.com"
        ) {
          const destination = parsed.searchParams.get("uddg");

          if (destination) {
            resultUrl = destination;
          }
        }
      } catch {
        continue;
      }

      results.push({
        title: clean(titleMatch?.[1]),
        url: resultUrl,
        snippet: clean(snippetMatch?.[1])
      });
    }

    return validateResults(results);
  }

  async search(query) {
    const cleanQuery = String(query || "").trim();

    if (!cleanQuery) {
      return {
        ok: false,
        error: "Search query is required.",
        results: []
      };
    }

    try {
      const response = await fetch(this.buildUrl(cleanQuery), {
        method: "GET",
        headers: {
          "User-Agent": "KylorResearch/1.0",
          "Accept": "text/html"
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `Search returned HTTP ${response.status}.`,
          results: []
        };
      }

      const html = await response.text();
      const results = this.parseResults(html);

      return {
        ok: true,
        provider: this.name,
        query: cleanQuery,
        results
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.name,
        query: cleanQuery,
        error:
          error.name === "TimeoutError" || error.name === "AbortError"
            ? "Search timed out."
            : "Free web search is unavailable.",
        results: []
      };
    }
  }
}

module.exports = {
  FreeWebSearch
};
