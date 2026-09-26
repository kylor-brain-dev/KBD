function round(value) {
  return Number(Number(value).toFixed(10));
}

function calculate(a, operator, b) {
  switch (operator) {
    case "+":
      return round(a + b);
    case "-":
      return round(a - b);
    case "*":
      return round(a * b);
    case "/":
      if (b === 0) {
        throw new Error("Cannot divide by zero.");
      }
      return round(a / b);
    case "%":
      return round((a / 100) * b);
    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

function solve(message) {
  const text = String(message).toLowerCase().trim();

  const percentage = text.match(
    /(?:what is\s+)?(-?\d+(?:\.\d+)?)\s*%\s*(?:of)\s*(-?\d+(?:\.\d+)?)/
  );

  if (percentage) {
    const percent = Number(percentage[1]);
    const value = Number(percentage[2]);

    return {
      ok: true,
      type: "percentage",
      expression: `${percent}% of ${value}`,
      answer: calculate(percent, "%", value)
    };
  }

  const arithmetic = text.match(
    /(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)/
  );

  if (arithmetic) {
    const a = Number(arithmetic[1]);
    const operator = arithmetic[2];
    const b = Number(arithmetic[3]);

    return {
      ok: true,
      type: "arithmetic",
      expression: `${a} ${operator} ${b}`,
      answer: calculate(a, operator, b)
    };
  }

  const meanMatch = text.match(
    /(?:mean|average)(?:\s+of)?\s*((?:-?\d+(?:\.\d+)?\s*,?\s*)+)/
  );

  if (meanMatch) {
    const numbers = meanMatch[1]
      .match(/-?\d+(?:\.\d+)?/g)
      .map(Number);

    if (numbers.length > 0) {
      const total = numbers.reduce((sum, number) => sum + number, 0);

      return {
        ok: true,
        type: "mean",
        numbers,
        answer: round(total / numbers.length)
      };
    }
  }

  return {
    ok: false,
    type: "unsupported",
    error: "I could not identify a supported maths expression."
  };
}

module.exports = {
  solve
};
