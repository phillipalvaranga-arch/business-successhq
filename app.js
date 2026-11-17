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
    { id: "about", href: "#/about", label: "About", group: "More", ico: "A" }
  ];

  let state = load();
  let ideasFilter = "all";
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
      playbookProgress: {},
      filters: {}
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyState();
      const s = JSON.parse(raw);
      return Object.assign(emptyState(), s);
    } catch (e) {
      return emptyState();
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      toast("Could not save on this device. Storage may be full.");
    }
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
      const done = book.steps.filter((s) => rec[s.id]).length;
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
    if (on) state.playbookProgress[key][stepId] = true;
    else delete state.playbookProgress[key][stepId];
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
    return '<a class="card idea-card accent" href="#/ideas/' + esc(v.id) + '">' +
      '<div class="spread"><span class="title">' + esc(v.name) + "</span><span>" + kindBadge(v.kind) + " " + scoreBadge(v) + "</span></div>" +
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
        '<p class="row"><a class="btn primary" href="#/ideas/new">Add an idea</a></p>' +
        startersBox() +
        "</div>";
    } else {
      body += '<p class="row"><a class="btn primary" href="#/ideas/new">Add an idea</a><a class="btn" href="#/ideas">All ideas</a></p>';
      if (recent.length) {
        body += "<h2>Continue</h2><div class=\"list\">" + recent.map(ideaCard).join("") + "</div>";
      }
      body += startersBox();
    }

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

    if (!state.ventures.length) {
      html += '<div class="empty"><h2>No ideas yet</h2><p>Add your first idea, or use an optional starter for a business you already have.</p></div>' + startersBox();
    } else if (!list.length) {
      html += '<div class="empty"><p>Nothing in this filter yet.</p></div>';
    } else {
      html += '<div class="list">' + list.map(ideaCard).join("") + "</div>";
    }
    return html;
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
    return !!(state.habitLogs[h.id] && state.habitLogs[h.id][iso]);
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
      const done = p.steps.filter((s) => rec[s.id]).length;
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
    const done = book.steps.filter((s) => rec[s.id]).length;
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
        const on = !!rec[s.id];
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

  function viewAbout() {
    return '<div class="page-head"><p class="kicker">About</p><h1>About Business SuccessHQ</h1></div>' +
      '<div class="card"><p>Business SuccessHQ is an original planning tool. You can use it with any business idea. It helps you capture ideas, score them, validate them, write a plan, follow official checklists, and track goals, habits, and numbers you enter yourself.</p>' +
      "<p>It is not affiliated with The Success Playbook YouTube channel (@successplaybookhq), or with any other company, show, or website that uses a similar name. It is not a copy of another product.</p>" +
      "<p>This app does not give legal, tax, financial, or trading advice. It does not place trades or file forms for you. Official links go to government sites, which can change.</p>" +
      "<p>Your information is stored only on this device, in this browser. It is not sent to a server. If you use more than one device, use Export and Import to move a backup yourself.</p>" +
      "<p>Do not enter Social Security numbers, full Employer Identification Numbers, bank or card numbers, passwords, or other sensitive personal data.</p></div>" +
      '<div class="card" style="margin-top:16px"><h2>Backup</h2>' +
      "<p>Download a copy of your data, or replace the data on this device with a backup file.</p>" +
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
      case "about": html = viewAbout(); break;
      default: html = viewHome(); break;
    }
    view.innerHTML = html;
    document.getElementById("main").scrollTop = 0;
    window.scrollTo(0, 0);
    closeMenu();
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

  function createVenture(fields) {
    const v = {
      id: uid(),
      name: String(fields.name || "").trim(),
      kind: fields.kind === "business" ? "business" : "idea",
      description: String(fields.description || "").trim(),
      starterId: fields.starterId || "",
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
      if (!confirm("Delete \u201c" + v.name + "\u201d? Goals, plans, notes, and numbers tied to it will stay, but they will no longer be tied to this item.")) return;
      state.ventures = state.ventures.filter((x) => x.id !== v.id);
      state.goals.forEach((g) => { if (g.ventureId === v.id) g.ventureId = ""; });
      state.plans.forEach((p) => { if (p.ventureId === v.id) p.ventureId = ""; });
      state.kpis.forEach((k) => { if (k.ventureId === v.id) k.ventureId = ""; });
      state.notes.forEach((n) => { if (n.ventureId === v.id) n.ventureId = ""; });
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
      state.goals = state.goals.filter((x) => x.id !== g.id);
      save(); render();
      return;
    }
    if (action === "delete-habit") {
      const id = btn.getAttribute("data-id");
      if (!confirm("Delete this habit and its check history?")) return;
      state.habits = state.habits.filter((h) => h.id !== id);
      delete state.habitLogs[id];
      save(); render();
      return;
    }
    if (action === "delete-kpi") {
      if (!confirm("Delete this tracker and the figures you entered in it?")) return;
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
      if (!confirm("Delete all ideas, plans, goals, habits, numbers, and notes on this device?")) return;
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
      if (el.checked) state.habitLogs[id][day] = true;
      else delete state.habitLogs[id][day];
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
        state = Object.assign(emptyState(), data);
        save();
        toast("Backup imported.");
        render();
      } catch (err) {
        toast("Could not read that file.");
      }
    };
    reader.readAsText(file);
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
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
  if (!location.hash) location.hash = "#/home";
  else render();
})();
