const { validateResults } = require("./index");

const DEFAULT_TIMEOUT = 15000;
const MAX_HTML_SIZE = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 30000;

function isHttpUrl(value) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function stripHtml(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

async function fetchPage(url, options = {}) {
  if (!isHttpUrl(url)) {
    return {
      ok: false,
      error: "Only HTTP and HTTPS URLs are allowed."
    };
  }

  const timeout = options.timeout || DEFAULT_TIMEOUT;

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "KylorResearch/1.0",
        "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9"
      },
      signal: AbortSignal.timeout(timeout)
    });

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `HTTP ${response.status}`
      };
    }

    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml") &&
      !contentType.includes("text/plain")
    ) {
      return {
        ok: false,
        status: response.status,
        error: "Unsupported content type."
      };
    }

    const contentLength = Number(
      response.headers.get("content-length") || 0
    );

    if (contentLength > MAX_HTML_SIZE) {
      return {
        ok: false,
        status: response.status,
        error: "Page exceeds the maximum allowed size."
      };
    }

    const html = await response.text();

    if (Buffer.byteLength(html, "utf8") > MAX_HTML_SIZE) {
      return {
        ok: false,
        status: response.status,
        error: "Page exceeds the maximum allowed size."
      };
    }

    return {
      ok: true,
      url: response.url || url,
      status: response.status,
      contentType,
      text: stripHtml(html)
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error.name === "TimeoutError" || error.name === "AbortError"
          ? "Request timed out."
          : "Unable to fetch page.",
      details: error.message
    };
  }
}

async function fetchSources(results, options = {}) {
  const validResults = validateResults(results);
  const output = [];

  for (const result of validResults) {
    const page = await fetchPage(result.url, options);

    output.push({
      ...result,
      fetched: page.ok,
      page
    });
  }

  return output;
}

module.exports = {
  fetchPage,
  fetchSources,
  stripHtml,
  isHttpUrl
};
