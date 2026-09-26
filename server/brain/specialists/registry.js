const specialists = {
  general: {
    id: "general",
    name: "General",
    description: "Handles normal conversation, explanations, and general assistance."
  },

  coding: {
    id: "coding",
    name: "Coding",
    description: "Handles programming, debugging, websites, games, APIs, and code generation."
  },

  research: {
    id: "research",
    name: "Research",
    description: "Handles research, current information, documentation, comparisons, and sources."
  },

  maths: {
    id: "maths",
    name: "Maths",
    description: "Handles arithmetic, percentages, averages, algebra, statistics, and mathematical reasoning."
  },

  science: {
    id: "science",
    name: "Science",
    description: "Handles physics, chemistry, biology, space, and scientific explanations."
  },

  trainer: {
    id: "trainer",
    name: "Trainer",
    description: "Handles Kylor's learning, training, evaluation, and knowledge-improvement tasks."
  }
};

function getSpecialist(id) {
  return specialists[id] || null;
}

function listSpecialists() {
  return Object.values(specialists);
}

function hasSpecialist(id) {
  return Boolean(specialists[id]);
}

module.exports = {
  getSpecialist,
  listSpecialists,
  hasSpecialist,
  specialists
};
