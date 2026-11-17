/* Business SuccessHQ — original app. Data stays on this device. */
(function () {
  const D = window.BIZHQ_DATA;
  const KEY = "bizhq-data-v1";
  const THEME_KEY = "bizhq-theme";
  const TZ = "America/Chicago";

  const NAV = [
    { id: "home", href: "#/home", label: "Home", group: "Start", ico: "H" },
    { id: "ideas", href: "#/ideas", label: "Ideas", group: "Start", ico: "I" },
    { id: "goals", href: "#/goals", label: "Goals", group: "Work", ico: "G" },
    { id: "plan", href: "#/plan", label: "Plan", group: "Work", ico: "P" },
    { id: "habits", href: "#/habits", label: "Habits", group: "Work", ico: "R" },
    { id: "numbers", href: "#/numbers", label: "Numbers", group: "Work", ico: "N" },
    { id: "playbooks", href: "#/playbooks", label: "Playbooks", group: "Guides", ico: "B" },
    { id: "library", href: "#/library", label: "Library", group: "Guides", ico: "L" },
    { id: "notes", href: "#/notes", label: "Notes", group: "Guides", ico: "T" },
    { id: "video-notes", href: "#/video-notes", label: "Video notes", group: "Guides", ico: "V" },
    { id: "sync", href: "#/sync", label: "Sync", group: "More", ico: "S" },
    { id: "about", href: "#/about", label: "About", group: "More", ico: "A" }
  ];

  let state = load();
  let ideasFilter = "all";
  let vnSearch = "";
  let vnTag = "";
  let vnVenture = "";
  let vnFormSteps = [];
  let vnEditingStep = "";
  let vnImportState = null;
  let toastTimer = 0;

  function uid() {
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function defaultWeights() {
    const w = {};
    D.SCORE_CRITERIA.forEach((c) => { w[c.id] = 5; });
    return w;
  }

  function emptyState() {
    return {
      version: 1,
      ventures: [],
      goals: [],
      plans: [],
      habits: [],
      habitLogs: {},
      kpis: [],
      notes: [],
      videoNotes: [],
      playbookProgress: {},
      filters: {},
      settings: {},
      settingsTimes: {},
      tombstones: { ventures: {}, goals: {}, plans: {}, habits: {}, kpis: {}, notes: {}, videoNotes: {}, habitLogs: {}, playbookProgress: {} }
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return migrateState(emptyState());
      const s = JSON.parse(raw);
      return migrateState(Object.assign(emptyState(), s));
    } catch (e) {
      return migrateState(emptyState());
    }
  }

  function migrateState(s) {
    if (!s.tombstones) s.tombstones = (window.BizhqSync && BizhqSync.emptyTombs()) || emptyState().tombstones;
    ["ventures", "goals", "plans", "habits", "kpis", "notes", "videoNotes", "habitLogs", "playbookProgress"].forEach(function (k) {
      if (!s.tombstones[k]) s.tombstones[k] = {};
    });
    if (!s.settings) s.settings = {};
    if (!s.settingsTimes) s.settingsTimes = {};
    if (!s.filters) s.filters = {};
    if (!Array.isArray(s.videoNotes)) s.videoNotes = [];
    if (s.settings.theme == null) {
      try { s.settings.theme = localStorage.getItem(THEME_KEY) || ""; } catch (e) { s.settings.theme = ""; }
    }
    s.habitLogs = normalizeFlagMap(s.habitLogs);
    s.playbookProgress = normalizeFlagMap(s.playbookProgress);
    s.version = 2;
    return s;
  }

  function normalizeFlagMap(src) {
    const out = {};
    Object.keys(src || {}).forEach(function (a) {
      const row = src[a] || {};
      out[a] = {};
      Object.keys(row).forEach(function (b) {
        const e = row[b];
        if (e === true) out[a][b] = { value: true, updatedAt: "" };
        else if (e && typeof e === "object") out[a][b] = { value: !!e.value, updatedAt: e.updatedAt || "" };
        else if (e === false) out[a][b] = { value: false, updatedAt: "" };
      });
    });
    return out;
  }

  function flagOn(rec, id) {
    const e = rec && rec[id];
    if (e === true) return true;
    if (e && typeof e === "object") return !!e.value;
    return false;
  }

  function setFlag(map, a, b, on) {
    if (!map[a]) map[a] = {};
    map[a][b] = { value: !!on, updatedAt: nowISO() };
  }

  function addTomb(kind, id) {
    if (!state.tombstones) state.tombstones = BizhqSync.emptyTombs();
    if (!state.tombstones[kind]) state.tombstones[kind] = {};
    state.tombstones[kind][id] = nowISO();
  }

  function setSetting(key, value) {
    if (!state.settings) state.settings = {};
    if (!state.settingsTimes) state.settingsTimes = {};
    state.settings[key] = value;
    state.settingsTimes[key] = nowISO();
  }

  function applyThemeFromSettings() {
    const theme = state.settings && state.settings.theme;
    if (theme === "dark" || theme === "light") {
      document.documentElement.dataset.theme = theme;
      try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    }
  }

  function save(opts) {
    opts = opts || {};
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      toast("Could not save on this device. Storage may be full.");
    }
    if (!opts.skipPush) schedulePush();
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function todayISO() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date());
  }

  function formatLongDate(date) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
      timeZone: TZ
    }).format(date || new Date());
  }

  function formatClock() {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: TZ, timeZoneName: "short"
    }).format(new Date());
  }

  function formatDay(iso) {
    if (!iso) return "";
    const part = String(iso).slice(0, 10);
    const [y, m, d] = part.split("-").map(Number);
    if (!y || !m || !d) return part;
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric", timeZone: "UTC"
    }).format(dt);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function touch(obj) {
    obj.updatedAt = nowISO();
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  function getVenture(id) {
    return state.ventures.find((v) => v.id === id) || null;
  }

  function scoreResult(venture) {
    if (!venture) return { value: null, counted: 0, total: D.SCORE_CRITERIA.length };
    const scores = venture.scores || {};
    const weights = venture.weights || defaultWeights();
    let num = 0, den = 0, n = 0;
    D.SCORE_CRITERIA.forEach((c) => {
      const s = Number(scores[c.id]);
      const w = Number(weights[c.id]);
      if (!Number.isFinite(s) || s < 1 || s > 10) return;
      if (!Number.isFinite(w) || w <= 0) return;
      num += (s / 10) * w;
      den += w;
      n += 1;
    });
    if (!den) return { value: null, counted: 0, total: D.SCORE_CRITERIA.length };
    return { value: Math.round((num / den) * 100), counted: n, total: D.SCORE_CRITERIA.length };
  }

  function validationCounts(venture) {
    const out = {};
    Object.keys(D.VALIDATION).forEach((key) => {
      const pack = D.VALIDATION[key];
      const rec = (venture && venture.validation && venture.validation[key]) || {};
      const done = pack.steps.filter((s) => rec[s.id]).length;
      out[key] = { done, total: pack.steps.length };
    });
    return out;
  }

  function planFor(ventureId) {
    let p = state.plans.find((x) => (x.ventureId || "") === (ventureId || ""));
    if (!p) {
      p = { id: uid(), ventureId: ventureId || "", sections: {}, updatedAt: nowISO() };
      D.PLAN_SECTIONS.forEach((s) => { p.sections[s.id] = ""; });
      state.plans.push(p);
      save();
    }
    return p;
  }

  function planFilled(plan) {
    if (!plan) return { filled: 0, total: D.PLAN_SECTIONS.length, core: false };
    let filled = 0;
    D.PLAN_SECTIONS.forEach((s) => {
      if (String(plan.sections[s.id] || "").trim()) filled += 1;
    });
    const coreIds = ["vision", "customers", "offer", "next90"];
    const core = coreIds.every((id) => String(plan.sections[id] || "").trim());
    return { filled, total: D.PLAN_SECTIONS.length, core };
  }

  function legalProgress(ventureId) {
    const legalIds = ["tx-llc", "ein", "tx-tax", "idea-to-launch"];
    let any = 0, completeish = 0;
    legalIds.forEach((pid) => {
      const rec = progressFor(pid, ventureId);
      const book = D.PLAYBOOKS.find((p) => p.id === pid);
      if (!book) return;
      const done = book.steps.filter((s) => flagOn(rec, s.id)).length;
      if (done) any += 1;
      if (done >= Math.ceil(book.steps.length * 0.5)) completeish += 1;
    });
    return { any, completeish };
  }

  function progressFor(playbookId, ventureId) {
    const key = playbookId + "::" + (ventureId || "none");
    return state.playbookProgress[key] || {};
  }

  function setProgress(playbookId, ventureId, stepId, on) {
    const key = playbookId + "::" + (ventureId || "none");
    if (!state.playbookProgress[key]) state.playbookProgress[key] = {};
    setFlag(state.playbookProgress, key, stepId, on);
    save();
  }

  function pathState(venture) {
    const steps = D.PATH_STEPS.map((step) => {
      const st = pathStepStatus(venture, step.id);
      return Object.assign({}, step, st);
    });
    const done = steps.filter((s) => s.status === "done").length;
    return { steps, done, total: steps.length };
  }

  function pathStepStatus(v, id) {
    if (!v) return { status: "todo", detail: "Add the idea first." };
    if (id === "capture") {
      const ok = String(v.name || "").trim() && String(v.description || "").trim();
      return ok
        ? { status: "done", detail: "Named and described." }
        : { status: String(v.name || "").trim() ? "progress" : "todo", detail: "Add a short description to finish this step." };
    }
    if (id === "score") {
      const r = scoreResult(v);
      if (r.counted === r.total) return { status: "done", detail: "Weighted score: " + r.value + " out of 100." };
      if (r.counted) return { status: "progress", detail: r.counted + " of " + r.total + " ratings filled." };
      return { status: "todo", detail: "Not scored yet." };
    }
    if (id === "validate") {
      const c = validationCounts(v);
      const parts = Object.values(c);
      const finished = parts.filter((p) => p.done >= 4).length;
      const started = parts.filter((p) => p.done > 0).length;
      if (finished === 3) return { status: "done", detail: "All three checklists are well under way." };
      if (started) return { status: "progress", detail: started + " of 3 checklists started." };
      return { status: "todo", detail: "No validation steps checked yet." };
    }
    if (id === "plan") {
      const p = state.plans.find((x) => (x.ventureId || "") === v.id);
      const f = planFilled(p);
      if (f.core) return { status: "done", detail: f.filled + " of " + f.total + " sections have writing." };
      if (f.filled) return { status: "progress", detail: f.filled + " of " + f.total + " sections have writing." };
      return { status: "todo", detail: "The plan is still empty." };
    }
    if (id === "legal") {
      if (v.legalDone) return { status: "done", detail: "You marked the legal basics that apply as handled." };
      const lp = legalProgress(v.id);
      if (lp.completeish) return { status: "progress", detail: "You have made solid progress on an official checklist." };
      if (lp.any) return { status: "progress", detail: "A legal checklist has been started." };
      return { status: "todo", detail: "Open a playbook when you are ready. Not every idea needs every form." };
    }
    if (id === "goals") {
      const n = state.goals.filter((g) => g.ventureId === v.id).length;
      if (n) return { status: "done", detail: n + " goal" + (n === 1 ? "" : "s") + " tied to this." };
      return { status: "todo", detail: "No goals tied to this yet." };
    }
    if (id === "track") {
      const kpis = state.kpis.filter((k) => k.ventureId === v.id);
      const withEntry = kpis.filter((k) => (k.entries || []).length);
      if (withEntry.length) return { status: "done", detail: "Figures have been entered." };
      if (kpis.length) return { status: "progress", detail: "A tracker is set up, but no figures have been entered yet." };
      return { status: "todo", detail: "No numbers are being tracked yet." };
    }
    if (id === "review") {
      if (v.review && v.review.at) return { status: "done", detail: "Last review: " + formatDay(v.review.at) + "." };
      return { status: "todo", detail: "You have not recorded a review yet." };
    }
    return { status: "todo", detail: "" };
  }

  function parseRoute() {
    let h = (location.hash || "#/home").replace(/^#/, "");
    if (!h.startsWith("/")) h = "/" + h;
    const qIndex = h.indexOf("?");
    const query = {};
    if (qIndex >= 0) {
      new URLSearchParams(h.slice(qIndex + 1)).forEach((val, key) => { query[key] = val; });
      h = h.slice(0, qIndex);
    }
    const parts = h.split("/").filter(Boolean);
    return { name: parts[0] || "home", parts, query };
  }

  function go(hash) {
    location.hash = hash;
  }

  function isActive(id) {
    const r = parseRoute();
    if (id === "home") return r.name === "home" || !r.name;
    return r.name === id;
  }

  function renderNav() {
    const rail = document.getElementById("rail");
    let html = "";
    let last = "";
    NAV.forEach((n) => {
      if (n.group !== last) {
        html += '<div class="nav-group">' + esc(n.group) + "</div>";
        last = n.group;
      }
      html += '<a class="' + (isActive(n.id) ? "active" : "") + '" href="' + n.href + '"><span class="nav-ico" aria-hidden="true">' + n.ico + "</span><span>" + esc(n.label) + "</span></a>";
    });
    rail.innerHTML = html;
    document.getElementById("tabs").innerHTML = NAV.filter((n) => n.id !== "about").map((n) => {
      return '<a class="' + (isActive(n.id) ? "active" : "") + '" href="' + n.href + '"><span class="nav-ico" aria-hidden="true">' + n.ico + "</span><span>" + esc(n.label) + "</span></a>";
    }).join("");
    const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const btn = document.getElementById("themeBtn");
    btn.textContent = theme === "dark" ? "Light mode" : "Dark mode";
    btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  }

  function closeMenu() {
    document.getElementById("rail").classList.remove("open");
    document.getElementById("railBackdrop").hidden = true;
    document.getElementById("menuBtn").setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    document.getElementById("rail").classList.add("open");
    document.getElementById("railBackdrop").hidden = false;
    document.getElementById("menuBtn").setAttribute("aria-expanded", "true");
  }

  function ventureSelect(selected, opts) {
    opts = opts || {};
    const list = state.ventures.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    let html = "";
    if (opts.allowAll) html += '<option value="__all__"' + (selected === "__all__" ? " selected" : "") + ">All ideas and businesses</option>";
    if (opts.allowNone !== false) html += '<option value=""' + (!selected ? " selected" : "") + ">Not tied to one yet</option>";
    if (!list.length && opts.emptyLabel) {
      html += '<option value="" disabled>' + esc(opts.emptyLabel) + "</option>";
    }
    list.forEach((v) => {
      const tag = v.kind === "business" ? "Business" : "Idea";
      html += '<option value="' + esc(v.id) + '"' + (v.id === selected ? " selected" : "") + ">" + esc(v.name) + " (" + tag + ")</option>";
    });
    return html;
  }

  function kindBadge(kind) {
    if (kind === "business") return '<span class="badge business">Business</span>';
    return '<span class="badge idea">Idea</span>';
  }

  function scoreBadge(v) {
    const r = scoreResult(v);
    if (r.value == null) return '<span class="badge">Not scored yet</span>';
    const extra = r.counted < r.total ? " · " + r.counted + " of " + r.total : "";
    return '<span class="badge ok">Score ' + r.value + extra + "</span>";
  }

  function scoreRing(value, counted, total) {
    const rad = 58, c = 2 * Math.PI * rad;
    const v = value == null ? 0 : value;
    const dash = (v / 100) * c;
    const label = value == null ? "—" : String(value);
    const sub = value == null ? "No score yet" : (counted < total ? counted + " of " + total + " ratings" : "out of 100");
    return '<svg class="score-ring" viewBox="0 0 140 140" role="img" aria-label="' + (value == null ? "No score yet" : "Weighted score " + value + " out of 100") + '">' +
      '<circle cx="70" cy="70" r="' + rad + '" fill="none" stroke="var(--line)" stroke-width="10"/>' +
      '<circle cx="70" cy="70" r="' + rad + '" fill="none" stroke="var(--gold)" stroke-width="10" stroke-linecap="round" transform="rotate(-90 70 70)" stroke-dasharray="' + dash.toFixed(2) + " " + c.toFixed(2) + '"/>' +
      '<text x="70" y="74" text-anchor="middle" font-size="32" font-weight="700" fill="currentColor" font-family="Georgia, serif">' + label + "</text>" +
      '<text x="70" y="96" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">' + esc(sub) + "</text></svg>";
  }

  function ideaSubnav(v, tab) {
    const id = v.id;
    const items = [
      ["overview", "Overview", "#/ideas/" + id],
      ["score", "Score", "#/ideas/" + id + "/score"],
      ["validate", "Validate", "#/ideas/" + id + "/validate"],
      ["path", "Path", "#/ideas/" + id + "/path"]
    ];
    return '<nav class="subtabs" aria-label="Idea sections">' + items.map((it) =>
      '<a class="' + (tab === it[0] ? "active" : "") + '" href="' + it[2] + '">' + it[1] + "</a>"
    ).join("") + "</nav>";
  }

  function statBox(n, label) {
    return '<div class="stat"><div class="n">' + esc(n) + '</div><div class="l">' + esc(label) + "</div></div>";
  }

  function startersBox() {
    return '<details class="starter-box"><summary>Have a business already? Add it in one tap</summary>' +
      '<p class="tiny">These names are optional starters. Nothing is added until you tap one, and no figures are filled in for you.</p>' +
      D.STARTERS.map((s) =>
        '<div class="starter"><strong>' + esc(s.name) + "</strong>" +
        '<p class="tiny">' + esc(s.blurb) + "</p>" +
        '<button type="button" class="btn" data-action="use-starter" data-id="' + esc(s.id) + '">Add this business</button></div>'
      ).join("") +
      "</details>";
  }

  function ideaCard(v) {
    const path = pathState(v);
    const pct = Math.round((path.done / path.total) * 100);
    const fromSpb = v.sourceVideoId ? ' <span class="badge">From The Success Playbook</span>' : "";
    return '<a class="card idea-card accent" href="#/ideas/' + esc(v.id) + '">' +
      '<div class="spread"><span class="title">' + esc(v.name) + "</span><span>" + kindBadge(v.kind) + " " + scoreBadge(v) + fromSpb + "</span></div>" +
      (v.description ? "<p class=\"tiny\">" + esc(v.description.slice(0, 160)) + (v.description.length > 160 ? "…" : "") + "</p>" : "") +
      '<div class="tiny">Path ' + path.done + " of " + path.total + " steps</div>" +
      '<div class="progress" aria-hidden="true"><span style="width:' + pct + '%"></span></div></a>';
  }

  function viewHome() {
    const ideas = state.ventures.filter((v) => v.kind === "idea").length;
    const biz = state.ventures.filter((v) => v.kind === "business").length;
    const today = todayISO();
    const habitsToday = state.habits.filter((h) => habitApplies(h, today));
    const habitsDone = habitsToday.filter((h) => isHabitDone(h, today)).length;
    const openGoals = state.goals.filter((g) => g.status !== "done").length;
    const recent = state.ventures.slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).slice(0, 3);

    let body = '<div class="page-head"><p class="kicker">Home</p><h1>Business SuccessHQ</h1>' +
      '<p class="lead">Capture any business idea, score it, test it, plan it, and track the work. Your information stays on this device.</p>' +
      '<p class="tiny">' + esc(formatLongDate()) + " · " + esc(formatClock()) + "</p></div>";

    body += '<div class="stat-strip">' +
      statBox(ideas, "Ideas") +
      statBox(biz, "Businesses") +
      statBox(openGoals, "Open goals") +
      statBox(habitsToday.length ? (habitsDone + "/" + habitsToday.length) : "—", "Habits today") +
      "</div>";

    if (!state.ventures.length) {
      body += '<div class="empty card accent">' +
        "<h2>Start with an idea</h2>" +
        "<p>This app is built for any business idea, not just one kind of work. Add a name and a short description, then score it and follow the path from idea to launch.</p>" +
        '<p class="row"><a class="btn primary" href="#/ideas/new">Add an idea</a><a class="btn" href="#/ideas/from-spb">From SuccessPlaybookHQ</a></p>' +
        startersBox() +
        "</div>";
    } else {
      body += '<p class="row"><a class="btn primary" href="#/ideas/new">Add an idea</a><a class="btn" href="#/ideas">All ideas</a><a class="btn" href="#/ideas/from-spb">From SuccessPlaybookHQ</a></p>';
      if (recent.length) {
        body += "<h2>Continue</h2><div class=\"list\">" + recent.map(ideaCard).join("") + "</div>";
      }
      body += startersBox();
    }

    body += syncTeaserCard() +
    '<div class="card accent" style="margin-top:20px"><h2>Video notes</h2>' +
      "<p>Paste a YouTube video summary, write how you will use it in your business, and keep step-by-step instructions you can check off.</p>" +
      '<p class="row"><a class="btn" href="#/video-notes">Open video notes</a><a class="btn" href="#/video-notes/new">Add a video note</a></p></div>';

    if (habitsToday.length) {
      body += '<div class="card" style="margin-top:20px"><div class="spread"><h2>Today\'s habits</h2><a href="#/habits">See all</a></div>' +
        habitsToday.map((h) => habitRow(h, today)).join("") + "</div>";
    }

    const goals = state.goals.filter((g) => g.status !== "done").slice(0, 4);
    if (goals.length) {
      body += '<div class="card" style="margin-top:20px"><div class="spread"><h2>Open goals</h2><a href="#/goals">See all</a></div>' +
        goals.map(goalCard).join("") + "</div>";
    }

    return body;
  }

  function viewIdeas() {
    const r = parseRoute();
    if (r.parts[1] === "new") return viewIdeaForm(null);
    if (r.parts[1] === "from-spb") return viewSpbCollection();
    if (r.parts[1]) {
      const v = getVenture(r.parts[1]);
      if (!v) return notFound("That idea or business was not found.");
      const tab = r.parts[2] || "overview";
      if (tab === "score") return viewScore(v);
      if (tab === "validate") return viewValidate(v);
      if (tab === "path") return viewPath(v);
      if (tab === "edit") return viewIdeaForm(v);
      return viewIdeaOverview(v);
    }

    const list = state.ventures.filter((v) => {
      if (ideasFilter === "idea") return v.kind === "idea";
      if (ideasFilter === "business") return v.kind === "business";
      return true;
    }).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

    let html = '<div class="page-head"><p class="kicker">Idea bank</p><h1>Ideas and businesses</h1>' +
      '<p class="lead">Capture any idea, score it, and keep each one\'s work in one place. You can tie goals, plans, numbers, and playbooks to any item here.</p></div>' +
      '<p class="row"><a class="btn primary" href="#/ideas/new">Add an idea</a></p>' +
      '<div class="subtabs" role="tablist">' +
      filterBtn("all", "All") + filterBtn("idea", "Ideas") + filterBtn("business", "Businesses") +
      "</div>";

    html += spbCollectionTeaser();

    if (!state.ventures.length) {
      html += '<div class="empty"><h2>No ideas yet</h2><p>Add your first idea, or use an optional starter for a business you already have.</p></div>' + startersBox();
    } else if (!list.length) {
      html += '<div class="empty"><p>Nothing in this filter yet.</p></div>';
    } else {
      html += '<div class="list">' + list.map(ideaCard).join("") + "</div>";
    }
    return html;
  }

  function formatViews(n) {
    return Number(n).toLocaleString("en-US");
  }

  function costLabel(cost) {
    if (cost === "low") return "Startup cost: Low";
    if (cost === "med") return "Startup cost: Medium";
    if (cost === "high") return "Startup cost: High";
    return "Startup cost: Not stated";
  }

  function spbVideoUrl(idea) {
    return "https://www.youtube.com/watch?v=" + idea.videoId;
  }

  function alreadyAddedSpb(idea) {
    return state.ventures.find((v) => v.sourceVideoId === idea.videoId);
  }

  function spbCollectionTeaser() {
    return '<div class="card accent spb-teaser">' +
      "<h2>From SuccessPlaybookHQ</h2>" +
      "<p>Business ideas summarized from videos on The Success Playbook YouTube channel. Add any of them to your idea bank to score it yourself.</p>" +
      '<p class="row"><a class="btn gold" href="#/ideas/from-spb">Browse the collection</a></p></div>';
  }

  function viewSpbCollection() {
    const ideas = D.SPB_IDEAS || [];
    const checked = formatDay(D.SPB_IDEAS_CHECKED);
    return '<div class="page-head"><p class="kicker"><a href="#/ideas">Ideas</a></p><h1>From SuccessPlaybookHQ</h1>' +
      '<p class="lead">These were chosen from videos the channel actually published. We favored higher view counts, videos that clearly present a startable business model, a fit for a solo founder, and lower startup cost when a cost was stated. The videos are dramatized short stories, not how-to guides. We left out stories that mainly required buying a farm, a factory, a motel, or another large property.</p></div>' +
      '<p class="note">Ideas summarized from The Success Playbook YouTube channel; not affiliated.</p>' +
      '<p class="tiny">View counts are as shown on ' + esc(checked) + '. Story income figures in the videos are fiction and are not treated as results here. Startup cost is marked “Not stated” unless the video gives a real cost to start the business.</p>' +
      '<div class="list spb-list">' + ideas.map(spbIdeaCard).join("") + "</div>";
  }

  function spbIdeaCard(idea) {
    const existing = alreadyAddedSpb(idea);
    const quote = idea.quote
      ? "<blockquote>“" + esc(idea.quote) + "”</blockquote>"
      : "";
    const action = existing
      ? '<a class="btn" href="#/ideas/' + esc(existing.id) + '">Already in your ideas</a>'
      : '<button type="button" class="btn primary" data-action="add-spb-idea" data-id="' + esc(idea.id) + '">Add to my ideas</button>';
    return '<article class="card accent spb-card">' +
      "<h2>" + esc(idea.name) + "</h2>" +
      "<p>" + esc(idea.summary) + "</p>" +
      quote +
      '<p class="tiny">Source: <a href="' + esc(spbVideoUrl(idea)) + '" target="_blank" rel="noopener noreferrer">' + esc(idea.videoTitle) + "</a></p>" +
      '<p class="tiny">' + esc(formatDay(idea.published)) + " · " + formatViews(idea.views) + " views (as shown " + esc(formatDay(D.SPB_IDEAS_CHECKED)) + ")</p>" +
      '<p><span class="badge">' + esc(costLabel(idea.cost)) + "</span></p>" +
      '<p class="row">' + action + "</p></article>";
  }

  function filterBtn(id, label) {
    return '<button type="button" class="' + (ideasFilter === id ? "active" : "") + '" data-action="ideas-filter" data-id="' + id + '">' + label + "</button>";
  }

  function viewIdeaForm(v) {
    const editing = !!v;
    return '<div class="page-head"><p class="kicker"><a href="#/ideas">Ideas</a></p><h1>' + (editing ? "Edit" : "New idea or business") + "</h1>" +
      '<p class="lead">Use this for any idea you want to explore. You can change the name later.</p></div>' +
      '<form class="card" data-action="save-venture" data-id="' + (v ? esc(v.id) : "") + '">' +
      '<div class="field"><label><span>Name</span><input name="name" type="text" maxlength="120" required value="' + esc(v ? v.name : "") + '" placeholder="For example, a lawn care service"></label></div>' +
      '<div class="field"><label><span>Type</span><select name="kind">' +
      '<option value="idea"' + (!v || v.kind === "idea" ? " selected" : "") + ">Idea I am exploring</option>" +
      '<option value="business"' + (v && v.kind === "business" ? " selected" : "") + ">A business I already run or am starting</option>" +
      "</select></label></div>" +
      '<div class="field"><label><span>Short description</span><textarea name="description" maxlength="2000" placeholder="What is it, in plain English?">' + esc(v ? v.description : "") + "</textarea></label></div>" +
      '<p class="row"><button type="submit" class="btn primary">' + (editing ? "Save" : "Add") + "</button>" +
      '<a class="btn ghost" href="#/ideas">Cancel</a></p></form>' +
      (editing ? "" : startersBox());
  }

  function linkCard(title, text, href) {
    return '<a class="card idea-card" href="' + esc(href) + '"><div class="title">' + esc(title) + '</div><p class="tiny">' + esc(text) + "</p></a>";
  }

  function viewIdeaOverview(v) {
    const path = pathState(v);
    const r = scoreResult(v);
    return '<div class="page-head"><p class="kicker"><a href="#/ideas">Ideas</a></p><h1>' + esc(v.name) + "</h1>" +
      "<p>" + kindBadge(v.kind) + " " + scoreBadge(v) + "</p></div>" +
      ideaSubnav(v, "overview") +
      '<div class="grid grid-2">' +
      '<div class="card accent">' + (v.description ? "<p>" + esc(v.description).replace(/\n/g, "<br>") + "</p>" : "<p class=\"muted\">No description yet.</p>") +
      (v.sourceUrl ? '<p class="tiny">Source: <a href="' + esc(v.sourceUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(v.sourceTitle || "The Success Playbook video") + "</a>. Ideas summarized from The Success Playbook YouTube channel; not affiliated.</p>" : "") +
      '<p class="row"><a class="btn" href="#/ideas/' + esc(v.id) + '/edit">Edit details</a></p></div>' +
      '<div class="card score-hero">' + scoreRing(r.value, r.counted, r.total) +
      '<div class="copy"><h3>Path to launch</h3><p>' + path.done + " of " + path.total + " steps done.</p>" +
      '<div class="progress"><span style="width:' + Math.round((path.done / path.total) * 100) + '%"></span></div>' +
      '<p class="row" style="margin-top:12px"><a class="btn gold" href="#/ideas/' + esc(v.id) + '/path">Open the path</a></p></div></div></div>' +
      '<div class="grid grid-2" style="margin-top:16px">' +
      linkCard("Score this idea", "Rate demand, cost, skills, time, competition, and profit potential. You set the weights.", "#/ideas/" + v.id + "/score") +
      linkCard("Validate it", "Customer interviews, competitor research, and a simple test offer.", "#/ideas/" + v.id + "/validate") +
      linkCard("Write the plan", "A plain-English plan tied to this idea.", "#/plan/" + v.id) +
      linkCard("Set goals", "Milestones for this idea or business.", "#/goals?venture=" + encodeURIComponent(v.id)) +
      linkCard("Track numbers", "Enter figures you actually have. This app does not fetch sales or bank data.", "#/numbers?venture=" + encodeURIComponent(v.id)) +
      linkCard("Open playbooks", "Official checklists you can attach to this idea.", "#/playbooks?venture=" + encodeURIComponent(v.id)) +
      linkCard("Video notes", "Paste a video summary and the steps for using it in this idea.", "#/video-notes?venture=" + encodeURIComponent(v.id)) +
      "</div>" +
      '<p class="tiny" style="margin-top:18px">Do not enter Social Security numbers, full Employer Identification Numbers, bank or card numbers, or passwords in this app.</p>' +
      '<p><button type="button" class="btn danger" data-action="delete-venture" data-id="' + esc(v.id) + '">Delete this item</button></p>';
  }

  function viewScore(v) {
    const r = scoreResult(v);
    const scores = v.scores || {};
    const weights = Object.assign(defaultWeights(), v.weights || {});
    const rows = D.SCORE_CRITERIA.map((c) => {
      const s = scores[c.id] != null && scores[c.id] !== "" ? Number(scores[c.id]) : 0;
      const w = Number(weights[c.id] || 5);
      return '<div class="score-row" data-crit="' + c.id + '">' +
        '<div class="score-head"><div><strong>' + esc(c.name) + '</strong><p class="help">' + esc(c.help) + "</p></div>" +
        '<div class="score-val" data-role="score-label">' + (s ? s : "—") + "</div></div>" +
        '<label class="sr" for="score-' + c.id + '">Rating for ' + esc(c.name) + "</label>" +
        '<input id="score-' + c.id + '" type="range" min="0" max="10" step="1" value="' + (s || 0) + '" data-action="set-score" data-id="' + esc(v.id) + '" data-key="' + c.id + '">' +
        '<div class="tiny">0 means not rated yet. 1 is weakest, 10 is strongest.</div>' +
        '<div class="weight-row"><span>How much this matters</span>' +
        '<input type="range" min="1" max="10" step="1" value="' + w + '" data-action="set-weight" data-id="' + esc(v.id) + '" data-key="' + c.id + '" aria-label="Weight for ' + esc(c.name) + '">' +
        '<strong data-role="weight-label">' + w + "</strong></div></div>";
    }).join("");

    return '<div class="page-head"><p class="kicker"><a href="#/ideas/' + esc(v.id) + '">' + esc(v.name) + "</a></p><h1>Idea scorecard</h1>" +
      '<p class="lead">These ratings are your judgment, not a prediction. The overall score is a weighted average of the ratings you enter. Equal weights are the default. You can change them.</p></div>' +
      ideaSubnav(v, "score") +
      '<div class="card score-hero" id="scoreHero">' + scoreRing(r.value, r.counted, r.total) +
      '<div class="copy" id="scoreCopy">' + scoreCopy(r) + "</div></div>" +
      '<div class="card" style="margin-top:16px">' + rows +
      '<p class="row" style="margin-top:16px"><button type="button" class="btn" data-action="reset-weights" data-id="' + esc(v.id) + '">Reset weights to equal</button></p></div>';
  }

  function scoreCopy(r) {
    if (r.value == null) return "<h3>No score yet</h3><p>Move each slider to give a rating from 1 to 10. Leave a slider at 0 if you are not ready to rate that part.</p>";
    if (r.counted < r.total) return "<h3>Partial score: " + r.value + " out of 100</h3><p>Based on " + r.counted + " of " + r.total + " ratings. Unrated items are left out of the average until you score them.</p>";
    return "<h3>Weighted score: " + r.value + " out of 100</h3><p>This uses all six ratings and the weights you set. A higher score is not a promise of success.</p>";
  }

  function updateScoreUI(v) {
    const r = scoreResult(v);
    const hero = document.getElementById("scoreHero");
    if (!hero) return;
    const ring = hero.querySelector(".score-ring");
    if (ring) ring.outerHTML = scoreRing(r.value, r.counted, r.total);
    const copy = document.getElementById("scoreCopy");
    if (copy) copy.innerHTML = scoreCopy(r);
  }

  function viewValidate(v) {
    const counts = validationCounts(v);
    let html = '<div class="page-head"><p class="kicker"><a href="#/ideas/' + esc(v.id) + '">' + esc(v.name) + "</a></p><h1>Validation checklists</h1>" +
      '<p class="lead">Use these lists to test the idea in the real world. Check off a step when you have actually done it. Write longer notes in the Notes section if you want a record.</p></div>' +
      ideaSubnav(v, "validate") +
      '<div class="grid grid-3">';
    Object.keys(D.VALIDATION).forEach((key) => {
      const pack = D.VALIDATION[key];
      const rec = (v.validation && v.validation[key]) || {};
      const c = counts[key];
      html += '<div class="card"><h2>' + esc(pack.name) + '</h2><p class="tiny">' + esc(pack.intro) + "</p>" +
        '<div class="tiny">' + c.done + " of " + c.total + " checked</div>" +
        '<div class="progress"><span style="width:' + Math.round((c.done / c.total) * 100) + '%"></span></div>' +
        pack.steps.map((s) => {
          const on = !!rec[s.id];
          return '<div class="check-item' + (on ? " done" : "") + '"><input type="checkbox" id="val-' + key + "-" + s.id + '"' + (on ? " checked" : "") +
            ' data-action="toggle-validation" data-id="' + esc(v.id) + '" data-pack="' + key + '" data-key="' + s.id + '">' +
            '<label for="val-' + key + "-" + s.id + '">' + esc(s.text) + "</label></div>";
        }).join("") + "</div>";
    });
    html += "</div>";
    return html;
  }

  function viewPath(v) {
    const path = pathState(v);
    let html = '<div class="page-head"><p class="kicker"><a href="#/ideas/' + esc(v.id) + '">' + esc(v.name) + "</a></p><h1>From idea to launch</h1>" +
      '<p class="lead">A step-by-step path you can use with any idea. The status updates from the work you actually record in this app.</p></div>' +
      ideaSubnav(v, "path") +
      '<div class="card"><div class="tiny">' + path.done + " of " + path.total + " steps complete</div>" +
      '<div class="progress" style="margin-bottom:18px"><span style="width:' + Math.round((path.done / path.total) * 100) + '%"></span></div>' +
      '<div class="path">';
    path.steps.forEach((s, i) => {
      const href = pathHref(v, s.go);
      html += '<div class="path-step ' + s.status + '"><div class="path-marker"><div class="path-dot">' + (s.status === "done" ? "✓" : (i + 1)) + '</div><div class="path-line"></div></div>' +
        '<div class="path-body"><h3>' + esc(s.name) + "</h3><p>" + esc(s.why) + "</p><p class=\"tiny\">" + esc(s.detail) + "</p>" +
        (href ? '<p><a class="btn" href="' + href + '">Work on this step</a></p>' : "") +
        (s.id === "legal" ? legalToggle(v) : "") +
        (s.id === "review" ? reviewBox(v) : "") +
        "</div></div>";
    });
    html += "</div></div>";
    return html;
  }

  function legalToggle(v) {
    return '<div class="check-item"><input type="checkbox" id="legalDone"' + (v.legalDone ? " checked" : "") +
      ' data-action="toggle-legal" data-id="' + esc(v.id) + '">' +
      '<label for="legalDone">I have handled the legal basics that apply to this idea. I understand this app is not legal advice.</label></div>';
  }

  function reviewBox(v) {
    const note = (v.review && v.review.note) || "";
    const at = v.review && v.review.at;
    return '<form data-action="save-review" data-id="' + esc(v.id) + '">' +
      (at ? '<p class="tiny">Last recorded: ' + esc(formatDay(at)) + "</p>" : "") +
      '<div class="field"><label><span>What did you decide?</span><textarea name="note" maxlength="2000" placeholder="Continue, change, or pause — and why.">' + esc(note) + "</textarea></label></div>" +
      '<button type="submit" class="btn primary">Save review for today</button></form>';
  }

  function pathHref(v, go) {
    if (go === "overview") return "#/ideas/" + encodeURIComponent(v.id) + "/edit";
    if (go === "score") return "#/ideas/" + encodeURIComponent(v.id) + "/score";
    if (go === "validate") return "#/ideas/" + encodeURIComponent(v.id) + "/validate";
    if (go === "plan") return "#/plan/" + encodeURIComponent(v.id);
    if (go === "playbooks") return "#/playbooks?venture=" + encodeURIComponent(v.id);
    if (go === "goals") return "#/goals?venture=" + encodeURIComponent(v.id);
    if (go === "numbers") return "#/numbers?venture=" + encodeURIComponent(v.id);
    return "";
  }

  function viewGoals() {
    const r = parseRoute();
    const filter = r.query.venture || "";
    let list = state.goals.slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    if (filter) list = list.filter((g) => g.ventureId === filter);

    let html = '<div class="page-head"><p class="kicker">Goals</p><h1>Goals and milestones</h1>' +
      '<p class="lead">Set clear goals for any idea or business, then check off milestones as you finish them.</p></div>' +
      '<div class="field"><label><span>Show goals for</span><select data-action="filter-goals">' +
      '<option value="__all__"' + (!filter ? " selected" : "") + ">All goals</option>" +
      ventureSelect(filter, { allowNone: false }) +
      "</select></label></div>";

    html += '<form class="card" data-action="add-goal" style="margin-bottom:16px">' +
      "<h2>Add a goal</h2>" +
      '<div class="field"><label><span>Goal</span><input name="title" required maxlength="200" placeholder="What do you want to accomplish?"></label></div>' +
      '<div class="field"><label><span>Why it matters</span><textarea name="why" maxlength="1000" placeholder="Optional"></textarea></label></div>' +
      '<div class="grid grid-2"><div class="field"><label><span>Target date</span><input name="deadline" type="date"></label></div>' +
      '<div class="field"><label><span>Tie it to</span><select name="ventureId">' + ventureSelect(filter || "", { emptyLabel: "Add an idea first to tie this goal" }) + "</select></label></div></div>" +
      '<button type="submit" class="btn primary">Add goal</button></form>';

    if (!list.length) {
      html += '<div class="empty"><h2>No goals in this list yet</h2><p>Add one above. If you expected to see a goal, check the filter.</p></div>';
    } else {
      html += '<div class="list">' + list.map(goalCard).join("") + "</div>";
    }
    return html;
  }

  function goalCard(g) {
    const v = getVenture(g.ventureId);
    const miles = g.milestones || [];
    const done = miles.filter((m) => m.done).length;
    const isDone = g.status === "done";
    return '<div class="card goal-card" id="goal-' + esc(g.id) + '">' +
      '<div class="spread"><span class="title' + (isDone ? " done-text" : "") + '">' + esc(g.title) + "</span>" +
      (isDone ? '<span class="badge ok">Done</span>' : (v ? kindBadge(v.kind) + ' <span class="tiny">' + esc(v.name) + "</span>" : '<span class="badge">Not tied</span>')) + "</div>" +
      (g.why ? "<p>" + esc(g.why) + "</p>" : "") +
      (g.deadline ? '<p class="tiny">Target: ' + esc(formatDay(g.deadline)) + "</p>" : "") +
      (miles.length ? '<div class="tiny">' + done + " of " + miles.length + " milestones</div>" : "") +
      miles.map((m) =>
        '<div class="milestone"><input type="checkbox" id="ms-' + esc(m.id) + '"' + (m.done ? " checked" : "") +
        ' data-action="toggle-milestone" data-goal="' + esc(g.id) + '" data-id="' + esc(m.id) + '">' +
        '<label for="ms-' + esc(m.id) + '" class="' + (m.done ? "done-text" : "") + '">' + esc(m.title) + "</label></div>"
      ).join("") +
      '<form class="row" data-action="add-milestone" data-id="' + esc(g.id) + '" style="margin-top:8px">' +
      '<input name="title" maxlength="200" required placeholder="Add a milestone" style="flex:1;min-width:140px">' +
      '<button type="submit" class="btn">Add</button></form>' +
      '<p class="row"><button type="button" class="btn" data-action="toggle-goal-done" data-id="' + esc(g.id) + '">' + (isDone ? "Mark as open" : "Mark goal done") + "</button>" +
      '<button type="button" class="btn danger" data-action="delete-goal" data-id="' + esc(g.id) + '">Delete</button></p></div>';
  }

  function viewPlan() {
    const r = parseRoute();
    const selected = r.parts[1] || r.query.venture || "";
    const plan = planFor(selected);
    const f = planFilled(plan);
    const v = getVenture(selected);
    let html = '<div class="page-head"><p class="kicker">Plan</p><h1>Business plan builder</h1>' +
      '<p class="lead">Write a plain-English plan for any idea or business. Official planning help is on the SBA site. This is not a legal or financial filing.</p></div>' +
      '<div class="field"><label><span>This plan is for</span><select data-action="pick-plan">' +
      ventureSelect(selected, { emptyLabel: "Add an idea first, or keep a general plan" }) +
      "</select></label></div>";
    if (!selected) html += '<p class="notice">This is a general plan, not tied to a specific idea. Choose an idea or business above to keep a separate plan for it.</p>';
    else if (v) html += '<p class="tiny">Tied to ' + esc(v.name) + '. <a href="#/ideas/' + esc(v.id) + '">Open it</a> · <a class="ext" href="https://www.sba.gov/counseling/plan-your-business/" target="_blank" rel="noopener">SBA: Plan your business</a></p>';

    html += '<p class="tiny">' + f.filled + " of " + f.total + " sections have writing" + (f.core ? ". The core sections are filled." : ". Core sections are vision, customers, the offer, and the next 90 days.") + "</p>";
    html += D.PLAN_SECTIONS.map((s) =>
      '<div class="card field"><label><span>' + esc(s.name) + "</span>" +
      '<p class="help">' + esc(s.hint) + "</p>" +
      '<textarea data-action="plan-section" data-plan="' + esc(plan.id) + '" data-key="' + s.id + '" maxlength="8000">' +
      esc(plan.sections[s.id] || "") + "</textarea></label></div>"
    ).join("");
    html += '<p class="tiny">Do not enter Social Security numbers, full EINs, bank or card numbers, or passwords.</p>';
    return html;
  }

  function habitApplies(h, iso) {
    const days = h.days;
    if (!days || days === "daily" || (Array.isArray(days) && days.length === 7)) return true;
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    const dow = dt.getUTCDay();
    return Array.isArray(days) && days.map(Number).includes(dow);
  }

  function isHabitDone(h, iso) {
    return flagOn((state.habitLogs || {})[h.id], iso);
  }

  function habitStreak(h) {
    let n = 0;
    const cursor = new Date();
    for (let i = 0; i < 400; i++) {
      const iso = new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit"
      }).format(cursor);
      if (!habitApplies(h, iso)) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      if (isHabitDone(h, iso)) {
        n += 1;
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      if (iso === todayISO() && n === 0) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      break;
    }
    return n;
  }

  function habitRow(h, iso) {
    const on = isHabitDone(h, iso);
    const streak = habitStreak(h);
    const v = getVenture(h.ventureId);
    return '<div class="habit-row"><input type="checkbox" id="hb-' + esc(h.id) + '"' + (on ? " checked" : "") +
      ' data-action="toggle-habit" data-id="' + esc(h.id) + '" data-day="' + iso + '">' +
      '<label for="hb-' + esc(h.id) + '">' + esc(h.title) + (v ? ' <span class="tiny">· ' + esc(v.name) + "</span>" : "") + "</label>" +
      (streak ? '<span class="streak">' + streak + " day streak</span>" : "") + "</div>";
  }

  function dowChecks() {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return names.map((n, i) => '<label style="margin-right:10px"><input type="checkbox" name="dow" value="' + i + '"> ' + n + "</label>").join("");
  }

  function habitDaysLabel(h) {
    if (!h.days || h.days === "daily") return "Every day";
    if (Array.isArray(h.days) && h.days.length === 5 && [1, 2, 3, 4, 5].every((d) => h.days.map(Number).includes(d))) return "Weekdays";
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return (h.days || []).map((d) => names[Number(d)]).join(", ");
  }

  function viewHabits() {
    const today = todayISO();
    const list = state.habits;
    let html = '<div class="page-head"><p class="kicker">Habits</p><h1>Daily success routine</h1>' +
      '<p class="lead">Build a routine you can keep. Check off today\'s habits. Your streak counts days in a row that you completed a habit, in Central Time.</p>' +
      '<p class="tiny">Today is ' + esc(formatLongDate()) + ".</p></div>";

    html += '<form class="card" data-action="add-habit"><h2>Add a habit</h2>' +
      '<div class="field"><label><span>Habit</span><input name="title" required maxlength="160" placeholder="For example, review the numbers"></label></div>' +
      '<div class="field"><span class="label">Which days</span>' +
      '<label><input type="radio" name="when" value="daily" checked> Every day</label> ' +
      '<label><input type="radio" name="when" value="weekdays"> Weekdays</label> ' +
      '<label><input type="radio" name="when" value="custom"> Custom</label></div>' +
      '<div class="field" id="customDays" hidden><span class="label">Custom days</span>' +
      dowChecks() + "</div>" +
      '<div class="field"><label><span>Tie it to (optional)</span><select name="ventureId">' + ventureSelect("") + "</select></label></div>" +
      '<button type="submit" class="btn primary">Add habit</button>';
    if (D.HABIT_SUGGESTIONS.length) {
      html += '<p class="tiny" style="margin-top:12px">Optional suggestions — nothing is added until you tap one:</p><p class="row">' +
        D.HABIT_SUGGESTIONS.map((s) => '<button type="button" class="btn" data-action="suggest-habit" data-title="' + esc(s) + '">' + esc(s) + "</button>").join("") +
        "</p>";
    }
    html += "</form>";

    const todayList = list.filter((h) => habitApplies(h, today));
    html += '<div class="card" style="margin-top:16px"><h2>Today</h2>';
    if (!todayList.length) html += '<p class="muted">No habits set for today yet.</p>';
    else html += todayList.map((h) => habitRow(h, today)).join("");
    html += "</div>";

    if (list.length) {
      html += '<div class="card" style="margin-top:16px"><h2>All habits</h2>' +
        list.map((h) =>
          '<div class="spread" style="padding:8px 0;border-bottom:1px solid var(--line)"><div>' + esc(h.title) +
          '<div class="tiny">' + habitDaysLabel(h) + (habitStreak(h) ? " · " + habitStreak(h) + " day streak" : "") + "</div></div>" +
          '<button type="button" class="btn danger" data-action="delete-habit" data-id="' + esc(h.id) + '">Delete</button></div>'
        ).join("") + "</div>";
    }
    return html;
  }

  function formatValue(unit, value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    if (unit === "usd") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
    if (unit === "percent") return n + "%";
    return new Intl.NumberFormat("en-US").format(n);
  }

  function kpiCard(k) {
    const v = getVenture(k.ventureId);
    const entries = (k.entries || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const last = entries[entries.length - 1];
    return '<a class="card kpi-card accent" href="#/numbers/' + esc(k.id) + '"><div class="spread"><span class="title">' + esc(k.name) + "</span>" +
      (v ? '<span class="tiny">' + esc(v.name) + "</span>" : "") + "</div>" +
      (last ? "<p>Latest (" + esc(formatDay(last.date)) + "): <strong>" + esc(formatValue(k.unit, last.value)) + "</strong></p>" : '<p class="muted">No figures entered yet.</p>') +
      "</a>";
  }

  function lineChart(entries, unit) {
    if (!entries.length) return '<p class="muted">No figures entered yet. The chart will appear after you add a number.</p>';
    const width = 640, height = 240;
    const vals = entries.map((e) => Number(e.value)).filter(Number.isFinite);
    if (!vals.length) return '<p class="muted">No valid figures to chart yet.</p>';
    let min = Math.min.apply(null, vals);
    let max = Math.max.apply(null, vals);
    if (min === max) { min = min - 1; max = max + 1; }
    const pad = (max - min) * 0.1;
    const lo = min - pad;
    const hi = max + pad;
    const span = hi - lo || 1;
    const l = 54, r = 16, t = 16, b = 40;
    const iw = width - l - r, ih = height - t - b;
    const pts = entries.map((e, i) => {
      const x = l + (entries.length === 1 ? iw / 2 : (i / (entries.length - 1)) * iw);
      const y = t + ih - ((Number(e.value) - lo) / span) * ih;
      return { x: x, y: y, e: e };
    });
    const dpath = pts.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
    const area = dpath + " L" + pts[pts.length - 1].x.toFixed(1) + "," + (t + ih) + " L" + pts[0].x.toFixed(1) + "," + (t + ih) + " Z";
    const grid = [0, 0.5, 1].map((tfrac) => {
      const y = t + ih - tfrac * ih;
      const val = lo + tfrac * span;
      return '<line x1="' + l + '" y1="' + y + '" x2="' + (l + iw) + '" y2="' + y + '" stroke="var(--line)" /><text x="' + (l - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10" fill="currentColor">' + esc(formatValue(unit, Math.round(val * 100) / 100)) + "</text>";
    }).join("");
    const xlabels = pts.map((p, i) => {
      if (pts.length > 8 && i !== 0 && i !== pts.length - 1 && i % Math.ceil(pts.length / 6) !== 0) return "";
      return '<text x="' + p.x + '" y="' + (height - 12) + '" text-anchor="middle" font-size="10" fill="currentColor">' + esc(formatDay(p.e.date)) + "</text>";
    }).join("");
    const dots = pts.map((p) => '<circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="var(--gold)" stroke="var(--navy)" stroke-width="1.5"><title>' + esc(formatDay(p.e.date) + ": " + formatValue(unit, p.e.value)) + "</title></circle>").join("");
    return '<div class="chart-wrap"><svg viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="Chart of entered figures">' +
      grid + '<path d="' + area + '" fill="var(--gold)" opacity="0.15"/>' +
      '<path d="' + dpath + '" fill="none" stroke="var(--gold)" stroke-width="2.5"/>' +
      dots + xlabels + "</svg></div>";
  }

  function viewNumbers() {
    const r = parseRoute();
    const filter = r.query.venture || "";
    const kpiId = r.parts[1];
    if (kpiId) {
      const k = state.kpis.find((x) => x.id === kpiId);
      if (!k) return notFound("That tracker was not found.");
      return viewKpi(k);
    }
    let list = state.kpis.slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    if (filter) list = list.filter((k) => k.ventureId === filter);

    let html = '<div class="page-head"><p class="kicker">Numbers</p><h1>KPI and revenue tracker</h1>' +
      '<p class="lead">Track figures you type in yourself, such as sales, deliveries, or costs. This app does not connect to a bank, a payment company, or a trading platform. There are no sample numbers here.</p></div>' +
      '<div class="field"><label><span>Show trackers for</span><select data-action="filter-kpis">' +
      '<option value=""' + (!filter ? " selected" : "") + ">All trackers</option>" +
      ventureSelect(filter, { allowNone: false }) +
      "</select></label></div>";

    html += '<form class="card" data-action="add-kpi"><h2>Add a tracker</h2>' +
      '<div class="field"><label><span>Name</span><input name="name" required maxlength="120" placeholder="For example, weekly sales"></label></div>' +
      '<div class="grid grid-2"><div class="field"><label><span>Unit</span><select name="unit">' +
      '<option value="usd">US dollars</option><option value="number">Number</option><option value="percent">Percent</option><option value="count">Count</option>' +
      "</select></label></div>" +
      '<div class="field"><label><span>Tie it to</span><select name="ventureId">' + ventureSelect(filter) + "</select></label></div></div>" +
      '<p class="help">Use a name you understand, such as sales you received this week. Do not enter account numbers.</p>' +
      '<button type="submit" class="btn primary">Add tracker</button></form>';

    if (!list.length) html += '<div class="empty" style="margin-top:16px"><h2>No trackers yet</h2><p>Add one above, then enter figures as you have them. Charts stay empty until you enter a number.</p></div>';
    else html += '<div class="list" style="margin-top:16px">' + list.map(kpiCard).join("") + "</div>";
    return html;
  }

  function viewKpi(k) {
    const entries = (k.entries || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const v = getVenture(k.ventureId);
    let html = '<div class="page-head"><p class="kicker"><a href="#/numbers">Numbers</a></p><h1>' + esc(k.name) + "</h1>" +
      (v ? '<p class="tiny">Tied to <a href="#/ideas/' + esc(v.id) + '">' + esc(v.name) + "</a></p>" : '<p class="tiny">Not tied to a specific idea.</p>') +
      "</div>";
    html += '<div class="card">' + lineChart(entries, k.unit) + "</div>";
    html += '<form class="card" style="margin-top:16px" data-action="add-entry" data-id="' + esc(k.id) + '"><h2>Add a figure</h2>' +
      '<div class="grid grid-2"><div class="field"><label><span>Date</span><input name="date" type="date" required value="' + todayISO() + '"></label></div>' +
      '<div class="field"><label><span>Value</span><input name="value" type="number" step="any" required placeholder="Enter a number you actually have"></label></div></div>' +
      '<div class="field"><label><span>Note (optional)</span><input name="note" type="text" maxlength="200"></label></div>' +
      '<button type="submit" class="btn primary">Save figure</button></form>';
    if (entries.length) {
      html += '<div class="card" style="margin-top:16px"><h2>History</h2><table class="data"><thead><tr><th>Date</th><th>Value</th><th>Note</th><th></th></tr></thead><tbody>' +
        entries.slice().reverse().map((e) =>
          "<tr><td>" + esc(formatDay(e.date)) + "</td><td>" + esc(formatValue(k.unit, e.value)) + "</td><td>" + esc(e.note || "") + "</td>" +
          '<td><button type="button" class="btn danger" data-action="delete-entry" data-kpi="' + esc(k.id) + '" data-id="' + esc(e.id) + '">Delete</button></td></tr>'
        ).join("") + "</tbody></table></div>";
    }
    html += '<p style="margin-top:16px"><button type="button" class="btn danger" data-action="delete-kpi" data-id="' + esc(k.id) + '">Delete this tracker</button></p>';
    return html;
  }

  function viewPlaybooks() {
    const r = parseRoute();
    const ventureId = r.query.venture || state.filters.playbook || "";
    if (r.parts[1]) {
      const book = D.PLAYBOOKS.find((p) => p.id === r.parts[1]);
      if (!book) return notFound("That playbook was not found.");
      return viewPlaybook(book, r.query.venture || ventureId);
    }
    let html = '<div class="page-head"><p class="kicker">Playbooks</p><h1>Checklists and official steps</h1>' +
      '<p class="lead">Use these checklists with any idea or business. Links go only to official government sites. This is not legal, tax, or financial advice. Fees and rules can change, so always read the official page.</p></div>' +
      '<div class="field"><label><span>Attach checks to</span><select data-action="filter-playbooks">' +
      ventureSelect(ventureId) + "</select></label></div>" +
      '<div class="grid grid-2">';
    D.PLAYBOOKS.forEach((p) => {
      const rec = progressFor(p.id, ventureId);
      const done = p.steps.filter((s) => flagOn(rec, s.id)).length;
      html += '<a class="card play-card accent" href="#/playbooks/' + p.id + (ventureId ? ("?venture=" + encodeURIComponent(ventureId)) : "") + '">' +
        '<p class="kicker">' + esc(p.category) + '</p><div class="title">' + esc(p.name) + "</div>" +
        '<p class="tiny">' + esc(p.summary) + "</p>" +
        '<div class="tiny">' + done + " of " + p.steps.length + " checked</div>" +
        '<div class="progress"><span style="width:' + Math.round((done / p.steps.length) * 100) + '%"></span></div></a>';
    });
    html += "</div>";
    return html;
  }

  function viewPlaybook(book, ventureId) {
    const rec = progressFor(book.id, ventureId);
    const done = book.steps.filter((s) => flagOn(rec, s.id)).length;
    const v = getVenture(ventureId);
    let html = '<div class="page-head"><p class="kicker"><a href="#/playbooks' + (ventureId ? ("?venture=" + encodeURIComponent(ventureId)) : "") + '">Playbooks</a> · ' + esc(book.category) + "</p><h1>" + esc(book.name) + "</h1>" +
      '<p class="lead">' + esc(book.summary) + "</p></div>" +
      '<div class="field"><label><span>Attach checks to</span><select data-action="attach-playbook" data-book="' + book.id + '">' +
      ventureSelect(ventureId) + "</select></label></div>" +
      (v ? '<p class="tiny">Progress is saved for ' + esc(v.name) + ".</p>" : '<p class="tiny">Progress is saved as general, not tied to a specific idea.</p>') +
      '<div class="notice warning">' + esc(book.advice) + "</div>" +
      '<div class="card"><div class="tiny">' + done + " of " + book.steps.length + " checked</div>" +
      '<div class="progress"><span style="width:' + Math.round((done / book.steps.length) * 100) + '%"></span></div>' +
      book.steps.map((s) => {
        const on = flagOn(rec, s.id);
        return '<div class="check-item' + (on ? " done" : "") + '"><input type="checkbox" id="pb-' + book.id + "-" + s.id + '"' + (on ? " checked" : "") +
          ' data-action="toggle-step" data-book="' + book.id + '" data-key="' + s.id + '" data-venture="' + esc(ventureId || "") + '">' +
          "<div><label for=\"pb-" + book.id + "-" + s.id + '">' + esc(s.text) + "</label>" +
          (s.href ? '<div><a class="ext" href="' + esc(s.href) + '" target="_blank" rel="noopener">' + esc(s.label || "Official page") + "</a></div>" : "") +
          "</div></div>";
      }).join("") + "</div>";
    return html;
  }

  function viewLibrary() {
    let html = '<div class="page-head"><p class="kicker">Library</p><h1>Official resources</h1>' +
      '<p class="lead">These links go to official government sites. They were checked when this app was built. This app is not affiliated with those agencies, and the pages can change.</p></div>';
    D.LIBRARY.forEach((cat) => {
      html += '<div class="card lib-card" style="margin-bottom:16px"><h2>' + esc(cat.category) + "</h2>";
      cat.items.forEach((it) => {
        html += '<a class="lib-item ext" href="' + esc(it.href) + '" target="_blank" rel="noopener"><div class="name">' + esc(it.name) + "</div>" +
          '<div class="tiny">' + esc(it.note) + "</div></a>";
      });
      html += "</div>";
    });
    return html;
  }

  function viewNotes() {
    const r = parseRoute();
    const filter = r.query.venture || "";
    let list = state.notes.slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    if (filter) list = list.filter((n) => n.ventureId === filter);
    let html = '<div class="page-head"><p class="kicker">Notes</p><h1>Notes</h1>' +
      '<p class="lead">Jot down interviews, decisions, or questions. Notes stay on this device.</p>' +
      '<p class="notice warning">Do not enter Social Security numbers, full Employer Identification Numbers, bank or card numbers, passwords, or other sensitive personal data.</p></div>' +
      '<div class="field"><label><span>Show notes for</span><select data-action="filter-notes">' +
      '<option value=""' + (!filter ? " selected" : "") + ">All notes</option>" + ventureSelect(filter, { allowNone: false }) +
      "</select></label></div>" +
      '<form class="card" data-action="add-note"><h2>New note</h2>' +
      '<div class="field"><label><span>Title</span><input name="title" required maxlength="160"></label></div>' +
      '<div class="field"><label><span>Tie it to</span><select name="ventureId">' + ventureSelect(filter) + "</select></label></div>" +
      '<div class="field"><label><span>Note</span><textarea name="body" required maxlength="8000"></textarea></label></div>' +
      '<button type="submit" class="btn primary">Save note</button></form>';
    if (!list.length) html += '<div class="empty" style="margin-top:16px"><p>No notes in this list yet.</p></div>';
    else {
      html += '<div class="list" style="margin-top:16px">';
      list.forEach((n) => {
        const v = getVenture(n.ventureId);
        html += '<div class="card note-card"><div class="spread"><span class="title">' + esc(n.title) + "</span>" +
          '<span class="tiny">' + esc(formatDay((n.updatedAt || "").slice(0, 10))) + (v ? " · " + esc(v.name) : "") + "</span></div>" +
          "<p>" + esc(n.body).replace(/\n/g, "<br>") + "</p>" +
          '<button type="button" class="btn danger" data-action="delete-note" data-id="' + esc(n.id) + '">Delete</button></div>';
      });
      html += "</div>";
    }
    return html;
  }

  const VN_DRAFT_KEY = "bizhq-video-note-draft";
  const VN_SUMMARY_MAX = 20000;
  const VN_USE_MAX = 8000;
  const VN_STEP_MAX = 500;

  const VN_FILE_MAX = 20 * 1024 * 1024;
  const vnLibPromises = {};

  function vendorSrc(file) {
    try {
      const s = document.querySelector('script[src*="app.js"]');
      if (s && s.src) return new URL("vendor/" + file, s.src).href;
    } catch (e) {}
    return "vendor/" + file;
  }

  function loadVendorScript(file) {
    if (!vnLibPromises[file]) {
      vnLibPromises[file] = new Promise(function (resolve, reject) {
        if (document.querySelector('script[data-vendor="' + file + '"]')) {
          resolve();
          return;
        }
        const s = document.createElement("script");
        s.src = vendorSrc(file);
        s.async = true;
        s.dataset.vendor = file;
        s.onload = function () { resolve(); };
        s.onerror = function () {
          delete vnLibPromises[file];
          reject(new Error("load"));
        };
        document.head.appendChild(s);
      });
    }
    return vnLibPromises[file];
  }

  function fileExt(name) {
    const m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : "";
  }

  function sniffFileKind(file, buf) {
    const ext = fileExt(file.name);
    const u8 = new Uint8Array(buf.slice(0, 8));
    const head = String.fromCharCode.apply(null, Array.from(u8));
    const isPdf = head.indexOf("%PDF") === 0;
    const isZip = u8[0] === 0x50 && u8[1] === 0x4B;
    const isOle = u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0;
    const mime = String(file.type || "").toLowerCase();

    if (ext === "pdf" || isPdf) return "pdf";
    if (ext === "csv" || mime.indexOf("csv") !== -1) return "sheet";
    if (ext === "xlsx" || ext === "xls") return "sheet";
    if (ext === "docx") return "docx";
    if (ext === "doc") return isZip ? "docx" : "old-doc";
    if (isPdf) return "pdf";
    if (isZip) {
      const zip = zipPeekKind(buf);
      if (zip) return zip;
      if (mime.indexOf("word") !== -1) return "docx";
      if (mime.indexOf("sheet") !== -1 || mime.indexOf("excel") !== -1) return "sheet";
    }
    if (isOle) return ext === "xls" || mime.indexOf("excel") !== -1 ? "sheet" : "old-doc";
    return "unknown";
  }

  function zipPeekKind(buf) {
    try {
      const s = new TextDecoder("latin1").decode(new Uint8Array(buf));
      if (s.indexOf("word/document.xml") !== -1) return "docx";
      if (s.indexOf("xl/workbook") !== -1 || s.indexOf("xl/worksheets") !== -1) return "sheet";
    } catch (e) {}
    return "";
  }

  function pdfItemsToText(content) {
    const items = content.items || [];
    const lines = [];
    let line = "";
    let lastY = null;
    items.forEach(function (it) {
      const str = it.str || "";
      const y = it.transform ? it.transform[5] : 0;
      if (it.hasEOL) {
        line += str;
        if (line.trim()) lines.push(line.trim());
        line = "";
        lastY = null;
        return;
      }
      if (lastY != null && Math.abs(y - lastY) > 4) {
        if (line.trim()) lines.push(line.trim());
        line = str;
      } else {
        if (line && !/\s$/.test(line) && str && !/^\s/.test(str)) line += " ";
        line += str;
      }
      lastY = y;
    });
    if (line.trim()) lines.push(line.trim());
    return lines.join("\n");
  }

  async function extractPdfText(buf) {
    await loadVendorScript("pdf.min.js");
    const lib = window.pdfjsLib;
    if (!lib) throw new Error("pdfjs");
    lib.GlobalWorkerOptions.workerSrc = vendorSrc("pdf.worker.min.js");
    const data = new Uint8Array(buf.slice(0));
    let doc;
    try {
      doc = await lib.getDocument({ data: data }).promise;
    } catch (e) {
      doc = await lib.getDocument({ data: new Uint8Array(buf.slice(0)), disableWorker: true }).promise;
    }
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = pdfItemsToText(content);
      if (text) pages.push(text);
    }
    return pages.join("\n\n");
  }

  async function extractDocxText(buf) {
    await loadVendorScript("mammoth.browser.min.js");
    if (!window.mammoth) throw new Error("mammoth");
    const result = await window.mammoth.extractRawText({ arrayBuffer: buf });
    return String(result && result.value ? result.value : "").replace(/\r\n/g, "\n").trim();
  }

  async function extractWorkbook(buf, file) {
    await loadVendorScript("xlsx.full.min.js");
    if (!window.XLSX) throw new Error("xlsx");
    const ext = fileExt(file.name);
    let wb;
    if (ext === "csv" || (file.type || "").toLowerCase().indexOf("csv") !== -1) {
      let text = "";
      try { text = new TextDecoder("utf-8").decode(buf); } catch (e) { text = ""; }
      wb = window.XLSX.read(text || buf, { type: text ? "string" : "array", raw: false });
    } else {
      wb = window.XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true, raw: false });
    }
    const sheets = {};
    (wb.SheetNames || []).forEach(function (name) {
      sheets[name] = sheetToText(wb.Sheets[name]);
    });
    return { names: wb.SheetNames || [], sheets: sheets };
  }

  function sheetToText(ws) {
    if (!ws) return "";
    const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "", blankrows: false });
    return rows.map(function (row) {
      return (row || []).map(function (c) {
        return String(c == null ? "" : c).trim();
      }).filter(Boolean).join(" — ");
    }).filter(Boolean).join("\n");
  }

  function importBoxHtml() {
    return '<div class="card accent vn-import" id="vnImportBox">' +
      "<h2>Import from file</h2>" +
      "<p class=\"help\">Choose a PDF, Word (.docx), Excel, or CSV file. The text is read on this device and is not uploaded anywhere.</p>" +
      '<p class="row"><button type="button" class="btn" data-action="vn-import-file">Import from file</button></p>' +
      '<input id="vnFileInput" type="file" accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" hidden>' +
      '<div class="vn-drop hide-sm" id="vnDrop" tabindex="0">Drop a PDF, Word, or Excel file here</div>' +
      '<div id="vnImportPreview" class="vn-preview"' + (vnImportState ? "" : " hidden") + "></div></div>";
  }

  function paintVnImportPreview() {
    const box = document.getElementById("vnImportPreview");
    if (!box) return;
    const st = vnImportState;
    if (!st) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    const chars = formatViews((st.text || "").length);
    let html = "<h3>Import preview</h3>" +
      '<p class="tiny">Source file: ' + esc(st.fileName) + (st.kindLabel ? " · " + esc(st.kindLabel) : "") +
      " · " + chars + " character" + ((st.text || "").length === 1 ? "" : "s") + "</p>";
    if (st.sheetNames && st.sheetNames.length) {
      html += '<div class="field"><label><span>Sheet</span><select data-action="vn-import-sheet">';
      st.sheetNames.forEach(function (name) {
        html += '<option value="' + esc(name) + '"' + (name === st.sheetName ? " selected" : "") + ">" + esc(name) + "</option>";
      });
      html += "</select></label></div>";
    }
    if (st.warning) html += '<p class="notice warning">' + esc(st.warning) + "</p>";
    if (st.text) {
      const shown = st.text.length > 4000 ? st.text.slice(0, 4000) + "\n\n[Preview trimmed. The full text will be added to the note, up to the field limit.]" : st.text;
      html += '<pre class="vn-preview-text">' + esc(shown) + "</pre>";
      html += '<fieldset class="vn-dest"><legend>Add this text to</legend>' +
        '<label><input type="radio" name="vnImportDest" value="summary" checked> Video summary</label>' +
        "<label><input type=\"radio\" name=\"vnImportDest\" value=\"use\"> How I’ll use this in my business</label>" +
        '<label><input type="radio" name="vnImportDest" value="steps"> How to do it steps (split into a checklist)</label>' +
        "</fieldset>" +
        "<fieldset class=\"vn-dest\"><legend>If that part already has text</legend>" +
        '<label><input type="radio" name="vnImportMode" value="append" checked> Add below what’s there</label>' +
        '<label><input type="radio" name="vnImportMode" value="replace"> Replace what’s there</label>' +
        "</fieldset>" +
        '<p class="row"><button type="button" class="btn primary" data-action="vn-import-apply">Add to the note</button>' +
        '<button type="button" class="btn" data-action="vn-import-clear">Clear preview</button></p>';
    } else {
      html += '<p class="row"><button type="button" class="btn" data-action="vn-import-clear">Clear preview</button></p>';
    }
    box.innerHTML = html;
  }

  function setImportStatus(msg) {
    const box = document.getElementById("vnImportPreview");
    if (!box) return;
    box.hidden = false;
    box.innerHTML = '<p class="help">' + esc(msg) + "</p>";
  }

  async function importNoteFile(file) {
    if (!file) return;
    if (file.size > VN_FILE_MAX) {
      vnImportState = {
        fileName: file.name,
        text: "",
        warning: "This file is larger than 20 MB, which is too large to read in the browser. Try a smaller file, or copy the text and paste it instead."
      };
      paintVnImportPreview();
      return;
    }
    setImportStatus("Reading “" + file.name + "” on this device…");
    try {
      const buf = await file.arrayBuffer();
      const kind = sniffFileKind(file, buf);
      if (kind === "old-doc") {
        vnImportState = {
          fileName: file.name,
          kindLabel: "Word (.doc)",
          text: "",
          warning: "This looks like an older Word .doc file. This app can read .docx files. In Word, use File → Save As and choose Word Document (.docx), then import that file."
        };
        paintVnImportPreview();
        return;
      }
      if (kind === "unknown") {
        vnImportState = {
          fileName: file.name,
          text: "",
          warning: "This file type is not supported. You can import a PDF, a Word .docx file, or an Excel or CSV file. Older Word .doc files need to be saved as .docx first."
        };
        paintVnImportPreview();
        return;
      }
      if (kind === "pdf") {
        const text = await extractPdfText(buf);
        const empty = !String(text || "").trim();
        vnImportState = {
          fileName: file.name,
          kindLabel: "PDF",
          text: String(text || "").trim(),
          warning: empty ? "This PDF does not contain selectable text. It may be a scanned or image-only file. Try a PDF that has text, or type or paste the notes yourself." : ""
        };
        paintVnImportPreview();
        return;
      }
      if (kind === "docx") {
        const text = await extractDocxText(buf);
        const empty = !String(text || "").trim();
        vnImportState = {
          fileName: file.name,
          kindLabel: "Word",
          text: String(text || "").trim(),
          warning: empty ? "No text could be read from this Word file. If it is mostly images, type or paste the notes yourself." : ""
        };
        paintVnImportPreview();
        return;
      }
      if (kind === "sheet") {
        const wb = await extractWorkbook(buf, file);
        const names = wb.names.length ? wb.names : Object.keys(wb.sheets);
        const first = names[0] || "";
        vnImportState = {
          fileName: file.name,
          kindLabel: fileExt(file.name) === "csv" ? "CSV" : "Excel",
          sheetNames: names,
          sheetName: first,
          sheets: wb.sheets,
          text: (wb.sheets[first] || "").trim(),
          warning: !(wb.sheets[first] || "").trim() ? "That sheet does not have any text in it. Try another sheet, if there is one." : ""
        };
        paintVnImportPreview();
        return;
      }
    } catch (err) {
      vnImportState = {
        fileName: file.name,
        text: "",
        warning: "Could not read this file on this device. If you are offline, open the app once while online so the file readers can be stored, then try again. You can also copy the text and paste it."
      };
      paintVnImportPreview();
    }
  }

  function changeImportSheet(name) {
    if (!vnImportState || !vnImportState.sheets) return;
    vnImportState.sheetName = name;
    vnImportState.text = String(vnImportState.sheets[name] || "").trim();
    vnImportState.warning = vnImportState.text ? "" : "That sheet does not have any text in it. Try another sheet, if there is one.";
    paintVnImportPreview();
  }

  function applyVnImport() {
    const st = vnImportState;
    if (!st || !String(st.text || "").trim()) {
      toast("There is no text to add.");
      return;
    }
    const form = vnFormEl();
    if (!form) {
      toast("Open a new or existing video note to add this text.");
      return;
    }
    const destEl = document.querySelector('input[name="vnImportDest"]:checked');
    const modeEl = document.querySelector('input[name="vnImportMode"]:checked');
    const dest = destEl ? destEl.value : "summary";
    const replace = modeEl && modeEl.value === "replace";
    const text = st.text;

    if (form.sourceFile) {
      form.sourceFile.value = String(st.fileName || "").slice(0, 200);
      const wrap = document.getElementById("vnSourceField");
      if (wrap) wrap.hidden = false;
    }
    if (form.title && !String(form.title.value || "").trim() && st.fileName) {
      form.title.value = String(st.fileName).replace(/\.[^.]+$/, "").slice(0, 200);
    }

    if (dest === "steps") {
      const parts = splitSteps(text).map(function (t) { return t.slice(0, VN_STEP_MAX); }).filter(Boolean);
      if (!parts.length) {
        toast("No steps could be made from that text.");
        return;
      }
      const next = parts.map(function (t) { return { id: uid(), text: t, done: false }; });
      vnFormSteps = replace ? next : copySteps(vnFormSteps).concat(next);
      vnEditingStep = "";
      persistVnDraftFromForm();
      refreshHowtoBlock();
      toast("Added " + parts.length + " step" + (parts.length === 1 ? "" : "s") + " from the file.");
      return;
    }

    const field = dest === "use" ? form.useInBusiness : form.summary;
    const max = dest === "use" ? VN_USE_MAX : VN_SUMMARY_MAX;
    const countId = dest === "use" ? "vnUseCount" : "vnSummaryCount";
    const current = replace ? "" : String(field.value || "").replace(/\s*$/, "");
    let next = current ? current + "\n\n" + text : text;
    let trimmed = false;
    if (next.length > max) {
      next = next.slice(0, max);
      trimmed = true;
    }
    field.value = next;
    updateCharCount(field, countId, max);
    persistVnDraftFromForm();
    toast(trimmed
      ? "Added the text, shortened to the field limit."
      : (dest === "use" ? "Added the text to “How I’ll use this.”" : "Added the text to the summary."));
  }

  function clearVnImport() {
    vnImportState = null;
    paintVnImportPreview();
    const input = document.getElementById("vnFileInput");
    if (input) input.value = "";
  }

  function bindVnImportUi() {
    const box = document.getElementById("vnImportBox");
    if (!box) return;
    const over = function (e) {
      e.preventDefault();
      e.stopPropagation();
      box.classList.add("dragover");
    };
    const out = function (e) {
      e.preventDefault();
      e.stopPropagation();
      box.classList.remove("dragover");
    };
    box.addEventListener("dragenter", over);
    box.addEventListener("dragover", over);
    box.addEventListener("dragleave", out);
    box.addEventListener("drop", function (e) {
      out(e);
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files[0]) importNoteFile(files[0]);
    });
    if (vnImportState) paintVnImportPreview();
  }

  function getVideoNote(id) {
    return (state.videoNotes || []).find((n) => n.id === id) || null;
  }

  function copySteps(steps) {
    return (steps || []).map((s) => ({
      id: s.id || uid(),
      text: String(s.text || "").trim(),
      done: !!s.done
    })).filter((s) => s.text);
  }

  function parseYouTubeId(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    let u;
    try { u = new URL(raw); } catch (e) { return ""; }
    const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "").toLowerCase();
    let id = "";
    if (host === "youtu.be") {
      id = (u.pathname.split("/").filter(Boolean)[0] || "").split("&")[0];
    } else if (host === "youtube.com" || host === "youtube-nocookie.com" || host.endsWith(".youtube.com")) {
      if (u.searchParams.get("v")) id = u.searchParams.get("v");
      else {
        const parts = u.pathname.split("/").filter(Boolean);
        if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" || parts[0] === "v") {
          id = parts[1] || "";
        }
      }
    }
    id = String(id || "").trim();
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
  }

  function youtubeWatchUrl(id) {
    return "https://www.youtube.com/watch?v=" + id;
  }

  function youtubePreviewHtml(url, title) {
    const id = parseYouTubeId(url);
    const typed = String(url || "").trim();
    if (!typed) return '<div class="yt-preview" id="ytPreview" hidden></div>';
    if (!id) {
      return '<div class="yt-preview" id="ytPreview"><p class="help">That does not look like a YouTube link. You can still save the note, or paste a youtube.com or youtu.be link.</p></div>';
    }
    const href = youtubeWatchUrl(id);
    const label = title ? title : "Open this video on YouTube";
    return '<div class="yt-preview" id="ytPreview">' +
      '<a class="yt-card" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' +
      '<img class="yt-thumb" src="https://i.ytimg.com/vi/' + esc(id) + '/hqdefault.jpg" width="240" height="135" alt="Thumbnail for this YouTube video">' +
      "<span>" + esc(label) + "</span></a></div>";
  }

  function splitSteps(text) {
    const raw = String(text || "").replace(/\r\n/g, "\n").trim();
    if (!raw) return [];
    const mark = "(?:(?:step\\s*(?:#|no\\.?|number)?\\s*)?\\d+\\s*(?:[.)\\]:]\\s*|\\s*[-\\u2013]\\s+))";
    const lineStart = new RegExp("^\\s*" + mark, "i");
    const lines = raw.split("\n");
    const numberedLines = lines.filter((l) => lineStart.test(l)).length;
    const markCount = (raw.match(new RegExp(mark, "gi")) || []).length;
    if (numberedLines >= 2 || markCount >= 2 || (markCount === 1 && numberedLines === 1)) {
      let parts = raw.split(new RegExp(mark, "gi")).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
      if (!lineStart.test(raw) && parts.length >= 3) parts = parts.slice(1);
      if (parts.length) return parts;
    }
    if ((raw.match(/(?:^|\n)\s*[-*•]\s+/g) || []).length >= 2 || /^\s*[-*•]\s+/.test(raw)) {
      const parts = raw.split(/(?:^|\n)\s*[-*•]\s+/).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
      if (parts.length) return parts;
    }
    return raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  }

  function howtoProgress(steps) {
    const list = steps || [];
    const total = list.length;
    const done = list.filter((s) => s.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { done, total, pct };
  }

  function parseTags(s) {
    const seen = {};
    const out = [];
    String(s || "").split(/[,;]/).forEach((t) => {
      const tag = t.trim().slice(0, 40);
      if (!tag) return;
      const key = tag.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push(tag);
    });
    return out.slice(0, 20);
  }

  function allVideoTags() {
    const map = {};
    (state.videoNotes || []).forEach((n) => {
      (n.tags || []).forEach((t) => { map[t.toLowerCase()] = t; });
    });
    return Object.keys(map).sort().map((k) => map[k]);
  }

  function formatWhen(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", timeZone: TZ, timeZoneName: "short"
    }).format(d);
  }

  function loadVnDraft() {
    try {
      const raw = localStorage.getItem(VN_DRAFT_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return d && typeof d === "object" ? d : null;
    } catch (e) {
      return null;
    }
  }

  function saveVnDraft(data) {
    try {
      const rec = Object.assign({}, data, { savedAt: nowISO() });
      localStorage.setItem(VN_DRAFT_KEY, JSON.stringify(rec));
    } catch (e) {}
  }

  function clearVnDraft() {
    try { localStorage.removeItem(VN_DRAFT_KEY); } catch (e) {}
  }

  function vnFormEl() {
    return document.querySelector('form[data-action="save-video-note"]');
  }

  function collectVnForm() {
    const form = vnFormEl();
    if (!form) return null;
    return {
      editingId: form.getAttribute("data-id") || "",
      title: form.title ? form.title.value : "",
      youtubeUrl: form.youtubeUrl ? form.youtubeUrl.value : "",
      summary: form.summary ? form.summary.value : "",
      useInBusiness: form.useInBusiness ? form.useInBusiness.value : "",
      ventureId: form.ventureId ? form.ventureId.value : "",
      tags: form.tags ? form.tags.value : "",
      sourceFile: form.sourceFile ? form.sourceFile.value : "",
      howToSteps: copySteps(vnFormSteps)
    };
  }

  function persistVnDraftFromForm() {
    const data = collectVnForm();
    if (!data) return;
    const has = String(data.title || "").trim() || String(data.youtubeUrl || "").trim() ||
      String(data.summary || "").trim() || String(data.useInBusiness || "").trim() ||
      (data.howToSteps && data.howToSteps.length) || String(data.tags || "").trim() || data.ventureId || String(data.sourceFile || "").trim();
    if (!has) {
      clearVnDraft();
      const hint = document.getElementById("vnDraftHint");
      if (hint) hint.textContent = "";
      return;
    }
    saveVnDraft(data);
    const hint = document.getElementById("vnDraftHint");
    if (hint) hint.textContent = "Draft saved on this device · " + formatWhen(data.savedAt || nowISO());
  }

  function charCountHtml(id, value, max) {
    const n = String(value || "").length;
    return '<p class="char-count" id="' + id + '">' + formatViews(n) + " of " + formatViews(max) + " characters</p>";
  }

  function updateCharCount(field, countId, max) {
    const el = document.getElementById(countId);
    if (!el || !field) return;
    el.textContent = formatViews(field.value.length) + " of " + formatViews(max) + " characters";
  }

  function filteredVideoNotes() {
    let list = (state.videoNotes || []).slice().sort((a, b) =>
      String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    if (vnVenture) list = list.filter((n) => n.ventureId === vnVenture);
    if (vnTag) {
      const want = vnTag.toLowerCase();
      list = list.filter((n) => (n.tags || []).some((t) => t.toLowerCase() === want));
    }
    const q = vnSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((n) => {
        const v = getVenture(n.ventureId);
        const blob = [
          n.title, n.summary, n.useInBusiness, n.youtubeUrl, n.sourceFile, (n.tags || []).join(" "),
          v ? v.name : "", (n.howToSteps || []).map((s) => s.text).join(" ")
        ].join("\n").toLowerCase();
        return blob.indexOf(q) !== -1;
      });
    }
    return list;
  }

  function viewVideoNotes() {
    const r = parseRoute();
    if (r.parts[1] === "new") return viewVideoNoteForm(null);
    if (r.parts[1] === "print") return viewVideoNotesPrint(null);
    if (r.parts[1]) {
      const note = getVideoNote(r.parts[1]);
      if (!note) return notFound("That video note was not found.");
      if (r.parts[2] === "edit") return viewVideoNoteForm(note);
      if (r.parts[2] === "print") return viewVideoNotesPrint(note);
      return viewVideoNote(note);
    }

    vnVenture = r.query.venture || "";
    vnTag = r.query.tag || "";

    const list = filteredVideoNotes();
    const tags = allVideoTags();
    const draft = loadVnDraft();
    let html = '<div class="page-head"><p class="kicker">Video notes</p><h1>Video notes</h1>' +
      '<p class="lead">Paste a YouTube video summary, then write how you could use it in your business and the steps to do it. Everything stays on this device.</p>' +
      '<p class="notice warning">Do not enter Social Security numbers, full Employer Identification Numbers, bank or card numbers, passwords, or other sensitive personal data.</p></div>' +
      '<p class="row"><a class="btn primary" href="#/video-notes/new">Add a video note</a>' +
      (draft ? '<a class="btn" href="#/video-notes/' + (draft.editingId ? esc(draft.editingId) + "/edit" : "new") + '">Continue draft</a>' : "") +
      "</p>";

    html += '<div class="card vn-toolbar">' +
      '<div class="field"><label><span>Search</span><input type="search" value="' + esc(vnSearch) + '" data-action="vn-search" placeholder="Search titles, summaries, steps, or tags"></label></div>' +
      '<div class="grid grid-2">' +
      '<div class="field"><label><span>Filter by linked idea</span><select data-action="vn-filter-venture">' +
      '<option value=""' + (!vnVenture ? " selected" : "") + ">All ideas and businesses</option>" +
      ventureSelect(vnVenture, { allowNone: false }) +
      "</select></label></div>" +
      '<div class="field"><label><span>Filter by tag</span><select data-action="vn-filter-tag">' +
      '<option value=""' + (!vnTag ? " selected" : "") + ">All tags</option>" +
      tags.map((t) => '<option value="' + esc(t) + '"' + (vnTag.toLowerCase() === t.toLowerCase() ? " selected" : "") + ">" + esc(t) + "</option>").join("") +
      "</select></label></div></div>" +
      '<p class="row"><button type="button" class="btn" data-action="vn-export">Export notes</button>' +
      '<button type="button" class="btn" data-action="vn-import">Import notes</button>' +
      '<a class="btn" href="#/video-notes/print">Print or share view</a></p>' +
      '<input id="vnImportFile" type="file" accept="application/json,.json" hidden></div>';

    html += '<div id="vnList">' + videoNotesListHtml(list) + "</div>";
    return html;
  }

  function videoNotesListHtml(list) {
    if (!list.length) {
      return '<div class="empty" style="margin-top:16px"><h2>No video notes yet</h2><p>Add a note and paste a video summary to get started, or change the search or filters.</p></div>';
    }
    return '<div class="list" style="margin-top:16px">' + list.map(videoNoteCard).join("") + "</div>";
  }

  function refreshVideoNotesList() {
    const box = document.getElementById("vnList");
    if (box) box.innerHTML = videoNotesListHtml(filteredVideoNotes());
  }

  function videoNoteCard(n) {
    const v = getVenture(n.ventureId);
    const p = howtoProgress(n.howToSteps);
    const snippet = String(n.summary || n.useInBusiness || "").replace(/\s+/g, " ").trim();
    const tags = (n.tags || []).map((t) => '<span class="badge">' + esc(t) + "</span>").join(" ");
    return '<a class="card idea-card accent vn-card" href="#/video-notes/' + esc(n.id) + '">' +
      '<div class="spread"><span class="title">' + esc(n.title || "Video note") + "</span>" +
      '<span class="tiny">' + esc(formatWhen(n.updatedAt)) + "</span></div>" +
      (v ? '<p class="tiny">Linked to ' + esc(v.name) + "</p>" : "") +
      (snippet ? "<p class=\"tiny\">" + esc(snippet.slice(0, 180)) + (snippet.length > 180 ? "…" : "") + "</p>" : "") +
      (tags ? '<p class="vn-tags">' + tags + "</p>" : "") +
      (p.total ? '<div class="tiny">How to do it: ' + p.done + " of " + p.total + " steps done</div>" +
        '<div class="progress" aria-hidden="true"><span style="width:' + p.pct + '%"></span></div>' : "") +
      "</a>";
  }

  function viewVideoNoteForm(note) {
    const draft = loadVnDraft();
    let values;
    if (note) {
      if (draft && draft.editingId === note.id) {
        values = draft;
        vnFormSteps = copySteps(draft.howToSteps);
      } else {
        values = {
          title: note.title || "",
          youtubeUrl: note.youtubeUrl || "",
          summary: note.summary || "",
          useInBusiness: note.useInBusiness || "",
          ventureId: note.ventureId || "",
          tags: (note.tags || []).join(", "),
          sourceFile: note.sourceFile || "",
          savedAt: draft && draft.editingId === note.id ? draft.savedAt : ""
        };
        vnFormSteps = copySteps(note.howToSteps);
      }
    } else if (draft && !draft.editingId) {
      values = draft;
      vnFormSteps = copySteps(draft.howToSteps);
    } else {
      values = { title: "", youtubeUrl: "", summary: "", useInBusiness: "", ventureId: "", tags: "", sourceFile: "" };
      vnFormSteps = [];
    }
    vnEditingStep = "";

    const draftHint = (draft && ((note && draft.editingId === note.id) || (!note && !draft.editingId)) && draft.savedAt)
      ? "Draft saved on this device · " + formatWhen(draft.savedAt)
      : "";

    return '<div class="page-head"><p class="kicker"><a href="#/video-notes">Video notes</a></p><h1>' +
      (note ? "Edit video note" : "New video note") + "</h1>" +
      '<p class="lead">Paste the video summary, or import a PDF, Word, or Excel file, then write how you will use it and the steps to do it.</p></div>' +
      importBoxHtml() +
      '<form class="card" data-action="save-video-note" data-id="' + (note ? esc(note.id) : "") + '">' +
      '<div class="field"><label><span>YouTube link (optional)</span>' +
      '<input name="youtubeUrl" type="url" maxlength="500" value="' + esc(values.youtubeUrl || "") + '" placeholder="https://www.youtube.com/watch?v=…" data-action="vn-url"></label></div>' +
      '<p class="row"><button type="button" class="btn" data-action="paste-vn-url">Paste link</button></p>' +
      youtubePreviewHtml(values.youtubeUrl, values.title) +
      '<div class="field"><label><span>Video title</span>' +
      '<input name="title" type="text" maxlength="200" value="' + esc(values.title || "") + '" placeholder="The name of the video is fine"></label></div>' +
      '<div class="field" id="vnSourceField"' + (values.sourceFile ? "" : " hidden") + '><label><span>Source file</span>' +
      '<input name="sourceFile" type="text" maxlength="200" value="' + esc(values.sourceFile || "") + '" readonly></label>' +
      '<p class="tiny">The file name is kept with the note. The file itself is not stored or uploaded.</p>' +
      '<button type="button" class="btn" data-action="vn-clear-source">Remove file name</button></div>' +
      '<div class="field"><label><span>Video summary</span>' +
      '<textarea name="summary" class="tall" maxlength="' + VN_SUMMARY_MAX + '" placeholder="Paste the video’s summary here">' + esc(values.summary || "") + "</textarea></label></div>" +
      '<p class="row"><button type="button" class="btn" data-action="paste-vn-summary">Paste</button></p>' +
      charCountHtml("vnSummaryCount", values.summary, VN_SUMMARY_MAX) +
      '<div class="field"><label><span>How I’ll use this in my business</span>' +
      '<textarea name="useInBusiness" class="tall" maxlength="' + VN_USE_MAX + '" placeholder="In your own words, how this could apply to a business you have or want to start">' + esc(values.useInBusiness || "") + "</textarea></label></div>" +
      '<p class="row"><button type="button" class="btn" data-action="paste-vn-use">Paste</button></p>' +
      charCountHtml("vnUseCount", values.useInBusiness, VN_USE_MAX) +
      '<div class="field"><label><span>Tie it to one of your ideas (optional)</span>' +
      "<select name=\"ventureId\">" + ventureSelect(values.ventureId || "") + "</select></label></div>" +
      '<div class="field"><label><span>Tags (optional, comma-separated)</span>' +
      '<input name="tags" type="text" maxlength="200" value="' + esc(values.tags || "") + '" placeholder="For example: pricing, marketing"></label></div>' +
      '<div id="howtoBlock">' + howtoEditorHtml(vnFormSteps, { form: true }) + "</div>" +
      '<p class="tiny" id="vnDraftHint">' + esc(draftHint) + "</p>" +
      '<p class="row"><button type="submit" class="btn primary">Save video note</button>' +
      '<a class="btn ghost" href="' + (note ? "#/video-notes/" + esc(note.id) : "#/video-notes") + '">Cancel</a>' +
      (draft && ((note && draft.editingId === note.id) || (!note && !draft.editingId))
        ? '<button type="button" class="btn" data-action="vn-discard-draft">Discard draft</button>' : "") +
      "</p></form>";
  }

  function howtoEditorHtml(steps, opts) {
    opts = opts || {};
    const p = howtoProgress(steps);
    const canCheck = !opts.form;
    let html = '<section class="howto card accent" id="howtoSection">' +
      '<div class="spread"><h2>How to do it: step-by-step instructions</h2>' +
      (p.total ? '<span class="badge ok" id="howtoProgressLabel">' + p.done + " of " + p.total + " done</span>" : '<span class="badge" id="howtoProgressLabel">No steps yet</span>') +
      "</div>" +
      '<p class="help">This is the main checklist for the note. Paste a list and we will turn it into numbered steps. You can use one step per line, or numbering like 1. or Step 1.</p>' +
      '<div class="progress" id="howtoProgressBar" aria-hidden="true"><span style="width:' + p.pct + '%"></span></div>' +
      '<ol class="howto-list" id="howtoList">';
    if (!steps.length) {
      html += '<li class="tiny muted" id="howtoEmpty">No steps yet. Paste a block or add one step below.</li>';
    } else {
      steps.forEach((s, i) => { html += howtoItemHtml(s, i, canCheck); });
    }
    html += "</ol>";
    html += '<div class="field" style="margin-top:14px"><label><span>Paste a block of steps</span>' +
      '<textarea id="howtoPaste" class="tall" maxlength="20000" placeholder="1. First step&#10;2. Second step&#10;Or one step on each line"></textarea></label></div>' +
      '<p class="row"><button type="button" class="btn" data-action="paste-howto">Paste</button>' +
      '<button type="button" class="btn primary" data-action="split-howto">Add these steps</button></p>' +
      '<div class="row howto-add">' +
      '<input id="howtoAdd" type="text" maxlength="' + VN_STEP_MAX + '" placeholder="Add one step">' +
      '<button type="button" class="btn" data-action="add-howto">Add step</button></div>' +
      "</section>";
    return html;
  }

  function howtoItemHtml(s, i, canCheck) {
    const editing = vnEditingStep === s.id;
    let body;
    if (editing) {
      body = '<div class="howto-edit"><input id="howtoEditInput" type="text" maxlength="' + VN_STEP_MAX + '" value="' + esc(s.text) + '">' +
        '<button type="button" class="btn primary" data-action="howto-save-edit" data-id="' + esc(s.id) + '">Save</button>' +
        '<button type="button" class="btn" data-action="howto-cancel-edit">Cancel</button></div>';
    } else if (canCheck) {
      body = '<label class="howto-check"><input type="checkbox" data-action="toggle-howto" data-id="' + esc(s.id) + '"' +
        (s.done ? " checked" : "") + '><span' + (s.done ? ' class="done"' : "") + ">" + esc(s.text) + "</span></label>";
    } else {
      body = '<div class="howto-text">' + (i + 1) + ". " + esc(s.text) + "</div>";
    }
    return '<li class="howto-item" data-id="' + esc(s.id) + '">' + body +
      '<div class="howto-tools no-print">' +
      '<button type="button" class="btn" data-action="howto-up" data-id="' + esc(s.id) + '" aria-label="Move step up">Up</button>' +
      '<button type="button" class="btn" data-action="howto-down" data-id="' + esc(s.id) + '" aria-label="Move step down">Down</button>' +
      (editing ? "" : '<button type="button" class="btn" data-action="howto-edit" data-id="' + esc(s.id) + '">Edit</button>') +
      '<button type="button" class="btn danger" data-action="howto-del" data-id="' + esc(s.id) + '">Delete</button>' +
      "</div></li>";
  }

  function currentHowtoContext() {
    const form = vnFormEl();
    if (form) return { mode: "form", steps: vnFormSteps, note: null };
    const r = parseRoute();
    if (r.name === "video-notes" && r.parts[1] && r.parts[1] !== "new" && r.parts[1] !== "print") {
      const note = getVideoNote(r.parts[1]);
      if (note) return { mode: "note", steps: note.howToSteps || (note.howToSteps = []), note: note };
    }
    return { mode: "form", steps: vnFormSteps, note: null };
  }

  function refreshHowtoBlock() {
    const ctx = currentHowtoContext();
    const block = document.getElementById("howtoBlock") || document.getElementById("howtoSection");
    if (!block) return;
    const html = howtoEditorHtml(ctx.steps, { form: ctx.mode === "form" });
    if (block.id === "howtoBlock") block.innerHTML = html;
    else block.outerHTML = html;
    const edit = document.getElementById("howtoEditInput");
    if (edit) { edit.focus(); edit.select(); }
  }

  function commitHowtoSteps(steps) {
    const ctx = currentHowtoContext();
    if (ctx.mode === "form") {
      vnFormSteps = steps;
      persistVnDraftFromForm();
    } else if (ctx.note) {
      ctx.note.howToSteps = steps;
      touch(ctx.note); save();
    }
    refreshHowtoBlock();
  }

  function viewVideoNote(note) {
    const v = getVenture(note.ventureId);
    const p = howtoProgress(note.howToSteps);
    const tags = (note.tags || []).map((t) => '<span class="badge">' + esc(t) + "</span>").join(" ");
    let html = '<div class="page-head"><p class="kicker"><a href="#/video-notes">Video notes</a></p><h1>' + esc(note.title || "Video note") + "</h1>" +
      '<p class="tiny">Updated ' + esc(formatWhen(note.updatedAt)) + (v ? " · Linked to <a href=\"#/ideas/" + esc(v.id) + "\">" + esc(v.name) + "</a>" : "") +      (note.sourceFile ? " · Source file: " + esc(note.sourceFile) : "") + "</p></div>" +
      '<p class="row no-print"><a class="btn primary" href="#/video-notes/' + esc(note.id) + '/edit">Edit</a>' +
      '<button type="button" class="btn" data-action="vn-copy" data-id="' + esc(note.id) + '">Copy to clipboard</button>' +
      '<button type="button" class="btn" data-action="vn-share" data-id="' + esc(note.id) + '">Share</button>' +
      '<a class="btn" href="#/video-notes/' + esc(note.id) + '/print">Print view</a>' +
      '<button type="button" class="btn danger" data-action="delete-video-note" data-id="' + esc(note.id) + '">Delete</button></p>';

    if (note.youtubeUrl || note.videoId) {
      html += '<div class="card">' + youtubePreviewHtml(note.youtubeUrl || (note.videoId ? youtubeWatchUrl(note.videoId) : ""), note.title) + "</div>";
    }
    html += '<div class="card" style="margin-top:16px"><h2>Video summary</h2>' +
      (note.summary ? "<p class=\"vn-body\">" + esc(note.summary).replace(/\n/g, "<br>") + "</p>" : "<p class=\"muted\">No summary pasted yet.</p>") +
      "</div>";
    html += '<div class="card" style="margin-top:16px"><h2>How I’ll use this in my business</h2>' +
      (note.useInBusiness ? "<p class=\"vn-body\">" + esc(note.useInBusiness).replace(/\n/g, "<br>") + "</p>" : "<p class=\"muted\">Nothing written yet.</p>") +
      "</div>";
    html += '<div id="howtoBlock" style="margin-top:16px">' + howtoEditorHtml(note.howToSteps || [], { form: false }) + "</div>";
    if (tags) html += '<p class="vn-tags" style="margin-top:16px">' + tags + "</p>";
    return html;
  }

  function viewVideoNotesPrint(note) {
    const list = note ? [note] : filteredVideoNotes();
    const heading = note ? (note.title || "Video note") : "Video notes";
    let html = '<div class="page-head print-head"><p class="kicker no-print"><a href="' +
      (note ? "#/video-notes/" + esc(note.id) : "#/video-notes") + '">Back</a></p><h1>' + esc(heading) + "</h1>" +
      (note ? "" : "<p class=\"tiny\">" + list.length + " note" + (list.length === 1 ? "" : "s") + (vnSearch || vnTag || vnVenture ? " in the current filters" : "") + "</p>") +
      '</div><p class="row no-print"><button type="button" class="btn primary" data-action="vn-print">Print</button>' +
      (note ? '<button type="button" class="btn" data-action="vn-copy" data-id="' + esc(note.id) + '">Copy to clipboard</button>' +
        '<button type="button" class="btn" data-action="vn-share" data-id="' + esc(note.id) + '">Share</button>' : "") +
      "</p>";
    if (!list.length) {
      html += '<div class="empty"><p>Nothing to print in this list.</p></div>';
      return html;
    }
    list.forEach((n) => { html += printNoteHtml(n, !note); });
    return html;
  }

  function printNoteHtml(n, showTitle) {
    const v = getVenture(n.ventureId);
    const p = howtoProgress(n.howToSteps);
    const id = n.videoId || parseYouTubeId(n.youtubeUrl);
    const href = n.youtubeUrl || (id ? youtubeWatchUrl(id) : "");
    let html = '<article class="card print-note">';
    if (showTitle) html += "<h2>" + esc(n.title || "Video note") + "</h2>";
    html += '<p class="tiny">Updated ' + esc(formatWhen(n.updatedAt)) + (v ? " · Linked to " + esc(v.name) : "") +      (n.sourceFile ? " · Source file: " + esc(n.sourceFile) : "") + "</p>";
    if (href) {
      html += '<p><strong>Video:</strong> <a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' +
        esc(n.title || href) + "</a></p>";
      if (id) {
        html += '<p class="print-thumb"><img class="yt-thumb" src="https://i.ytimg.com/vi/' + esc(id) + '/hqdefault.jpg" width="240" height="135" alt=""></p>';
      }
    }
    html += "<h3>Video summary</h3>" +
      (n.summary ? "<p class=\"vn-body\">" + esc(n.summary).replace(/\n/g, "<br>") + "</p>" : "<p class=\"muted\">No summary pasted yet.</p>");
    html += "<h3>How I’ll use this in my business</h3>" +
      (n.useInBusiness ? "<p class=\"vn-body\">" + esc(n.useInBusiness).replace(/\n/g, "<br>") + "</p>" : "<p class=\"muted\">Nothing written yet.</p>");
    html += "<h3>How to do it: step-by-step instructions</h3>";
    if (!p.total) html += "<p class=\"muted\">No steps yet.</p>";
    else {
      html += '<p class="tiny">' + p.done + " of " + p.total + " done</p>" +
        '<div class="progress" aria-hidden="true"><span style="width:' + p.pct + '%"></span></div>' +
        '<ol class="howto-list print-steps">';
      (n.howToSteps || []).forEach((s) => {
        html += "<li" + (s.done ? ' class="done"' : "") + ">" + (s.done ? "☑ " : "☐ ") + esc(s.text) + "</li>";
      });
      html += "</ol>";
    }
    if ((n.tags || []).length) html += '<p class="tiny">Tags: ' + esc(n.tags.join(", ")) + "</p>";
    html += "</article>";
    return html;
  }

  function videoNotePlainText(note) {
    const v = getVenture(note.ventureId);
    const lines = [];
    lines.push(note.title || "Video note");
    if (note.youtubeUrl) lines.push("Video: " + note.youtubeUrl);
    if (note.sourceFile) lines.push("Source file: " + note.sourceFile);
    if (v) lines.push("Linked to: " + v.name);
    if ((note.tags || []).length) lines.push("Tags: " + note.tags.join(", "));
    lines.push("");
    if (note.summary) {
      lines.push("Video summary");
      lines.push(note.summary);
      lines.push("");
    }
    if (note.useInBusiness) {
      lines.push("How I'll use this in my business");
      lines.push(note.useInBusiness);
      lines.push("");
    }
    const steps = note.howToSteps || [];
    if (steps.length) {
      const p = howtoProgress(steps);
      lines.push("How to do it: step-by-step instructions (" + p.done + " of " + p.total + " done)");
      steps.forEach((s, i) => {
        lines.push((s.done ? "[x] " : "[ ] ") + (i + 1) + ". " + s.text);
      });
    }
    return lines.join("\n").trim();
  }

  function copyText(text, okMsg) {
    const fail = function () {
      toast("Could not copy. Select the text and copy it yourself.");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast(okMsg || "Copied.");
      }).catch(function () { fallbackCopy(text, okMsg, fail); });
    } else {
      fallbackCopy(text, okMsg, fail);
    }
  }

  function fallbackCopy(text, okMsg, fail) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      const ok = document.execCommand("copy");
      if (ok) toast(okMsg || "Copied.");
      else fail();
    } catch (e) {
      fail();
    }
    document.body.removeChild(ta);
  }

  function pasteIntoField(field, after) {
    const fallback = function () {
      toast("This browser blocked clipboard access. Long-press the box or press Ctrl+V (Command+V on a Mac) to paste.");
      if (field) field.focus();
    };
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      fallback();
      return;
    }
    navigator.clipboard.readText().then(function (text) {
      if (!text) {
        toast("The clipboard is empty.");
        if (field) field.focus();
        return;
      }
      if (!field) return;
      if (!field.value) field.value = text;
      else field.value = field.value.replace(/\s*$/, "") + "\n" + text;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.focus();
      if (after) after(text);
    }).catch(fallback);
  }

  function createVideoNote(fields) {
    if (!state.videoNotes) state.videoNotes = [];
    const n = {
      id: uid(),
      title: String(fields.title || "").trim(),
      youtubeUrl: String(fields.youtubeUrl || "").trim(),
      videoId: fields.videoId || parseYouTubeId(fields.youtubeUrl),
      summary: String(fields.summary || "").trim(),
      useInBusiness: String(fields.useInBusiness || "").trim(),
      ventureId: fields.ventureId || "",
      tags: fields.tags || [],
      sourceFile: String(fields.sourceFile || "").trim(),
      howToSteps: copySteps(fields.howToSteps),
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    state.videoNotes.push(n);
    save();
    return n;
  }

  function addHowtoFromPaste() {
    const box = document.getElementById("howtoPaste");
    const text = box ? box.value : "";
    const parts = splitSteps(text);
    if (!parts.length) {
      toast("Paste or type some steps first.");
      if (box) box.focus();
      return;
    }
    const ctx = currentHowtoContext();
    const steps = copySteps(ctx.steps);
    parts.forEach((t) => {
      const text = t.slice(0, VN_STEP_MAX);
      if (text) steps.push({ id: uid(), text: text, done: false });
    });
    if (box) box.value = "";
    commitHowtoSteps(steps);
    toast("Added " + parts.length + " step" + (parts.length === 1 ? "" : "s") + ".");
  }

  function addHowtoOne() {
    const input = document.getElementById("howtoAdd");
    const text = input ? String(input.value || "").trim() : "";
    if (!text) {
      toast("Type a step first.");
      if (input) input.focus();
      return;
    }
    const ctx = currentHowtoContext();
    const steps = copySteps(ctx.steps);
    steps.push({ id: uid(), text: text.slice(0, VN_STEP_MAX), done: false });
    if (input) input.value = "";
    commitHowtoSteps(steps);
  }

  function moveHowto(id, dir) {
    const ctx = currentHowtoContext();
    const steps = copySteps(ctx.steps);
    const i = steps.findIndex((s) => s.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const tmp = steps[i];
    steps[i] = steps[j];
    steps[j] = tmp;
    vnEditingStep = "";
    commitHowtoSteps(steps);
  }

  function deleteHowto(id) {
    if (!confirm("Delete this step?")) return;
    const ctx = currentHowtoContext();
    vnEditingStep = "";
    commitHowtoSteps(copySteps(ctx.steps).filter((s) => s.id !== id));
  }

  function startHowtoEdit(id) {
    vnEditingStep = id;
    refreshHowtoBlock();
  }

  function saveHowtoEdit(id) {
    const input = document.getElementById("howtoEditInput");
    const text = input ? String(input.value || "").trim() : "";
    if (!text) {
      toast("A step needs some text.");
      if (input) input.focus();
      return;
    }
    const ctx = currentHowtoContext();
    const steps = copySteps(ctx.steps);
    const s = steps.find((x) => x.id === id);
    if (s) s.text = text.slice(0, VN_STEP_MAX);
    vnEditingStep = "";
    commitHowtoSteps(steps);
  }

  function toggleHowto(id, on) {
    const ctx = currentHowtoContext();
    if (ctx.mode === "form") return;
    const steps = ctx.steps;
    const s = steps.find((x) => x.id === id);
    if (!s) return;
    s.done = !!on;
    touch(ctx.note); save();
    const p = howtoProgress(steps);
    const label = document.getElementById("howtoProgressLabel");
    if (label) {
      label.textContent = p.done + " of " + p.total + " done";
      label.className = "badge ok";
    }
    const bar = document.querySelector("#howtoProgressBar > span");
    if (bar) bar.style.width = p.pct + "%";
    const item = document.querySelector('.howto-item[data-id="' + id + '"] span');
    if (item) item.classList.toggle("done", !!on);
  }

  function exportVideoNotes() {
    const payload = {
      app: "business-successhq-video-notes",
      exportedAt: nowISO(),
      videoNotes: state.videoNotes || []
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "business-successhq-video-notes-" + todayISO() + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Video notes downloaded.");
  }

  function importVideoNotesFile(file) {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(reader.result);
        let list = [];
        if (Array.isArray(data)) list = data;
        else if (data && Array.isArray(data.videoNotes)) list = data.videoNotes;
        else if (data && data.app === "business-successhq-video-notes" && Array.isArray(data.notes)) list = data.notes;
        else {
          toast("That file does not look like a video notes export.");
          return;
        }
        const cleaned = list.map((n) => {
          if (!n || typeof n !== "object") return null;
          return {
            id: uid(),
            title: String(n.title || "Video note").trim().slice(0, 200),
            youtubeUrl: String(n.youtubeUrl || "").trim().slice(0, 500),
            videoId: parseYouTubeId(n.youtubeUrl) || (n.videoId && /^[A-Za-z0-9_-]{11}$/.test(n.videoId) ? n.videoId : ""),
            summary: String(n.summary || "").slice(0, VN_SUMMARY_MAX),
            useInBusiness: String(n.useInBusiness || "").slice(0, VN_USE_MAX),
            ventureId: (n.ventureId && getVenture(n.ventureId)) ? n.ventureId : "",
            tags: parseTags(Array.isArray(n.tags) ? n.tags.join(", ") : n.tags),
            sourceFile: String(n.sourceFile || "").trim().slice(0, 200),
            howToSteps: copySteps(n.howToSteps || n.steps || []).map((s) => {
              s.text = s.text.slice(0, VN_STEP_MAX);
              return s;
            }),
            createdAt: n.createdAt || nowISO(),
            updatedAt: nowISO()
          };
        }).filter((n) => n && (n.title || n.summary || n.useInBusiness || n.howToSteps.length));
        if (!cleaned.length) {
          toast("No video notes were found in that file.");
          return;
        }
        if (!confirm("Add " + cleaned.length + " video note" + (cleaned.length === 1 ? "" : "s") + " from this file? The notes already on this device will be kept.")) return;
        if (!state.videoNotes) state.videoNotes = [];
        state.videoNotes = state.videoNotes.concat(cleaned);
        save();
        toast("Imported " + cleaned.length + " video note" + (cleaned.length === 1 ? "" : "s") + ".");
        render();
      } catch (err) {
        toast("Could not read that file.");
      }
    };
    reader.readAsText(file);
  }

  function afterRender() {
    const r = parseRoute();
    const printing = r.name === "video-notes" && (r.parts[1] === "print" || r.parts[2] === "print");
    document.body.classList.toggle("print-view", printing);
    document.querySelectorAll("img.yt-thumb").forEach((img) => {
      img.addEventListener("error", function () { this.hidden = true; });
    });
    bindVnImportUi();
    renderSyncStatus();
    const add = document.getElementById("howtoAdd");
    if (add) {
      add.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); addHowtoOne(); }
      });
    }
    const edit = document.getElementById("howtoEditInput");
    if (edit) {
      edit.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); saveHowtoEdit(edit.closest("[data-id]") ? edit.closest("[data-id]").getAttribute("data-id") : vnEditingStep); }
        if (e.key === "Escape") { e.preventDefault(); vnEditingStep = ""; refreshHowtoBlock(); }
      });
    }
  }

  function viewAbout() {
    return '<div class="page-head"><p class="kicker">About</p><h1>About Business SuccessHQ</h1></div>' +
      '<div class="card"><p>Business SuccessHQ is an original planning tool. You can use it with any business idea. It helps you capture ideas, score them, validate them, write a plan, follow official checklists, and track goals, habits, and numbers you enter yourself.</p>' +
      "<p>It is not affiliated with The Success Playbook YouTube channel (@successplaybookhq), or with any other company, show, or website that uses a similar name. It is not a copy of another product. The Ideas section includes a collection summarized from that channel's public videos; ideas you add from it are copies you can score yourself.</p>" +
      "<p>This app does not give legal, tax, financial, or trading advice. It does not place trades or file forms for you. Official links go to government sites, which can change.</p>" +
      "<p>Your information is stored only on this device, in this browser, unless you turn on Sync. Video notes, including pasted summaries, imported PDF, Word, or Excel text, and step-by-step instructions, stay on this device. Files you import are read on this device and are not uploaded. Source files themselves are not stored or synced — only the text. If you use more than one device, you can connect Sync, or use Export and Import to move a backup yourself. Backups do not include your sync token. Video notes also have their own export and import.</p>" +
      "<p>Do not enter Social Security numbers, full Employer Identification Numbers, bank or card numbers, passwords, or other sensitive personal data.</p></div>" +
      syncTeaserCard() +
      '<div class="card" style="margin-top:16px"><h2>Backup</h2>' +
      "<p>Download a copy of your data, or replace the data on this device with a backup file. Backups do not include your sync token. If Sync is connected, an imported backup is also sent to your other devices.</p>" +
      '<p class="row"><button type="button" class="btn primary" data-action="export">Export backup</button>' +
      '<button type="button" class="btn" data-action="import">Import backup</button></p>' +
      '<input id="importFile" type="file" accept="application/json,.json" hidden></div>' +
      '<div class="danger-zone"><h2>Delete data on this device</h2>' +
      "<p>This cannot be undone, except from a backup you already exported.</p>" +
      '<button type="button" class="btn danger" data-action="wipe">Delete all data on this device</button></div>' +
      '<p class="tiny" style="margin-top:24px">Times in this app use Central Time (America/Chicago).</p>';
  }

  function notFound(msg) {
    return '<div class="empty"><h1>Not found</h1><p>' + esc(msg) + '</p><p><a class="btn" href="#/home">Back home</a></p></div>';
  }

  function render() {
    renderNav();
    const r = parseRoute();
    const view = document.getElementById("view");
    let html = "";
    switch (r.name) {
      case "ideas": html = viewIdeas(); break;
      case "goals": html = viewGoals(); break;
      case "plan": html = viewPlan(); break;
      case "habits": html = viewHabits(); break;
      case "numbers": html = viewNumbers(); break;
      case "playbooks": html = viewPlaybooks(); break;
      case "library": html = viewLibrary(); break;
      case "notes": html = viewNotes(); break;
      case "video-notes": html = viewVideoNotes(); break;
      case "sync": html = viewSync(); break;
      case "about": html = viewAbout(); break;
      default: html = viewHome(); break;
    }
    view.innerHTML = html;
    document.getElementById("main").scrollTop = 0;
    window.scrollTo(0, 0);
    closeMenu();
    afterRender();
  }

  function useStarter(id) {
    const s = D.STARTERS.find((x) => x.id === id);
    if (!s) return;
    const existing = state.ventures.find((v) => v.starterId === s.id);
    if (existing) {
      toast("That starter is already on your list.");
      go("#/ideas/" + existing.id);
      return;
    }
    const v = createVenture({ name: s.name, kind: s.kind, description: "", starterId: s.id });
    toast("Added " + s.name + ". Nothing else was filled in.");
    go("#/ideas/" + v.id);
  }

  function addSpbIdea(id) {
    const idea = (D.SPB_IDEAS || []).find((x) => x.id === id);
    if (!idea) return;
    const existing = alreadyAddedSpb(idea);
    if (existing) {
      toast("That idea is already in your bank.");
      go("#/ideas/" + existing.id);
      return;
    }
    const quoteLine = idea.quote ? '\n\n"' + idea.quote + '"' : "";
    const desc = idea.summary + quoteLine + "\n\nSource: " + idea.videoTitle + " — The Success Playbook YouTube channel.";
    const v = createVenture({
      name: idea.name,
      kind: "idea",
      description: desc,
      sourceVideoId: idea.videoId,
      sourceUrl: spbVideoUrl(idea),
      sourceTitle: idea.videoTitle
    });
    toast("Added to your ideas. The scorecard is empty so you can rate it yourself.");
    go("#/ideas/" + v.id);
  }

  function createVenture(fields) {
    const v = {
      id: uid(),
      name: String(fields.name || "").trim(),
      kind: fields.kind === "business" ? "business" : "idea",
      description: String(fields.description || "").trim(),
      starterId: fields.starterId || "",
      sourceVideoId: fields.sourceVideoId || "",
      sourceUrl: fields.sourceUrl || "",
      sourceTitle: fields.sourceTitle || "",
      scores: {},
      weights: defaultWeights(),
      validation: { interviews: {}, competitors: {}, testOffer: {} },
      legalDone: false,
      review: { at: "", note: "" },
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    state.ventures.push(v);
    save();
    return v;
  }

  function handleVideoNoteClick(btn, action) {
    if (action === "vn-import-file") {
      const input = document.getElementById("vnFileInput");
      if (input) input.click();
      return true;
    }
    if (action === "vn-import-apply") { applyVnImport(); return true; }
    if (action === "vn-import-clear") { clearVnImport(); return true; }
    if (action === "vn-clear-source") {
      const form = vnFormEl();
      if (form && form.sourceFile) form.sourceFile.value = "";
      const wrap = document.getElementById("vnSourceField");
      if (wrap) wrap.hidden = true;
      persistVnDraftFromForm();
      return true;
    }
    if (action === "paste-vn-url") {
      const form = vnFormEl();
      pasteIntoField(form && form.youtubeUrl, function () {
        persistVnDraftFromForm();
        const form2 = vnFormEl();
        const box = document.getElementById("ytPreview");
        if (form2 && box) box.outerHTML = youtubePreviewHtml(form2.youtubeUrl.value, form2.title.value);
      });
      return true;
    }
    if (action === "paste-vn-summary") {
      const form = vnFormEl();
      pasteIntoField(form && form.summary, function () {
        if (form && form.summary) updateCharCount(form.summary, "vnSummaryCount", VN_SUMMARY_MAX);
        persistVnDraftFromForm();
      });
      return true;
    }
    if (action === "paste-vn-use") {
      const form = vnFormEl();
      pasteIntoField(form && form.useInBusiness, function () {
        if (form && form.useInBusiness) updateCharCount(form.useInBusiness, "vnUseCount", VN_USE_MAX);
        persistVnDraftFromForm();
      });
      return true;
    }
    if (action === "paste-howto") {
      const box = document.getElementById("howtoPaste");
      pasteIntoField(box, function () { addHowtoFromPaste(); });
      return true;
    }
    if (action === "split-howto") { addHowtoFromPaste(); return true; }
    if (action === "add-howto") { addHowtoOne(); return true; }
    if (action === "howto-up") { moveHowto(btn.getAttribute("data-id"), -1); return true; }
    if (action === "howto-down") { moveHowto(btn.getAttribute("data-id"), 1); return true; }
    if (action === "howto-edit") { startHowtoEdit(btn.getAttribute("data-id")); return true; }
    if (action === "howto-save-edit") { saveHowtoEdit(btn.getAttribute("data-id")); return true; }
    if (action === "howto-cancel-edit") { vnEditingStep = ""; refreshHowtoBlock(); return true; }
    if (action === "howto-del") { deleteHowto(btn.getAttribute("data-id")); return true; }
    if (action === "vn-copy") {
      const n = getVideoNote(btn.getAttribute("data-id"));
      if (n) copyText(videoNotePlainText(n), "Copied to the clipboard.");
      return true;
    }
    if (action === "vn-share") {
      const n = getVideoNote(btn.getAttribute("data-id"));
      if (!n) return true;
      const text = videoNotePlainText(n);
      if (navigator.share) {
        const payload = { title: n.title || "Video note", text: text };
        if (n.youtubeUrl) payload.url = n.youtubeUrl;
        navigator.share(payload).catch(function () {});
      } else {
        copyText(text, "Copied. You can paste it into a message or document.");
      }
      return true;
    }
    if (action === "vn-print") { window.print(); return true; }
    if (action === "vn-export") { exportVideoNotes(); return true; }
    if (action === "vn-import") {
      const input = document.getElementById("vnImportFile");
      if (input) input.click();
      return true;
    }
    if (action === "vn-discard-draft") {
      if (!confirm("Discard the unsaved draft on this device?")) return true;
      const form = vnFormEl();
      const id = form ? form.getAttribute("data-id") : "";
      clearVnDraft();
      vnFormSteps = [];
      vnEditingStep = "";
      toast("Draft discarded.");
      if (id && getVideoNote(id)) go("#/video-notes/" + id + "/edit");
      else go("#/video-notes/new");
      render();
      return true;
    }
    if (action === "delete-video-note") {
      const n = getVideoNote(btn.getAttribute("data-id"));
      if (!n) return true;
      if (!confirm("Delete the video note \u201c" + (n.title || "Video note") + "\u201d?")) return true;
      addTomb("videoNotes", n.id);
      state.videoNotes = (state.videoNotes || []).filter((x) => x.id !== n.id);
      save();
      toast("Video note deleted.");
      go("#/video-notes");
      return true;
    }
    return false;
  }

    function onSubmit(e) {
    const form = e.target.closest("form");
    if (!form) return;
    const action = form.getAttribute("data-action");
    if (!action) return;
    e.preventDefault();
    const fd = new FormData(form);

    if (action === "save-venture") {
      const name = String(fd.get("name") || "").trim();
      if (!name) return;
      const id = form.getAttribute("data-id");
      if (id) {
        const v = getVenture(id);
        if (!v) return;
        v.name = name;
        v.kind = fd.get("kind") === "business" ? "business" : "idea";
        v.description = String(fd.get("description") || "").trim();
        touch(v); save();
        toast("Saved.");
        go("#/ideas/" + v.id);
      } else {
        const v = createVenture({
          name: name,
          kind: fd.get("kind"),
          description: fd.get("description")
        });
        toast("Idea added.");
        go("#/ideas/" + v.id);
      }
      return;
    }

    if (action === "connect-sync") {
      connectSync();
      return;
    }

    if (action === "save-video-note") {
      const titleIn = String(fd.get("title") || "").trim();
      const summary = String(fd.get("summary") || "").trim();
      const useInBusiness = String(fd.get("useInBusiness") || "").trim();
      const youtubeUrl = String(fd.get("youtubeUrl") || "").trim();
      const tags = parseTags(fd.get("tags"));
      if (!titleIn && !summary && !useInBusiness && !vnFormSteps.length) {
        toast("Add a title, a summary, or at least one step first.");
        return;
      }
      const rec = {
        title: titleIn || (summary ? summary.slice(0, 60) : "Video note"),
        youtubeUrl: youtubeUrl,
        videoId: parseYouTubeId(youtubeUrl),
        summary: summary,
        useInBusiness: useInBusiness,
        ventureId: String(fd.get("ventureId") || ""),
        tags: tags,
        sourceFile: String(fd.get("sourceFile") || "").trim(),
        howToSteps: copySteps(vnFormSteps)
      };
      const id = form.getAttribute("data-id");
      if (id) {
        const n = getVideoNote(id);
        if (!n) return;
        Object.assign(n, rec);
        touch(n); save();
        clearVnDraft();
        toast("Video note saved.");
        go("#/video-notes/" + n.id);
      } else {
        const n = createVideoNote(rec);
        clearVnDraft();
        toast("Video note saved.");
        go("#/video-notes/" + n.id);
      }
      return;
    }

        if (action === "add-goal") {
      const title = String(fd.get("title") || "").trim();
      if (!title) return;
      state.goals.push({
        id: uid(),
        title: title,
        why: String(fd.get("why") || "").trim(),
        deadline: String(fd.get("deadline") || ""),
        ventureId: String(fd.get("ventureId") || ""),
        status: "open",
        milestones: [],
        createdAt: nowISO(),
        updatedAt: nowISO()
      });
      save();
      toast("Goal added.");
      render();
      return;
    }

    if (action === "add-milestone") {
      const title = String(fd.get("title") || "").trim();
      if (!title) return;
      const g = state.goals.find((x) => x.id === form.getAttribute("data-id"));
      if (!g) return;
      g.milestones = g.milestones || [];
      g.milestones.push({ id: uid(), title: title, done: false });
      touch(g); save();
      render();
      return;
    }

    if (action === "add-habit") {
      const title = String(fd.get("title") || "").trim();
      if (!title) return;
      const when = String(fd.get("when") || "daily");
      let days = "daily";
      if (when === "weekdays") days = [1, 2, 3, 4, 5];
      if (when === "custom") days = fd.getAll("dow").map(Number);
      state.habits.push({
        id: uid(),
        title: title,
        days: days,
        ventureId: String(fd.get("ventureId") || ""),
        createdAt: nowISO()
      });
      save();
      toast("Habit added.");
      render();
      return;
    }

    if (action === "add-kpi") {
      const name = String(fd.get("name") || "").trim();
      if (!name) return;
      const k = {
        id: uid(),
        name: name,
        unit: String(fd.get("unit") || "number"),
        ventureId: String(fd.get("ventureId") || ""),
        entries: [],
        createdAt: nowISO(),
        updatedAt: nowISO()
      };
      state.kpis.push(k);
      save();
      toast("Tracker added.");
      go("#/numbers/" + k.id);
      return;
    }

    if (action === "add-entry") {
      const k = state.kpis.find((x) => x.id === form.getAttribute("data-id"));
      if (!k) return;
      const date = String(fd.get("date") || todayISO());
      const value = Number(fd.get("value"));
      if (!Number.isFinite(value)) {
        toast("Enter a valid number.");
        return;
      }
      k.entries = k.entries || [];
      k.entries.push({
        id: uid(),
        date: date,
        value: value,
        note: String(fd.get("note") || "").trim()
      });
      touch(k); save();
      toast("Figure saved.");
      render();
      return;
    }

    if (action === "add-note") {
      const title = String(fd.get("title") || "").trim();
      const body = String(fd.get("body") || "").trim();
      if (!title || !body) return;
      state.notes.push({
        id: uid(),
        title: title,
        body: body,
        ventureId: String(fd.get("ventureId") || ""),
        createdAt: nowISO(),
        updatedAt: nowISO()
      });
      save();
      toast("Note saved.");
      render();
      return;
    }

    if (action === "save-review") {
      const v = getVenture(form.getAttribute("data-id"));
      if (!v) return;
      v.review = { at: todayISO(), note: String(fd.get("note") || "").trim() };
      touch(v); save();
      toast("Review saved.");
      render();
    }
  }

  function onClick(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    if (btn.tagName === "SELECT") return;
    if (btn.tagName === "TEXTAREA") return;
    if (btn.tagName === "INPUT" && btn.type !== "button" && btn.type !== "checkbox") return;
    if (btn.tagName === "FORM") return;
    const action = btn.getAttribute("data-action");

    if (action === "use-starter") { useStarter(btn.getAttribute("data-id")); return; }
    if (action === "add-spb-idea") { addSpbIdea(btn.getAttribute("data-id")); return; }
    if (action === "sync-now") { runSync("manual"); return; }
    if (action === "disconnect-sync") { disconnectSync(); return; }
    if (handleVideoNoteClick(btn, action)) return;
    if (action === "ideas-filter") { ideasFilter = btn.getAttribute("data-id"); render(); return; }
    if (action === "suggest-habit") {
      const title = btn.getAttribute("data-title");
      const input = document.querySelector('form[data-action="add-habit"] input[name="title"]');
      if (input) { input.value = title; input.focus(); }
      return;
    }
    if (action === "reset-weights") {
      const v = getVenture(btn.getAttribute("data-id"));
      if (!v) return;
      v.weights = defaultWeights();
      touch(v); save();
      render();
      toast("Weights reset to equal.");
      return;
    }
    if (action === "delete-venture") {
      const v = getVenture(btn.getAttribute("data-id"));
      if (!v) return;
      if (!confirm("Delete \u201c" + v.name + "\u201d? Goals, plans, notes, video notes, and numbers tied to it will stay, but they will no longer be tied to this item.")) return;
      addTomb("ventures", v.id);
      state.ventures = state.ventures.filter((x) => x.id !== v.id);
      state.goals.forEach((g) => { if (g.ventureId === v.id) g.ventureId = ""; });
      state.plans.forEach((p) => { if (p.ventureId === v.id) p.ventureId = ""; });
      state.kpis.forEach((k) => { if (k.ventureId === v.id) k.ventureId = ""; });
      state.notes.forEach((n) => { if (n.ventureId === v.id) n.ventureId = ""; });
      (state.videoNotes || []).forEach((n) => { if (n.ventureId === v.id) n.ventureId = ""; });
      state.habits.forEach((h) => { if (h.ventureId === v.id) h.ventureId = ""; });
      save();
      toast("Deleted.");
      go("#/ideas");
      return;
    }
    if (action === "toggle-goal-done") {
      const g = state.goals.find((x) => x.id === btn.getAttribute("data-id"));
      if (!g) return;
      g.status = g.status === "done" ? "open" : "done";
      touch(g); save(); render();
      return;
    }
    if (action === "delete-goal") {
      const g = state.goals.find((x) => x.id === btn.getAttribute("data-id"));
      if (!g) return;
      if (!confirm("Delete the goal \u201c" + g.title + "\u201d?")) return;
      addTomb("goals", g.id);
      state.goals = state.goals.filter((x) => x.id !== g.id);
      save(); render();
      return;
    }
    if (action === "delete-habit") {
      const id = btn.getAttribute("data-id");
      if (!confirm("Delete this habit and its check history?")) return;
      addTomb("habits", id);
      state.habits = state.habits.filter((h) => h.id !== id);
      delete state.habitLogs[id];
      save(); render();
      return;
    }
    if (action === "delete-kpi") {
      if (!confirm("Delete this tracker and the figures you entered in it?")) return;
      addTomb("kpis", btn.getAttribute("data-id"));
      state.kpis = state.kpis.filter((k) => k.id !== btn.getAttribute("data-id"));
      save(); go("#/numbers");
      return;
    }
    if (action === "delete-entry") {
      const k = state.kpis.find((x) => x.id === btn.getAttribute("data-kpi"));
      if (!k) return;
      k.entries = (k.entries || []).filter((en) => en.id !== btn.getAttribute("data-id"));
      touch(k); save(); render();
      return;
    }
    if (action === "delete-note") {
      if (!confirm("Delete this note?")) return;
      addTomb("notes", btn.getAttribute("data-id"));
      state.notes = state.notes.filter((n) => n.id !== btn.getAttribute("data-id"));
      save(); render();
      return;
    }
    if (action === "export") {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "business-successhq-backup-" + todayISO() + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast("Backup downloaded.");
      return;
    }
    if (action === "import") {
      document.getElementById("importFile").click();
      return;
    }
    if (action === "wipe") {
      if (!confirm("Delete all ideas, plans, goals, habits, numbers, notes, and video notes on this device? This does not remove your sync token. If Sync is connected, data from your other devices may come back the next time this device syncs.")) return;
      if (!confirm("This cannot be undone unless you have a backup. Delete everything?")) return;
      state = emptyState();
      save();
      toast("All data on this device was deleted.");
      go("#/home");
      render();
    }
  }

  function onChange(e) {
    const el = e.target;
    const action = el.getAttribute("data-action");
    if (!action) {
      if (el.id === "importFile" && el.files && el.files[0]) importFile(el.files[0]);
      if (el.id === "vnImportFile" && el.files && el.files[0]) {
        importVideoNotesFile(el.files[0]);
        el.value = "";
      }
      if (el.id === "vnFileInput" && el.files && el.files[0]) {
        importNoteFile(el.files[0]);
        el.value = "";
      }
      if (el.name === "when") {
        const box = document.getElementById("customDays");
        if (box) box.hidden = el.value !== "custom";
      }
      return;
    }
    if (action === "toggle-validation") {
      const v = getVenture(el.getAttribute("data-id"));
      if (!v) return;
      if (!v.validation) v.validation = { interviews: {}, competitors: {}, testOffer: {} };
      const pack = el.getAttribute("data-pack");
      if (!v.validation[pack]) v.validation[pack] = {};
      if (el.checked) v.validation[pack][el.getAttribute("data-key")] = true;
      else delete v.validation[pack][el.getAttribute("data-key")];
      touch(v); save();
      return;
    }
    if (action === "toggle-legal") {
      const v = getVenture(el.getAttribute("data-id"));
      if (!v) return;
      v.legalDone = !!el.checked;
      touch(v); save();
      render();
      return;
    }
    if (action === "toggle-milestone") {
      const g = state.goals.find((x) => x.id === el.getAttribute("data-goal"));
      if (!g) return;
      const m = (g.milestones || []).find((x) => x.id === el.getAttribute("data-id"));
      if (!m) return;
      m.done = !!el.checked;
      touch(g); save();
      return;
    }
    if (action === "toggle-habit") {
      const id = el.getAttribute("data-id");
      const day = el.getAttribute("data-day") || todayISO();
      if (!state.habitLogs[id]) state.habitLogs[id] = {};
      setFlag(state.habitLogs, id, day, el.checked);
      save();
      render();
      return;
    }
    if (action === "toggle-step") {
      setProgress(el.getAttribute("data-book"), el.getAttribute("data-venture") || "", el.getAttribute("data-key"), el.checked);
      render();
      return;
    }
    if (action === "filter-goals") {
      const val = el.value === "__all__" ? "" : el.value;
      go("#/goals" + (val ? ("?venture=" + encodeURIComponent(val)) : ""));
      return;
    }
    if (action === "pick-plan") {
      go("#/plan" + (el.value ? ("/" + encodeURIComponent(el.value)) : ""));
      return;
    }
    if (action === "filter-kpis") {
      go("#/numbers" + (el.value ? ("?venture=" + encodeURIComponent(el.value)) : ""));
      return;
    }
    if (action === "filter-playbooks") {
      state.filters.playbook = el.value;
      setSetting("playbookFilter", el.value);
      save();
      go("#/playbooks" + (el.value ? ("?venture=" + encodeURIComponent(el.value)) : ""));
      return;
    }
    if (action === "attach-playbook") {
      const book = el.getAttribute("data-book");
      go("#/playbooks/" + book + (el.value ? ("?venture=" + encodeURIComponent(el.value)) : ""));
      return;
    }
    if (action === "filter-notes") {
      go("#/notes" + (el.value ? ("?venture=" + encodeURIComponent(el.value)) : ""));
      return;
    }
    if (action === "vn-filter-venture") {
      vnVenture = el.value;
      const q = [];
      if (vnVenture) q.push("venture=" + encodeURIComponent(vnVenture));
      if (vnTag) q.push("tag=" + encodeURIComponent(vnTag));
      go("#/video-notes" + (q.length ? "?" + q.join("&") : ""));
      return;
    }
    if (action === "vn-filter-tag") {
      vnTag = el.value;
      const q = [];
      if (vnVenture) q.push("venture=" + encodeURIComponent(vnVenture));
      if (vnTag) q.push("tag=" + encodeURIComponent(vnTag));
      go("#/video-notes" + (q.length ? "?" + q.join("&") : ""));
      return;
    }
    if (action === "toggle-howto") {
      toggleHowto(el.getAttribute("data-id"), el.checked);
      return;
    }
    if (action === "vn-import-sheet") {
      changeImportSheet(el.value);
    }
  }

  function onInput(e) {
    const el = e.target;
    const action = el.getAttribute("data-action");
    if (action === "set-score" || action === "set-weight") {
      const v = getVenture(el.getAttribute("data-id"));
      if (!v) return;
      const key = el.getAttribute("data-key");
      const val = Number(el.value);
      if (action === "set-score") {
        if (!v.scores) v.scores = {};
        if (val <= 0) delete v.scores[key];
        else v.scores[key] = val;
        const label = el.closest(".score-row").querySelector("[data-role='score-label']");
        if (label) label.textContent = val > 0 ? String(val) : "\u2014";
      } else {
        if (!v.weights) v.weights = defaultWeights();
        v.weights[key] = val;
        const label = el.closest(".score-row").querySelector("[data-role='weight-label']");
        if (label) label.textContent = String(val);
      }
      touch(v); save();
      updateScoreUI(v);
      return;
    }
    if (action === "plan-section") {
      const plan = state.plans.find((p) => p.id === el.getAttribute("data-plan"));
      if (!plan) return;
      plan.sections[el.getAttribute("data-key")] = el.value;
      touch(plan); save();
      return;
    }
    if (action === "vn-search") {
      vnSearch = el.value;
      refreshVideoNotesList();
      return;
    }
    const form = el.closest && el.closest('form[data-action="save-video-note"]');
    if (form) {
      if (el.name === "summary") updateCharCount(el, "vnSummaryCount", VN_SUMMARY_MAX);
      if (el.name === "useInBusiness") updateCharCount(el, "vnUseCount", VN_USE_MAX);
      if (el.name === "youtubeUrl" || el.name === "title") {
        const box = document.getElementById("ytPreview");
        if (box) box.outerHTML = youtubePreviewHtml(form.youtubeUrl.value, form.title.value);
        document.querySelectorAll("img.yt-thumb").forEach((img) => {
          img.addEventListener("error", function () { this.hidden = true; });
        });
      }
      persistVnDraftFromForm();
    }
  }

  function importFile(file) {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== "object" || !Array.isArray(data.ventures)) {
          toast("That file does not look like a Business SuccessHQ backup.");
          return;
        }
        if (!confirm("Replace all data on this device with this backup?")) return;
        state = migrateState(Object.assign(emptyState(), data));
        if (!Array.isArray(state.videoNotes)) state.videoNotes = [];
        applyThemeFromSettings();
        save();
        toast("Backup imported.");
        render();
      } catch (err) {
        toast("Could not read that file.");
      }
    };
    reader.readAsText(file);
  }


  let pushTimer = 0;
  let pullTimer = 0;
  let syncing = false;
  let dirty = false;
  let syncStatus = "idle";
  let syncError = "";

  function formatStampCentral(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-US", {
      timeZone: TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }) + " Central";
  }

  function schedulePush() {
    if (!window.BizhqSync || !BizhqSync.getToken()) return;
    dirty = true;
    renderSyncStatus();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { runSync("auto"); }, 3000);
  }

  function schedulePull(reason) {
    if (!window.BizhqSync || !BizhqSync.getToken()) return;
    clearTimeout(pullTimer);
    pullTimer = setTimeout(function () { runSync(reason || "focus"); }, 400);
  }

  function applyMergedState(merged) {
    state.ventures = merged.ventures || [];
    state.goals = merged.goals || [];
    state.plans = merged.plans || [];
    state.habits = merged.habits || [];
    state.kpis = merged.kpis || [];
    state.notes = merged.notes || [];
    state.videoNotes = merged.videoNotes || [];
    state.habitLogs = merged.habitLogs || {};
    state.playbookProgress = merged.playbookProgress || {};
    state.settings = merged.settings || {};
    state.settingsTimes = merged.settingsTimes || {};
    state.filters = merged.filters || {};
    state.tombstones = merged.tombstones || BizhqSync.emptyTombs();
    state.version = 2;
    applyThemeFromSettings();
  }

  function runSync(reason) {
    if (!window.BizhqSync) return Promise.resolve();
    const token = BizhqSync.getToken();
    if (!token) return Promise.resolve();
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      syncStatus = "offline";
      dirty = true;
      renderSyncStatus();
      return Promise.resolve();
    }
    if (syncing) {
      dirty = true;
      return Promise.resolve();
    }
    syncing = true;
    syncStatus = reason === "connect" ? "connecting" : "syncing";
    syncError = "";
    renderSyncStatus();

    const afterError = function (err) {
      syncStatus = "error";
      syncError = (err && err.message) ? String(err.message) : "Sync could not be completed.";
    };

    return Promise.resolve()
      .then(function () {
        const knownId = BizhqSync.getGistId();
        if (!knownId) return null;
        return BizhqSync.getGist(token, knownId).then(function (gist) {
          return { gist: gist, remote: BizhqSync.readGistData(gist) };
        }).catch(function () {
          BizhqSync.setGistId("");
          return null;
        });
      })
      .then(function (found) {
        if (found) return found;
        return BizhqSync.findExistingGist(token).then(function (g) {
          if (!g) return null;
          BizhqSync.setGistId(g.id);
          return BizhqSync.getGist(token, g.id).then(function (gist) {
            return { gist: gist, remote: BizhqSync.readGistData(gist) };
          });
        });
      })
      .then(function (found) {
        if (found && found.remote) {
          const merged = BizhqSync.mergeStates(state, found.remote);
          applyMergedState(merged);
          save({ skipPush: true });
          render();
        }
        const content = JSON.stringify(BizhqSync.syncPayload(state), null, 2);
        if (!BizhqSync.getGistId()) {
          return BizhqSync.createGist(token, content).then(function (created) {
            if (created && created.id) BizhqSync.setGistId(created.id);
          });
        }
        return BizhqSync.patchGist(token, BizhqSync.getGistId(), content);
      })
      .then(function () {
        dirty = false;
        BizhqSync.setLastSync(nowISO());
        syncStatus = "synced";
      })
      .catch(afterError)
      .then(function () {
        syncing = false;
        renderSyncStatus();
        if (dirty && BizhqSync.getToken() && navigator.onLine) schedulePush();
      });
  }

  function connectSync() {
    const input = document.getElementById("syncTokenInput");
    const err = document.getElementById("syncConnectError");
    if (!input) return;
    const token = (input.value || "").trim();
    if (err) err.textContent = "";
    if (!token) {
      if (err) err.textContent = "Paste your token first.";
      input.focus();
      return;
    }
    BizhqSync.setToken(token);
    input.value = "";
    syncStatus = "connecting";
    render();
    runSync("connect").then(function () {
      if (syncStatus === "error") {
        if (syncError.indexOf("not accepted") !== -1) BizhqSync.clearToken();
        render();
        return;
      }
      toast("This device is connected. Use a token from the same GitHub account on your other devices.");
      render();
    });
  }

  function disconnectSync() {
    if (!confirm("Remove the token from this device? Your information on this device and the copy in GitHub will stay as they are. Other devices stay connected.")) return;
    clearTimeout(pushTimer);
    clearTimeout(pullTimer);
    BizhqSync.clearToken();
    BizhqSync.setLastSync("");
    dirty = false;
    syncing = false;
    syncStatus = "idle";
    syncError = "";
    toast("The token was removed from this device. Your information is still here.");
    render();
  }

  function syncStatusText() {
    if (!window.BizhqSync || !BizhqSync.getToken()) return "Not connected";
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "Offline — changes will sync when you are back online";
    }
    if (syncStatus === "connecting") return "Connecting…";
    if (syncStatus === "syncing") return "Syncing…";
    if (syncStatus === "error") return "Sync needs attention";
    if (dirty) return "Waiting to send your latest changes…";
    if (syncStatus === "synced" || BizhqSync.getLastSync()) return "Connected";
    return "Connected";
  }

  function renderSyncStatus() {
    const line = document.getElementById("syncStatusLine");
    const last = document.getElementById("syncLastLine");
    const mask = document.getElementById("syncTokenMask");
    const actions = document.getElementById("syncConnectedActions");
    const setup = document.getElementById("syncSetupCard");
    const errBox = document.getElementById("syncConnectError");
    const connected = !!(window.BizhqSync && BizhqSync.getToken());
    const text = syncStatusText();
    if (line) {
      line.textContent = text;
      line.className = "sync-status";
      if (syncStatus === "error") line.classList.add("err");
      else if (!connected) line.classList.add("warn");
      else if (typeof navigator !== "undefined" && navigator.onLine === false) line.classList.add("warn");
      else if (syncStatus === "synced" || connected) line.classList.add("ok");
    }
    if (last) {
      const lastIso = connected ? BizhqSync.getLastSync() : "";
      if (!connected) last.textContent = "";
      else if (lastIso) last.textContent = "Last synced " + formatStampCentral(lastIso);
      else last.textContent = "Not synced yet.";
      if (syncStatus === "error" && syncError) {
        last.textContent = (last.textContent ? last.textContent + " " : "") + syncError;
      }
    }
    if (mask) {
      mask.textContent = connected ? ("The token stored on this device is " + BizhqSync.maskToken(BizhqSync.getToken())) : "";
    }
    if (actions) actions.hidden = !connected;
    if (setup) setup.hidden = connected;
    if (errBox && connected) errBox.textContent = "";
    if (errBox && !connected && syncStatus === "error") errBox.textContent = syncError;
    const hint = document.getElementById("syncSummaryHint");
    if (hint) hint.textContent = syncSummaryText();
  }

  function syncSummaryText() {
    if (!window.BizhqSync || !BizhqSync.getToken()) {
      return "Keep the same Business SuccessHQ information on your computer, tablet and phone. You are not connected yet.";
    }
    const lastIso = BizhqSync.getLastSync();
    const last = lastIso ? (" Last synced " + formatStampCentral(lastIso) + ".") : "";
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "Offline — changes will sync when you are back online." + last;
    }
    if (syncStatus === "error") return "Sync needs attention." + (syncError ? " " + syncError : "") + last;
    if (syncStatus === "syncing" || syncStatus === "connecting") return syncStatusText() + last;
    return "Connected to your private GitHub Gist." + last;
  }

  function syncTeaserCard() {
    return '<div class="card accent" style="margin-top:20px" id="syncSummaryCard"><h2>Sync across your devices</h2>' +
      '<p class="help" id="syncSummaryHint">' + esc(syncSummaryText()) + "</p>" +
      '<p class="row"><a class="btn primary" href="#/sync">Open Sync</a></p></div>';
  }

  function viewSync() {
    return '<div class="page-head"><p class="kicker">Sync</p><h1>Sync</h1>' +
      '<p class="lead">Keep the same ideas, plans, and video notes on your computer, tablet, and phone through a private GitHub Gist on your own account.</p></div>' +
      '<div class="card" id="syncStatusCard"><h2>Status</h2>' +
      '<p id="syncStatusLine" class="sync-status">Not connected</p>' +
      '<p id="syncLastLine" class="help"></p>' +
      '<p id="syncTokenMask" class="help"></p>' +
      '<p class="row" id="syncConnectedActions" hidden>' +
      '<button type="button" class="btn primary" data-action="sync-now">Sync now</button>' +
      '<button type="button" class="btn danger" data-action="disconnect-sync">Disconnect</button></p></div>' +
      '<div class="card" id="syncSetupCard" style="margin-top:16px"><h2>Connect this device</h2>' +
      "<p>Sync uses a private GitHub note (called a Gist) on your own GitHub account. This app never asks for your GitHub password. The access token you paste is stored only on this device and is never shown back in full. It is sent only to api.github.com and is never included in backups.</p>" +
      '<ol class="steps">' +
      '<li>Sign in to GitHub in your browser. If you do not have an account yet, create one at <a href="https://github.com/signup" target="_blank" rel="noopener noreferrer">github.com</a> first.</li>' +
      '<li>Open GitHub’s classic token page to create an access token with only the “gist” permission: <a href="https://github.com/settings/tokens/new?scopes=gist&amp;description=Business%20SuccessHQ%20Sync" target="_blank" rel="noopener noreferrer">github.com/settings/tokens</a>.</li>' +
      "<li>On that page, confirm that only the <strong>gist</strong> box is checked. For expiration, choose <strong>No expiration</strong> or <strong>1 year</strong>, then click <strong>Generate token</strong>.</li>" +
      "<li>Copy the token now. GitHub will not show it again.</li>" +
      "<li>Come back here, paste it below, and tap <strong>Connect</strong>.</li>" +
      "<li>On your PC, your Lenovo tablet, and your Motorola phone, open Business SuccessHQ and paste the <strong>same token</strong> on this Sync screen.</li>" +
      "</ol>" +
      '<p class="help">If you already made a gist-scope token for My Daily Journal, you can reuse it here. It will still create or find a separate private Gist named “Business SuccessHQ Sync,” and will not mix with your journal. Do not share the token with anyone. If it expires, create a new one and connect again.</p>' +
      '<form data-action="connect-sync" autocomplete="off" id="syncConnectForm">' +
      '<div class="field"><label><span>GitHub access token</span>' +
      '<input id="syncTokenInput" name="token" type="password" maxlength="200" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off" placeholder="Paste your token"></label></div>' +
      '<p class="row"><button type="submit" class="btn primary">Connect</button></p>' +
      '<p id="syncConnectError" class="sync-error" role="alert"></p></form></div>' +
      '<div class="card" style="margin-top:16px"><h2>How it stays in sync</h2>' +
      "<p>The first device that connects creates a private Gist named “Business SuccessHQ Sync” (file bizhq-data.json). Other devices that connect with a token from the same account find that same Gist automatically. Changes are sent a few seconds after you make them, and again when you open the app or come back to it. If you are offline, the app keeps your changes and sends them when you are back online.</p>" +
      "<p>If you edit the same item on two devices before they sync, the later edit is kept. Deleting an item on one device is remembered so it does not come back from the other device, unless that other device changed it more recently.</p>" +
      "<p>Video Notes source files are not stored or synced — only the text you imported or typed, including step-by-step checklists.</p></div>";
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    setSetting("theme", next);
    save();
    renderNav();
  }

  document.getElementById("themeBtn").addEventListener("click", toggleTheme);
  document.getElementById("menuBtn").addEventListener("click", function () {
    const open = document.getElementById("rail").classList.contains("open");
    if (open) closeMenu(); else openMenu();
  });
  document.getElementById("railBackdrop").addEventListener("click", closeMenu);
  document.getElementById("view").addEventListener("submit", onSubmit);
  document.getElementById("view").addEventListener("click", onClick);
  document.getElementById("view").addEventListener("change", onChange);
  document.getElementById("view").addEventListener("input", onInput);
  document.getElementById("rail").addEventListener("click", function (e) {
    if (e.target.closest("a")) closeMenu();
  });
  window.addEventListener("hashchange", render);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") schedulePull("focus");
  });
  window.addEventListener("focus", function () { schedulePull("focus"); });
  window.addEventListener("online", function () {
    if (window.BizhqSync && BizhqSync.getToken()) runSync("online");
  });
  applyThemeFromSettings();
  if (!location.hash) location.hash = "#/home";
  else render();
  if (window.BizhqSync && BizhqSync.getToken()) runSync("open");
})();
