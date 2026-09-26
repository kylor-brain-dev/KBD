const state = {
  page: "general",
  training: null,
  storage: null,
  graph: {
    scale: 1,
    x: 0,
    y: 0,
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { ok: response.ok, raw: text };
  }

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}


/* HOME */

$("#openTraining").addEventListener("click", () => {
  $("#homeView").classList.remove("active");
  $(".training-shell").classList.add("active");
  loadTraining();
});

$("#backHome").addEventListener("click", () => {
  $(".training-shell").classList.remove("active");
  $("#homeView").classList.add("active");
});


/* NAVIGATION */

$$(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;

    state.page = page;

    $$(".nav-item").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    $$(".training-page").forEach(section => {
      section.classList.toggle(
        "active",
        section.dataset.content === page
      );
    });

    const titles = {
      general: "General",
      overview: "Overview",
      subjects: "Subjects",
      knowledge: "Knowledge",
      progress: "Progress",
      runtime: "Runtime"
    };

    $("#pageTitle").textContent = titles[page] || "Training";
  });
});


/* THEME */

$("#themeToggle").addEventListener("click", () => {
  const shell = $(".training-shell");
  shell.classList.toggle("dark");

  const dark = shell.classList.contains("dark");

  $("#themeToggle").innerHTML = dark
    ? "<span>☀</span><span>Light mode</span>"
    : "<span>☾</span><span>Dark mode</span>";
});


/* TRAINING CONTROLS */

async function trainingAction(action) {
  try {
    await api(`/api/training/${action}`, {
      method: "POST"
    });

    await loadTraining();
  } catch (error) {
    console.error(error);
    showError(error.message);
  }
}

$("#startTraining").addEventListener("click", () => trainingAction("start"));
$("#pauseTraining").addEventListener("click", () => trainingAction("pause"));
$("#stopTraining").addEventListener("click", () => trainingAction("stop"));

$("#progressStart").addEventListener("click", () => trainingAction("start"));
$("#progressPause").addEventListener("click", () => trainingAction("pause"));
$("#progressStop").addEventListener("click", () => trainingAction("stop"));

$("#runtimeStart").addEventListener("click", () => trainingAction("start"));
$("#runtimePause").addEventListener("click", () => trainingAction("pause"));
$("#runtimeStop").addEventListener("click", () => trainingAction("stop"));


/* TRAINING DATA */

async function loadTraining() {
  try {
    const result = await api("/api/training/status");
    state.training = result.state || result;
    renderTraining();
  } catch (error) {
    console.error(error);
  }

  try {
    state.storage = await api("/api/storage/status");
    renderStorage();
  } catch (error) {
    console.error(error);
  }
}

function renderTraining() {
  const s = state.training || {};
  const runtime = liveRuntimeSeconds(s);
  const status = String(s.status || "stopped").toLowerCase();

  const formatted = formatTime(runtime);

  $("#topRuntime").textContent = formatted;
  $("#overviewRuntime").textContent = formatted;
  $("#progressRuntime").textContent = formatted;
  $("#runtimeLarge").textContent = formatted;

  $("#progressState").textContent = capitalize(status);
  $("#runtimeLargeState").textContent = capitalize(status);

  $("#sidebarStatus").textContent =
    status === "running"
      ? "Training"
      : status === "paused"
        ? "Paused"
        : "Ready";

  $("#engineState").textContent = status.toUpperCase();

  $("#overviewCompleted").textContent = s.completedTargets || 0;
  $("#overviewSources").textContent = s.collectedSources || 0;
  $("#overviewApproved").textContent = s.approvedSources || 0;

  $("#knowledgeApproved").textContent = s.approvedSources || 0;
  $("#knowledgeCollected").textContent = s.collectedSources || 0;
  $("#knowledgeCompleted").textContent = s.completedTargets || 0;

  const activeSubjects = Array.isArray(s.activeSubjects)
    ? s.activeSubjects
    : [];

  $("#progressActive").textContent =
    `${activeSubjects.length} active`;

  renderSubjects(s);
  renderGeneral(s);
  renderOverviewSubjects(s);
  renderGraph(s);
}

