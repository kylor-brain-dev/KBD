const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3.5:0.8b";

async function request(path, options = {}) {
  try {
    const response = await fetch(`${OLLAMA_HOST}${path}`, {
      ...options,
      signal: AbortSignal.timeout(options.timeout || 120000)
    });

    const text = await response.text();

    let data;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      return {
        ok: false,
        error: `Ollama returned HTTP ${response.status}`,
        details: data
      };
    }

    return {
      ok: true,
      data
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error.name === "TimeoutError" || error.name === "AbortError"
          ? "Ollama request timed out."
          : "Ollama is unavailable.",
      details: error.message
    };
  }
}

async function health() {
  const result = await request("/api/tags", {
    method: "GET",
    timeout: 5000
  });

  if (!result.ok) {
    return {
      ok: false,
      available: false,
      host: OLLAMA_HOST,
      model: OLLAMA_MODEL,
      error: result.error
    };
  }

  return {
    ok: true,
    available: true,
    host: OLLAMA_HOST,
    model: OLLAMA_MODEL,
    models: Array.isArray(result.data.models)
      ? result.data.models.map(model => model.name)
      : []
  };
}

async function generate(messages, options = {}) {
  const model = options.model || OLLAMA_MODEL;

  const ollamaOptions = {
    temperature: options.temperature ?? 0.4,
    num_ctx: options.num_ctx ?? 4096
  };

  if (options.num_predict != null) {
    ollamaOptions.num_predict = options.num_predict;
  }

  const result = await request("/api/chat", {
    method: "POST",
    timeout: options.timeout || 180000,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      think: false,
      options: ollamaOptions
    })
  });

  if (!result.ok) {
    return {
      ok: false,
      text: "",
      model,
      error: result.error,
      details: result.details
    };
  }

  return {
    ok: true,
    text: result.data.message?.content || "",
    model: result.data.model || model,
    done: result.data.done !== false,
    usage: {
      promptTokens: result.data.prompt_eval_count ?? null,
      completionTokens: result.data.eval_count ?? null,
      totalDuration: result.data.total_duration ?? null,
      loadDuration: result.data.load_duration ?? null,
      promptDuration: result.data.prompt_eval_duration ?? null,
      completionDuration: result.data.eval_duration ?? null
    }
  };
}

module.exports = {
  generate,
  health,
  OLLAMA_HOST,
  OLLAMA_MODEL
};
