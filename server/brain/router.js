const { processMessage } = require("./core");
const ollama = require("../providers/ollama");
const maths = require("./specialists/maths");
const coding = require("./specialists/coding");
const research = require("./specialists/research");
const {
  getSpecialist,
  hasSpecialist
} = require("./specialists/registry");

async function route(message, context = {}) {
  const core = await processMessage(
    message,
    context
  );

  if (!core.ok) {
    return core;
  }

  const intent = core.intent.primary;

  if (intent === "greeting") {
    const specialist = getSpecialist("general");

    return {
      ok: true,
      route: "local",
      specialist: specialist.id,
      specialistInfo: specialist,
      intent: core.intent,
      response:
        "Hello! I'm Kylor. What would you like to work on?"
    };
  }

  if (intent === "math") {
    const specialist = getSpecialist("maths");
    const result = maths.solve(
      core.normalized
    );

    if (result.ok) {
      return {
        ok: true,
        route: "specialist",
        specialist: specialist.id,
        specialistInfo: specialist,
        intent: core.intent,
        response: String(result.answer),
        calculation: result
      };
    }

    return {
      ok: false,
      route: "specialist",
      specialist: specialist.id,
      specialistInfo: specialist,
      intent: core.intent,
      error: result.error
    };
  }

  if (intent === "coding") {
    const specialist = getSpecialist("coding");

    if (
      !specialist ||
      !hasSpecialist("coding")
    ) {
      return {
        ok: false,
        route: "system",
        error:
          "Coding specialist is not registered."
      };
    }

    const result = await coding.solve(
      core.normalized,
      core.intent,
      context.history || [],
      context.options || {}
    );

    return {
      ok: result.ok,
      route: "specialist",
      specialist: specialist.id,
      specialistInfo: specialist,
      intent: core.intent,
      analysis: result.analysis,
      response: result.response || null,
      model: result.model || null,
      error: result.error || null,
      details: result.details || null
    };
  }

  const specialistMap = {
    research: "research",
    science: "science",
    training: "trainer"
  };

  const specialistId =
    specialistMap[intent];

  if (specialistId) {
    if (!hasSpecialist(specialistId)) {
      return {
        ok: false,
        route: "system",
        error:
          `Specialist "${specialistId}" is not registered.`
      };
    }

    const specialist =
      getSpecialist(specialistId);

    if (intent === "research") {
      const result = await research.solve(
        core.normalized,
        core.intent,
        context.history || [],
        context.options || {}
      );

      return {
        ok: result.ok,
        route: "specialist",
        specialist: specialist.id,
        specialistInfo: specialist,
        intent: core.intent,
        analysis: result.analysis,
        response: result.response || null,
        model: result.model || null,
        error: result.error || null,
        details: result.details || null,
        knowledge: result.knowledge || [],
        validation: result.validation || null
      };
    }

    return {
      ok: true,
      route: "specialist",
      specialist: specialist.id,
      specialistInfo: specialist,
      intent: core.intent,
      status: "pending"
    };
  }

  const general =
    getSpecialist("general");

  const model =
    await ollama.health();

  if (!model.available) {
    return {
      ok: false,
      route: "qwen",
      specialist: general.id,
      specialistInfo: general,
      intent: core.intent,
      error:
        "Qwen is currently unavailable.",
      provider: {
        host: ollama.OLLAMA_HOST,
        model: ollama.OLLAMA_MODEL
      }
    };
  }

  const result =
    await ollama.generate([
      {
        role: "system",
        content:
          "You are Kylor, a helpful local AI assistant. Answer clearly, accurately, and concisely."
      },
      {
        role: "user",
        content: core.normalized
      }
    ]);

  return {
    ok: result.ok,
    route: "qwen",
    specialist: general.id,
    specialistInfo: general,
    intent: core.intent,
    response: result.text,
    error: result.error || null,
    model: result.model
  };
}

module.exports = {
  route
};