function liveRuntimeSeconds(s) {
  let total = Number(s.runtime?.totalSeconds || 0);

  if (
    String(s.status).toLowerCase() === "running" &&
    s.startedAt
  ) {
    const started = new Date(s.startedAt).getTime();

    if (Number.isFinite(started)) {
      total += Math.max(
        0,
        Math.floor((Date.now() - started) / 1000)
      );
    }
  }

  return total;
}

function renderGeneral(s) {
  const subjects = s.subjects || {};
  const general =
    subjects.general ||
    subjects.General ||
    Object.values(subjects)[0];

  if (!general) {
    $("#generalTarget").textContent =
      "General knowledge foundations";
    $("#generalProgressText").textContent =
      "Waiting for training";
    $("#generalProgressPercent").textContent = "0%";
    $("#generalProgress").style.width = "0%";
    return;
  }

  const completed = Number(
    general.targetsCompleted || 0
  );

  const total = Number(
    general.targetsTotal || 0
  );

  const percent = total
    ? Math.min(100, (completed / total) * 100)
    : 0;

  $("#generalTarget").textContent =
    general.currentTargetId ||
    "General knowledge foundations";

  $("#generalTargetStatus").textContent =
    String(general.status || "READY").toUpperCase();

  $("#generalProgressText").textContent =
    `${completed} of ${total || "—"} targets`;

  $("#generalProgressPercent").textContent =
    `${Math.round(percent)}%`;

  $("#generalProgress").style.width =
    `${percent}%`;
}

