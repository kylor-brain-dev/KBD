const { route } = require("../brain/router");

(async () => {
  console.log("=== KYLOR LIVE BRAIN TEST ===");

  const result = await route(
    "What is JavaScript and what is it used for?"
  );

  console.log("OK:", result.ok);
  console.log("Route:", result.route);
  console.log("Specialist:", result.specialist);
  console.log(
    "Knowledge matches:",
    result.knowledge
      ? result.knowledge.length
      : 0
  );
  console.log(
    "Model:",
    result.model || "(none)"
  );

  if (result.validation) {
    console.log(
      "Validation:",
      result.validation.status
    );
    console.log(
      "Knowledge used:",
      result.validation.knowledgeUsed
    );
    console.log(
      "Sources:",
      result.validation.sourceCount
    );
    console.log(
      "Claims:",
      result.validation.claimCount
    );
    console.log(
      "Supported claims:",
      result.validation.supportedClaims
    );
    console.log(
      "Weak claims:",
      result.validation.weakClaims
    );
    console.log(
      "Unsupported claims:",
      result.validation.unsupportedClaims
    );
    console.log(
      "Grounding score:",
      result.validation.groundingScore
    );

    if (result.validation.reasons.length) {
      console.log(
        "Validation reasons:",
        result.validation.reasons.join("; ")
      );
    }
  } else {
    console.log(
      "Validation: (not available)"
    );
  }

  if (result.response) {
    console.log("");
    console.log("Response:");
    console.log(
      result.response.slice(0, 1000)
    );
  }

  if (!result.ok) {
    console.error(
      "ERROR:",
      result.error || "Unknown error"
    );
    process.exitCode = 1;
    return;
  }

  if (
    result.validation &&
    result.validation.status !== "valid"
  ) {
    console.error("");
    console.error(
      "LIVE BRAIN TEST: FAIL - response validation rejected."
    );
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log(
    "LIVE BRAIN TEST: PASS"
  );
})();