function renderSubjects(s) {
  const container = $("#subjectsGrid");
  const subjects = s.subjects || {};

  const entries = Object.entries(subjects);

  if (!entries.length) {
    container.innerHTML = `
      <div class="subject-card">
        <span class="card-kicker">EMPTY</span>
        <h3>No subjects loaded</h3>
        <p>The training engine has not created its subject plan yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = entries.map(([key, value]) => `
    <article class="subject-card">
      <span class="card-kicker">${escapeHtml(key)}</span>
      <h3>${escapeHtml(value.currentTargetId || "Ready")}</h3>
      <p>
        ${Number(value.targetsCompleted || 0)}
        / ${Number(value.targetsTotal || 0)}
        targets completed.
      </p>
    </article>
  `).join("");
}

function renderOverviewSubjects(s) {
  const container = $("#overviewSubjects");
  const subjects = s.subjects || {};
  const entries = Object.entries(subjects);

  if (!entries.length) {
    container.innerHTML = `
      <div class="subject-row">
        <span>No subject data available</span>
        <span>—</span>
      </div>
    `;
    return;
  }

  container.innerHTML = entries.map(([key, value]) => `
    <div class="subject-row">
      <span>${escapeHtml(key)}</span>
      <span>${escapeHtml(String(value.status || "ready"))}</span>
    </div>
  `).join("");
}

function renderStorage() {
  const s = state.storage || {};

  const percent =
    Number(
      s.usedPercent ??
      s.usagePercent ??
      s.percent ??
      0
    );

  $("#progressStorage").textContent =
    percent >= 90
      ? "Storage critical"
      : percent >= 85
        ? "Storage warning"
        : "Storage healthy";
}

function renderGraph(s) {
  const subjects = s.subjects || {};

  $$(".graph-node").forEach(node => {
    const key = node.dataset.node;
    const record =
      subjects[key] ||
      subjects[key.charAt(0).toUpperCase() + key.slice(1)];

    const unlocked =
      record &&
      (
        Number(record.targetsCompleted || 0) > 0 ||
        String(record.status || "").toLowerCase() === "researching" ||
        String(record.status || "").toLowerCase() === "completed"
      );

    node.classList.toggle("unlocked", Boolean(unlocked));
  });

  $$(".graph-line").forEach(line => {
    const branch = line.dataset.branch;
    const node =
      subjects[branch] ||
      subjects[branch.charAt(0).toUpperCase() + branch.slice(1)];

    const active =
      node &&
      (
        String(node.status || "").toLowerCase() === "researching" ||
        Number(node.targetsCompleted || 0) > 0
      );

    line.classList.toggle("active", Boolean(active));
  });
}


/* GRAPH ZOOM */

const stage = $(".progress-stage");
const svg = $("#brainSvg");
const world = $("#graphWorld");
const crosshair = $(".graph-crosshair");

function applyGraphTransform() {
  world.setAttribute(
    "transform",
    `translate(${state.graph.x} ${state.graph.y}) scale(${state.graph.scale})`
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function zoomAt(clientX, clientY, factor) {
  const rect = svg.getBoundingClientRect();

  const mouseX =
    ((clientX - rect.left) / rect.width) * 1200;

  const mouseY =
    ((clientY - rect.top) / rect.height) * 700;

  const oldScale = state.graph.scale;
  const nextScale = clamp(
    oldScale * factor,
    .55,
    2.8
  );

  const localX =
    (mouseX - state.graph.x) / oldScale;

  const localY =
    (mouseY - state.graph.y) / oldScale;

  state.graph.x =
    mouseX - localX * nextScale;

  state.graph.y =
    mouseY - localY * nextScale;

  state.graph.scale = nextScale;

  applyGraphTransform();
}

stage.addEventListener("wheel", event => {
  event.preventDefault();

  zoomAt(
    event.clientX,
    event.clientY,
    event.deltaY < 0 ? 1.12 : 0.89
  );
}, { passive: false });


stage.addEventListener("mousemove", event => {
  const rect = stage.getBoundingClientRect();

  crosshair.style.left =
    `${event.clientX - rect.left - 10}px`;

  crosshair.style.top =
    `${event.clientY - rect.top - 10}px`;
});


stage.addEventListener("mousedown", event => {
  if (event.button !== 0) return;

  state.graph.dragging = true;
  state.graph.startX = event.clientX;
  state.graph.startY = event.clientY;
  state.graph.originX = state.graph.x;
  state.graph.originY = state.graph.y;
});

window.addEventListener("mousemove", event => {
  if (!state.graph.dragging) return;

  const rect = svg.getBoundingClientRect();

  const dx =
    ((event.clientX - state.graph.startX) / rect.width) * 1200;

  const dy =
    ((event.clientY - state.graph.startY) / rect.height) * 700;

  state.graph.x =
    state.graph.originX + dx;

  state.graph.y =
    state.graph.originY + dy;

  applyGraphTransform();
});

window.addEventListener("mouseup", () => {
  state.graph.dragging = false;
});

$("#zoomIn").addEventListener("click", event => {
  const rect = stage.getBoundingClientRect();

  zoomAt(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
    1.2
  );
});

$("#zoomOut").addEventListener("click", event => {
  const rect = stage.getBoundingClientRect();

  zoomAt(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
    .84
  );
});

$("#zoomReset").addEventListener("click", () => {
  state.graph.scale = 1;
  state.graph.x = 0;
  state.graph.y = 0;
  applyGraphTransform();
});

$("#zoomFullscreen").addEventListener("click", async () => {
  const target = $(".progress-stage");

  if (!document.fullscreenElement) {
    await target.requestFullscreen?.();
  } else {
    await document.exitFullscreen?.();
  }
});


/* HELPERS */

function formatTime(seconds) {
  seconds = Math.max(0, Math.floor(Number(seconds) || 0));

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return [
    String(h).padStart(2, "0"),
    String(m).padStart(2, "0"),
    String(s).padStart(2, "0")
  ].join(":");
}

function capitalize(value) {
  return String(value || "")
    .charAt(0)
    .toUpperCase() +
    String(value || "").slice(1);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showError(message) {
  console.error("Kylor:", message);
}


/* LIVE REFRESH */

setInterval(async () => {
  if (!$(".training-shell").classList.contains("active")) {
    return;
  }

  await loadTraining();
}, 1000);


/* START */

applyGraphTransform();
