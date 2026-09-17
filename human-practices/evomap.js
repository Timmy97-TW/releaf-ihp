/* =============================================================================
   ReLeaf: Project Evolution Map: renderer
   -----------------------------------------------------------------------------
   Vanilla JS, no libraries, one IIFE. On DOMContentLoaded it finds every
   [data-evomap] element and renders:

     · a ruled tally
     · filter chips (project area, return threads only, referral chains, view)
     · the plate: an inline SVG with one state line per project area, a
       decision mark on every area an engagement changed, those marks stitched
       together vertically, return-visit arcs above and referral arcs below
     · a key
     · a detail panel, written into on click or focus, with a visit comparison
       for anyone we went back to
     · a list view of the same data, which is also what narrow screens get
       first

   Data comes from window.EVOMAP (evomap-data.js). Nothing here invents content;
   every string rendered is a field of that object.

   Every heading this file writes carries data-no-toc, so the page's own
   numbering and contents rail (assets/js/page.js) leaves them alone.
   ========================================================================== */

(function () {
  "use strict";

  var D = window.EVOMAP;
  if (!D) return;

  /* -------------------------------------------------------------- helpers */

  var SVGNS = "http://www.w3.org/2000/svg";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function day(iso) { return new Date(iso + "T00:00:00").getTime(); }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmt(iso) {
    var d = new Date(iso + "T00:00:00");
    return d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear();
  }
  function fmtShort(iso) {
    var d = new Date(iso + "T00:00:00");
    return d.getDate() + " " + MON[d.getMonth()];
  }
  function svg(name, attrs, text) {
    var n = document.createElementNS(SVGNS, name), k;
    if (attrs) for (k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function firstSentence(s) {
    if (!s) return "";
    var m = /^[\s\S]*?[.!?](\s|$)/.exec(s);
    return (m ? m[0] : s).trim();
  }
  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ------------------------------------------------------------ geometry */

  var PAD_L = 152, PAD_R = 34, W_MIN = 1180;
  var AXIS_H = 34, NODE_STRIP = 26, LANE_H = 100, LANE_BASE = 60;
  var LOOP_ROW = 30, CHAIN_ROW = 30, MIN_GAP = 26;

  /* ------------------------------------------------------- shared derived */

  var lanes = D.lanes;
  var laneIndex = {};
  lanes.forEach(function (l, i) { laneIndex[l.id] = i; });

  var engagements = D.engagements.slice().sort(function (a, b) { return day(a.date) - day(b.date); });
  var builds = D.builds.slice().sort(function (a, b) { return day(a.date) - day(b.date); });

  /* Which return threads an engagement belongs to. The forum belongs to three
     of them at once, which is the point of it, so this is a list per node. */
  var loopsOf = {};
  D.loops.forEach(function (lp) {
    lp.visits.forEach(function (v, i) {
      (loopsOf[v] = loopsOf[v] || []).push({ loop: lp, index: i });
    });
  });
  function inLoop(id) { return !!(loopsOf[id] && loopsOf[id].length); }

  /* chains keyed both ways */
  var chainsFrom = {}, chainsTo = {};
  D.chains.forEach(function (c) {
    (chainsFrom[c.from.id] = chainsFrom[c.from.id] || []).push(c);
    (chainsTo[c.to.id] = chainsTo[c.to.id] || []).push(c);
  });

  var decisionCount = engagements.reduce(function (n, e) { return n + e.lanes.length; }, 0);

  /* every positioned item, relaxed along the time axis so nothing overlaps */
  function positions() {
    var t0 = day(D.meta.start), t1 = day(D.meta.end);
    var inner = W_MIN - PAD_L - PAD_R;
    function raw(iso) { return PAD_L + (day(iso) - t0) / (t1 - t0) * inner; }

    var items = [];
    engagements.forEach(function (e) { items.push({ id: e.id, t: day(e.date), kind: "e", x: raw(e.date) }); });
    builds.forEach(function (b) { items.push({ id: b.id, t: day(b.date), kind: "b", x: raw(b.date) }); });
    items.sort(function (a, b) { return a.t - b.t || (a.kind === "e" ? -1 : 1); });

    for (var i = 1; i < items.length; i++) {
      if (items[i].x - items[i - 1].x < MIN_GAP) items[i].x = items[i - 1].x + MIN_GAP;
    }
    var map = {};
    items.forEach(function (it) { map[it.id] = it.x; });
    var width = Math.max(W_MIN, items[items.length - 1].x + PAD_R);
    return { x: map, raw: raw, width: width };
  }

  /* ============================================================== RENDER == */

  function build(root) {
    root.classList.add("evomap");
    root.innerHTML = "";

    var state = {
      sel: null,
      lanes: null,          /* null = all lanes */
      loopsOnly: false,
      chains: true,
      view: window.matchMedia("(max-width: 47.99rem)").matches ? "list" : "map"
    };

    /* ------------------------------------------------------------- tally */
    var tally = document.createElement("dl");
    tally.className = "em-tally";
    [
      ["Engagements logged", engagements.length, "Experts, farms, companies, exhibitions and one public forum, March to September 2026."],
      ["Return threads", D.loops.length, "People and organisations we went back to, or who came back to us. One more, Dr. Kyle, ran weekly from June."],
      ["Decisions on the plate", decisionCount, "One mark for each project area an engagement changed. Several meetings changed four at once."],
      ["Referral chains", D.chains.length, "A meeting that sent us to the next farm, speaker, build or experiment."]
    ].forEach(function (row) {
      var d = document.createElement("div");
      d.innerHTML = "<dt>" + esc(row[0]) + "</dt><dd>" + row[1] +
        "<span>" + esc(row[2]) + "</span></dd>";
      tally.appendChild(d);
    });
    root.appendChild(tally);

    /* ---------------------------------------------------------- controls */
    var controls = document.createElement("div");
    controls.className = "em-controls";
    controls.innerHTML = '<span class="em-controls__label">Areas</span>';

    var laneChips = [];
    lanes.forEach(function (l) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "em-chip";
      b.setAttribute("aria-pressed", "true");
      b.title = l.blurb;
      b.textContent = l.name;
      b.addEventListener("click", function () {
        var on = b.getAttribute("aria-pressed") === "true";
        b.setAttribute("aria-pressed", on ? "false" : "true");
        state.lanes = laneChips.filter(function (c) {
          return c.el.getAttribute("aria-pressed") === "true";
        }).map(function (c) { return c.id; });
        if (state.lanes.length === lanes.length) state.lanes = null;
        apply();
      });
      laneChips.push({ id: l.id, el: b });
      controls.appendChild(b);
    });

    var sep1 = document.createElement("span");
    sep1.className = "em-controls__sep";
    controls.appendChild(sep1);

    var loopBtn = document.createElement("button");
    loopBtn.type = "button";
    loopBtn.className = "em-chip";
    loopBtn.setAttribute("aria-pressed", "false");
    loopBtn.textContent = "Return threads only";
    loopBtn.addEventListener("click", function () {
      state.loopsOnly = loopBtn.getAttribute("aria-pressed") !== "true";
      loopBtn.setAttribute("aria-pressed", state.loopsOnly ? "true" : "false");
      apply();
    });
    controls.appendChild(loopBtn);

    var chainBtn = document.createElement("button");
    chainBtn.type = "button";
    chainBtn.className = "em-chip em-chip--cross";
    chainBtn.setAttribute("aria-pressed", "true");
    chainBtn.textContent = "Referral chains";
    chainBtn.addEventListener("click", function () {
      state.chains = chainBtn.getAttribute("aria-pressed") !== "true";
      chainBtn.setAttribute("aria-pressed", state.chains ? "true" : "false");
      apply();
    });
    controls.appendChild(chainBtn);

    var sep2 = document.createElement("span");
    sep2.className = "em-controls__sep";
    controls.appendChild(sep2);

    var viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "em-chip";
    controls.appendChild(viewBtn);

    root.appendChild(controls);

    /* ------------------------------------------------------------- plate */
    var plate = document.createElement("div");
    plate.className = "em-plate";
    plate.innerHTML =
      '<div class="em-plate__head">' +
        '<h3 data-no-toc="true">' + esc(D.meta.title) + "</h3>" +
        "<p>" + esc(D.meta.standfirst) + "</p>" +
      "</div>" +
      '<div class="em-plate__scroll"></div>' +
      '<p class="em-hint em-hint--scroll">The plate scrolls sideways. Every node is also a row in the list view.</p>' +
      '<p class="em-hint em-hint--note">' + esc(D.meta.note) + "</p>";
    root.appendChild(plate);

    var scroller = plate.querySelector(".em-plate__scroll");
    var plateSvg = drawPlate(state, select);
    scroller.appendChild(plateSvg);

    /* Focus reads the engagement too. The listener sits on the plate and uses
       focusin, because a focus event on an SVG group does not reach a handler
       bound to the group itself in every engine. */
    plateSvg.addEventListener("focusin", function (ev) {
      var g = ev.target;
      while (g && g !== plateSvg && !(g.classList && g.classList.contains("em-node"))) g = g.parentNode;
      if (g && g.classList && g.classList.contains("em-node")) select(g.getAttribute("data-id"));
    });

    /* --------------------------------------------------------------- key */
    var key = drawKey();
    root.appendChild(key);

    /* ------------------------------------------------------------- panel */
    var panel = document.createElement("div");
    panel.className = "em-panel";
    panel.setAttribute("aria-live", "polite");
    panel.innerHTML = '<p class="em-panel__hint">Select any engagement, on the plate or in the list below, to read it in full: what they told us, what we were doing before, and what changed after. Nodes on the plate are buttons, so the left and right arrow keys step along the axis and Escape closes a reading.</p>';
    root.appendChild(panel);

    /* --------------------------------------------------------- list view */
    var listview = drawList(select);
    root.appendChild(listview);

    /* ------------------------------------------------------------- state */

    function setView(v) {
      state.view = v;
      plate.hidden = v !== "map";
      key.hidden = v !== "map";
      listview.hidden = v !== "list";
      viewBtn.textContent = v === "map" ? "List view" : "Map view";
      viewBtn.setAttribute("aria-pressed", v === "list" ? "true" : "false");
    }
    viewBtn.addEventListener("click", function () { setView(state.view === "map" ? "list" : "map"); });
    setView(state.view);

    function apply() {
      var on = state.lanes;
      /* lane groups */
      plateSvg.querySelectorAll("[data-lane]").forEach(function (g) {
        g.classList.toggle("is-dim", !!on && on.indexOf(g.getAttribute("data-lane")) < 0);
      });
      /* nodes */
      plateSvg.querySelectorAll(".em-node").forEach(function (g) {
        var id = g.getAttribute("data-id");
        var e = byId(engagements, id);
        var dimLane = !!on && e.lanes.length > 0 && !e.lanes.some(function (l) { return on.indexOf(l) >= 0; });
        var dimLoop = state.loopsOnly && !inLoop(id);
        g.classList.toggle("is-dim", dimLane || dimLoop);
      });
      /* builds */
      plateSvg.querySelectorAll(".em-build").forEach(function (g) {
        var dimLane = !!on && on.indexOf(g.getAttribute("data-buildlane")) < 0;
        g.classList.toggle("is-dim", dimLane || state.loopsOnly);
      });
      /* arcs */
      function offLane(g) {
        if (!on) return false;
        var ls = (g.getAttribute("data-lanes") || "").split(" ");
        return !ls.some(function (l) { return on.indexOf(l) >= 0; });
      }
      plateSvg.querySelectorAll(".em-chain").forEach(function (g) {
        g.classList.toggle("is-dim", !state.chains || state.loopsOnly || offLane(g));
      });
      plateSvg.querySelectorAll(".em-loop").forEach(function (g) {
        g.classList.toggle("is-dim", offLane(g));
      });
      /* list rows follow the same filter */
      listview.querySelectorAll("[data-listid]").forEach(function (li) {
        var id = li.getAttribute("data-listid");
        var e = byId(engagements, id);
        var hide = false;
        if (e) {
          if (on && e.lanes.length > 0 && !e.lanes.some(function (l) { return on.indexOf(l) >= 0; })) hide = true;
          if (state.loopsOnly && !inLoop(id)) hide = true;
        } else {
          var b = byId(builds, id);
          if (b && on && on.indexOf(b.lane) < 0) hide = true;
          if (b && state.loopsOnly) hide = true;
        }
        li.hidden = hide;
      });
    }

    function select(id, opts) {
      var e = byId(engagements, id);
      if (!e) return;
      state.sel = id;
      plateSvg.querySelectorAll(".em-node").forEach(function (g) {
        g.classList.toggle("is-sel", g.getAttribute("data-id") === id);
      });
      panel.innerHTML = panelHtml(e);
      var close = panel.querySelector(".em-panel__close");
      if (close) close.addEventListener("click", function () { clear(); });
      panel.querySelectorAll("[data-goto]").forEach(function (a) {
        a.addEventListener("click", function (ev) {
          ev.preventDefault();
          select(a.getAttribute("data-goto"), { focus: true });
        });
      });
      if (opts && opts.scroll) {
        panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    function clear() {
      state.sel = null;
      plateSvg.querySelectorAll(".em-node").forEach(function (g) { g.classList.remove("is-sel"); });
      panel.innerHTML = '<p class="em-panel__hint">Select any engagement, on the plate or in the list below, to read it in full.</p>';
    }

    root.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && state.sel) { clear(); return; }
      if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
      var focused = document.activeElement;
      if (!focused || !focused.classList || !focused.classList.contains("em-node")) return;
      ev.preventDefault();
      var nodes = Array.prototype.slice.call(plateSvg.querySelectorAll(".em-node"));
      var i = nodes.indexOf(focused);
      var j = ev.key === "ArrowRight" ? i + 1 : i - 1;
      if (j < 0 || j >= nodes.length) return;
      nodes[j].focus();
      select(nodes[j].getAttribute("data-id"));
    });

    apply();
  }

  /* ============================================================== PLATE === */

  function drawPlate(state, select) {
    var P = positions();
    var Wd = P.width;

    /* loop rows */
    /* One span per person, first visit to last. Shorter spans sit lower, so a
       thread that lies inside a longer one nests under it instead of crossing
       it; a span's row is one above the highest row it overlaps. */
    var loopSpans = D.loops.map(function (lp) {
      var xs = lp.visits.map(function (v) { return P.x[v]; });
      return { loop: lp, xs: xs, x1: xs[0], x2: xs[xs.length - 1] };
    });
    loopSpans.slice().sort(function (a, b) { return (a.x2 - a.x1) - (b.x2 - b.x1); })
      .forEach(function (sp, i, arr) {
        var row = 0;
        for (var j = 0; j < i; j++) {
          var o = arr[j];
          if (o.x1 < sp.x2 + 60 && sp.x1 < o.x2 + 60) row = Math.max(row, o.row + 1);
        }
        sp.row = row;
      });
    var loopRows = loopSpans.reduce(function (n, sp) { return Math.max(n, sp.row + 1); }, 0);
    var loopH = loopRows * LOOP_ROW + 26;

    /* chain rows */
    /* Chains nest the same way, and a chain's extent includes its label, so
       two short hooks side by side do not stack their words on each other. */
    var chainSpans = [];
    D.chains.forEach(function (c) {
      var sx = P.x[c.from.id], tx = P.x[c.to.id];
      if (sx == null || tx == null) return;
      var mid = (sx + tx) / 2, lw = c.label.length * 5.6 + 8;
      chainSpans.push({
        chain: c, sx: sx, tx: tx, mid: mid,
        x1: Math.min(sx, tx, mid - lw / 2), x2: Math.max(sx, tx, mid + lw / 2),
        len: Math.abs(tx - sx)
      });
    });
    chainSpans.slice().sort(function (a, b) { return a.len - b.len; })
      .forEach(function (sp, i, arr) {
        var row = 0;
        for (var j = 0; j < i; j++) {
          var o = arr[j];
          if (o.x1 < sp.x2 + 6 && sp.x1 < o.x2 + 6) row = Math.max(row, o.row + 1);
        }
        sp.row = row;
      });
    var chainRows = chainSpans.reduce(function (n, sp) { return Math.max(n, sp.row + 1); }, 0);
    function chainRise(r) { return 24 + r * CHAIN_ROW; }
    var chainH = chainRise(chainRows - 1) * 0.75 + 34;

    var LANES_TOP = AXIS_H + loopH + NODE_STRIP;
    var LANES_BOT = LANES_TOP + lanes.length * LANE_H;
    var H = LANES_BOT + chainH;

    function laneY(id) { return LANES_TOP + laneIndex[id] * LANE_H + LANE_BASE; }

    var s = svg("svg", {
      "class": "em-svg",
      viewBox: "0 0 " + Math.round(Wd) + " " + Math.round(H),
      preserveAspectRatio: "xMinYMin meet"
    });
    s.appendChild(svg("title", null, D.meta.title));
    s.appendChild(svg("desc", null,
      "A time axis from March to September 2026 with one state line for each of six project areas. " +
      "Each engagement is drawn as a vertical stitch with a decision mark on every area it changed. " +
      "Arcs above the lanes join repeat visits by the same person; dashed amber arcs below join a meeting to what it sent us to."));

    /* ---------------------------------------------------------- the axis */
    var gAxis = svg("g", { "class": "em-axis" });
    gAxis.appendChild(svg("line", { "class": "em-axis-rule", x1: PAD_L - 12, y1: AXIS_H - 10, x2: Wd - 8, y2: AXIS_H - 10 }));
    ["2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01"].forEach(function (iso, i) {
      var x = P.raw(iso);
      if (x < PAD_L - 14) x = PAD_L - 14;
      gAxis.appendChild(svg("line", { "class": "em-axis-tick", x1: x, y1: AXIS_H - 10, x2: x, y2: AXIS_H - 3 }));
      gAxis.appendChild(svg("text", { "class": "em-axis-label", x: x + 5, y: AXIS_H - 16 },
        MON[i + 2].toUpperCase() + (i === 0 ? " 2026" : "")));
      gAxis.appendChild(svg("line", {
        "class": "em-axis-rule", x1: x, y1: AXIS_H - 3, x2: x, y2: LANES_BOT - 4, opacity: ".5"
      }));
    });
    s.appendChild(gAxis);

    /* --------------------------------------------------------- the lanes */
    var labelRows = {};
    lanes.forEach(function (l) {
      var y = laneY(l.id);
      var g = svg("g", { "class": "em-lane", "data-lane": l.id });

      /* separator at the top of the lane band */
      g.appendChild(svg("line", {
        "class": "em-lane-rule",
        x1: 8, y1: LANES_TOP + laneIndex[l.id] * LANE_H, x2: Wd - 8, y2: LANES_TOP + laneIndex[l.id] * LANE_H
      }));
      /* the track itself */
      g.appendChild(svg("line", { "class": "em-lane-base", x1: PAD_L - 12, y1: y, x2: Wd - 8, y2: y }));

      /* gutter name, one line per segment of the gutter string */
      l.gutter.split(" / ").forEach(function (line, i, arr) {
        g.appendChild(svg("text", {
          "class": "em-lane-name", x: 8, y: y - 4 - (arr.length - 1 - i) * 13
        }, line));
      });

      /* state segments */
      var states = D.laneStates.filter(function (st) { return st.lane === l.id; });
      states.forEach(function (st, i) {
        var xs = st.by && P.x[st.by] != null ? P.x[st.by] : P.raw(st.from);
        var next = states[i + 1];
        var xe = next ? (next.by && P.x[next.by] != null ? P.x[next.by] : P.raw(next.from)) : Wd - 10;
        if (i === 0) xs = PAD_L - 12;

        g.appendChild(svg("line", {
          "class": "em-state-line" + (i === 0 ? " em-state-line--first" : ""),
          x1: xs, y1: y, x2: xe, y2: y
        }));
        if (i > 0) g.appendChild(svg("line", { "class": "em-state-notch", x1: xs, y1: y - 9, x2: xs, y2: y + 9 }));

        /* stagger the label when it would sit on top of the one before */
        var prev = labelRows[l.id];
        var tw = st.label.length * 5.7;
        var lx = xs + 5, anchor = "start";
        if (lx + tw > Wd - 8) { lx = Wd - 8; anchor = "end"; }
        var left = anchor === "end" ? lx - tw : lx;
        var row = (prev != null && left < prev.right + 8 && prev.row === 0) ? 1 : 0;
        labelRows[l.id] = { right: left + tw, row: row };
        g.appendChild(svg("text", {
          "class": "em-state-label" + (i === states.length - 1 ? " em-state-label--last" : ""),
          x: lx, y: y - 12 - row * 15, "text-anchor": anchor
        }, st.label));
      });

      s.appendChild(g);
    });

    /* --------------------------------------------------------- the marks */
    var gBuilds = svg("g", { "class": "em-builds" });
    var buildRows = {};
    builds.forEach(function (b) {
      var x = P.x[b.id], y = laneY(b.lane);
      var g = svg("g", { "class": "em-build", "data-buildlane": b.lane });
      g.appendChild(svg("path", {
        "class": "em-build-mark" + (b.approx ? " em-build-mark--approx" : ""),
        d: "M " + x + " " + (y + 12) + " l 5.5 5.5 l -5.5 5.5 l -5.5 -5.5 Z"
      }));
      var bw = b.label.length * 5.5;
      var right = x + 9 + bw > Wd - 8;
      var lx = right ? x - 9 : x + 9;
      var left = right ? lx - bw : lx;
      var prev = buildRows[b.lane];
      var brow = (prev != null && left < prev.right + 8 && prev.row === 0) ? 1 : 0;
      buildRows[b.lane] = { right: left + bw, row: brow };
      g.appendChild(svg("text", {
        "class": "em-build-label", x: lx, y: y + 21 + brow * 13,
        "text-anchor": right ? "end" : "start"
      }, b.label));
      g.appendChild(svg("title", null, "We built: " + b.label + (b.approx ? " (date not recorded)" : ", " + fmt(b.date))));
      gBuilds.appendChild(g);
    });
    s.appendChild(gBuilds);

    /* ---------------------------------------------------------- the arcs */
    var gLoops = svg("g", { "class": "em-loops" });
    loopSpans.forEach(function (sp) {
      var top = LANES_TOP - NODE_STRIP - 1;
      /* the control height for this row; a cubic with both handles at rowY
         peaks three quarters of the way there */
      var rise = 34 + sp.row * LOOP_ROW * 1.34;
      var rowY = top - rise;
      var apex = top - rise * 0.75;
      var loopLanes = [];
      sp.loop.visits.forEach(function (vid) {
        byId(engagements, vid).lanes.forEach(function (l) {
          if (loopLanes.indexOf(l) < 0) loopLanes.push(l);
        });
      });
      var g = svg("g", {
        "class": "em-loop", tabindex: "0", role: "button", "data-first": sp.loop.visits[0],
        "data-lanes": loopLanes.join(" "),
        "aria-label": "Return thread: " + sp.loop.person + ", " + sp.loop.count + " visits. " + sp.loop.headline
      });
      var longest = 0, lx1 = sp.x1, lx2 = sp.x2;
      for (var i = 0; i + 1 < sp.xs.length; i++) {
        var a = sp.xs[i], b = sp.xs[i + 1];
        g.appendChild(svg("path", {
          "class": "em-loop-arc",
          d: "M " + a + " " + top + " C " + a + " " + rowY + ", " + b + " " + rowY + ", " + b + " " + top
        }));
        if (b - a > longest) { longest = b - a; lx1 = a; lx2 = b; }
      }
      var mid = (lx1 + lx2) / 2;
      var label = sp.loop.person + (sp.loop.zh ? " " + sp.loop.zh : "");
      var tw = label.length * 6.4 + 34;
      g.appendChild(svg("rect", {
        "class": "em-loop-chip", x: mid - tw / 2, y: apex - 8, width: tw, height: 16
      }));
      g.appendChild(svg("text", {
        "class": "em-loop-count", x: mid - tw / 2 + 7, y: apex + 3.5
      }, "×" + sp.loop.count));
      g.appendChild(svg("text", {
        "class": "em-loop-label", x: mid - tw / 2 + 27, y: apex + 3.5
      }, label));
      g.appendChild(svg("title", null, sp.loop.person + ", " + sp.loop.count + " visits. " + sp.loop.headline));
      function go() { select(sp.loop.visits[0], { scroll: true }); }
      g.addEventListener("click", go);
      g.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); }
      });
      gLoops.appendChild(g);
    });
    s.appendChild(gLoops);

    var gChains = svg("g", { "class": "em-chains" });
    chainSpans.forEach(function (sp) {
      var top = LANES_BOT - 4;
      var rise = chainRise(sp.row);
      var rowY = top + rise;
      var apex = top + rise * 0.75;
      var cl = [];
      [sp.chain.from, sp.chain.to].forEach(function (ref) {
        var o = ref.type === "build" ? byId(builds, ref.id) : byId(engagements, ref.id);
        if (!o) return;
        (o.lanes || [o.lane]).forEach(function (l) { if (cl.indexOf(l) < 0) cl.push(l); });
      });
      var g = svg("g", { "class": "em-chain", "data-lanes": cl.join(" ") });
      g.appendChild(svg("path", {
        "class": "em-chain-arc",
        d: "M " + sp.sx + " " + top + " C " + sp.sx + " " + rowY + ", " + sp.tx + " " + rowY + ", " + sp.tx + " " + top
      }));
      g.appendChild(svg("path", {
        "class": "em-chain-head",
        d: "M " + (sp.tx - 3.5) + " " + (top + 8) + " L " + sp.tx + " " + top + " L " + (sp.tx + 3.5) + " " + (top + 8) + " Z"
      }));
      g.appendChild(svg("text", {
        "class": "em-chain-label", x: sp.mid, y: apex + 12, "text-anchor": "middle"
      }, sp.chain.label));
      g.appendChild(svg("title", null, sp.chain.label + ". " + sp.chain.note));
      gChains.appendChild(g);
    });
    s.appendChild(gChains);

    /* --------------------------------------------------------- the nodes */
    engagements.forEach(function (e, i) {
      var x = P.x[e.id];
      var ys = e.lanes.map(laneY);
      var top = LANES_TOP - 13;
      var yTop = ys.length ? Math.min.apply(null, ys) : LANES_TOP + 6;
      var yBot = ys.length ? Math.max.apply(null, ys) : LANES_TOP + 6;

      var g = svg("g", {
        "class": "em-node" + (e.pending ? " em-node--pending" : ""),
        "data-id": e.id,
        tabindex: "0",
        role: "button",
        "aria-label": fmt(e.date) + ". " + e.name + (e.zh ? " " + e.zh : "") + ". " +
          (e.lanes.length ? "Changed " + e.lanes.map(function (l) { return lanes[laneIndex[l]].name; }).join(", ") + "." : "Write-up owed.")
      });

      g.appendChild(svg("rect", {
        "class": "em-node__hit", x: x - 12, y: top - 12, width: 24, height: (yBot + 12) - (top - 12)
      }));
      g.appendChild(svg("line", { "class": "em-stitch", x1: x, y1: top + 5, x2: x, y2: yBot }));

      /* the head: a small open box on the node strip, the index inside */
      g.appendChild(svg("rect", { "class": "em-head", x: x - 8, y: top - 6, width: 16, height: 12 }));
      g.appendChild(svg("text", {
        "class": "em-head-no", x: x, y: top + 3, "text-anchor": "middle"
      }, (i + 1) < 10 ? "0" + (i + 1) : String(i + 1)));

      if (e.recurring) {
        /* a standing thread: the head is doubled, per the key */
        g.appendChild(svg("rect", { "class": "em-head", x: x - 11, y: top - 9, width: 22, height: 18 }));
      }

      ys.forEach(function (y) {
        g.appendChild(svg("rect", { "class": "em-mark", x: x - 4.5, y: y - 4.5, width: 9, height: 9 }));
      });
      if (!ys.length) {
        g.appendChild(svg("rect", { "class": "em-mark", x: x - 4.5, y: LANES_TOP + 2, width: 9, height: 9 }));
      }
      g.appendChild(svg("rect", {
        "class": "em-node__ring", x: x - 12, y: top - 12, width: 24, height: (yBot + 12) - (top - 12)
      }));

      /* hover and focus flag */
      var flag = svg("g", { "class": "em-node__flag" });
      var text = fmtShort(e.date) + "  " + e.name + (e.zh ? " " + e.zh : "");
      var fw = text.length * 6.4 + 16;
      var right = x + fw + 14 > P.width;
      var fx = right ? x - 10 - fw : x + 10;
      flag.appendChild(svg("rect", { x: fx, y: top - 30, width: fw, height: 19 }));
      flag.appendChild(svg("text", { x: fx + 8, y: top - 16 }, text));
      g.appendChild(flag);

      g.addEventListener("click", function () { select(e.id); });
      g.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          select(e.id, { scroll: true });
        }
      });
      s.appendChild(g);
    });

    return s;
  }

  /* ================================================================ KEY === */

  function keySwatch(kind) {
    var w = 44, h = 18, m = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">';
    var bg = '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="#0c231a"/>';
    if (kind === "state") {
      m += bg + '<line x1="2" y1="9" x2="42" y2="9" stroke="#4f9c6f" stroke-width="2"/>' +
        '<line x1="22" y1="2" x2="22" y2="16" stroke="#4f9c6f" stroke-width="1"/>';
    } else if (kind === "start") {
      m += bg + '<line x1="2" y1="9" x2="42" y2="9" stroke="#8fae9d" stroke-width="2" stroke-dasharray="5 4"/>';
    } else if (kind === "mark") {
      m += bg + '<line x1="22" y1="1" x2="22" y2="17" stroke="#8fae9d" stroke-width="1"/>' +
        '<rect x="17.5" y="4.5" width="9" height="9" fill="#dfe9e2"/>';
    } else if (kind === "build") {
      m += bg + '<path d="M 22 3 l 5.5 5.5 l -5.5 5.5 l -5.5 -5.5 Z" fill="none" stroke="#8fae9d"/>';
    } else if (kind === "pending") {
      m += bg + '<rect x="17.5" y="4.5" width="9" height="9" fill="none" stroke="#d8734c" stroke-width="1.5"/>';
    } else if (kind === "standing") {
      m += bg + '<rect x="14" y="3" width="16" height="12" fill="none" stroke="#8fae9d"/>' +
        '<rect x="11" y="0" width="22" height="18" fill="none" stroke="#8fae9d"/>';
    } else if (kind === "loop") {
      m += bg + '<path d="M 4 16 C 4 0, 40 0, 40 16" fill="none" stroke="#4f9c6f" stroke-width="1.2"/>';
    } else if (kind === "chain") {
      m += bg + '<path d="M 4 2 C 4 17, 40 17, 40 3" fill="none" stroke="#d6b078" stroke-width="1.1" stroke-dasharray="6 4"/>' +
        '<path d="M 36.5 8 L 40 1 L 43 8 Z" fill="#d6b078"/>';
    }
    return m + "</svg>";
  }

  function drawKey() {
    var k = document.createElement("div");
    k.className = "em-key";

    var c1 = "<h4>Lines and marks</h4><ul>" +
      '<li>' + keySwatch("start") + "<span>The state we started with, before any outside advice.</span></li>" +
      '<li>' + keySwatch("state") + "<span>An area's state line, and the notch where its label changes.</span></li>" +
      '<li>' + keySwatch("mark") + "<span>A decision: one mark per area an engagement changed, stitched vertically.</span></li>" +
      '<li>' + keySwatch("build") + "<span>What we built between visits. Dashed where our sources do not date it.</span></li>" +
      '<li>' + keySwatch("pending") + "<span>Logged, write-up owed. Nothing is filled in for it.</span></li>" +
      '<li>' + keySwatch("standing") + "<span>A standing advisory thread, shown at its one dated entry.</span></li>" +
      "</ul>";

    var c2 = "<h4>Threads and crossings</h4><ul>" +
      '<li>' + keySwatch("loop") + "<span>Green, above the lanes: the same person came back. The chip carries the visit count.</span></li>" +
      '<li>' + keySwatch("chain") + "<span>Amber, below the lanes: a crossing. One engagement sent us to the next farm, speaker, build or experiment.</span></li>" +
      "</ul><p style=\"margin:.6rem 0 0;font-size:var(--text-xs,.8125rem);line-height:1.5;color:var(--em-graphite);max-width:44ch\">Green means a thread stays with one person or one area. Amber means it crosses. Amber is used for nothing else on this plate.</p>";

    var c3 = '<h4>Where the six areas travelled</h4>' +
      '<p style="margin:0 0 .6rem;font-size:var(--text-sm,.9375rem);line-height:1.55"><b style="color:var(--em-graphite);font:var(--em-fld);letter-spacing:var(--em-lsp);text-transform:uppercase;display:block;margin-bottom:.2rem">Started with</b>' +
      esc(D.meta.startState) + "</p>" +
      '<p style="margin:0;font-size:var(--text-sm,.9375rem);line-height:1.55"><b style="color:var(--em-leaf-700);font:var(--em-fld);letter-spacing:var(--em-lsp);text-transform:uppercase;display:block;margin-bottom:.2rem">Ended with</b>' +
      esc(D.meta.endState) + "</p>";

    k.innerHTML = "<div>" + c1 + "</div><div>" + c2 + "</div><div>" + c3 + "</div>";
    return k;
  }

  /* ============================================================== PANEL === */

  function areaChips(ids) {
    if (!ids.length) return "";
    return '<ul class="em-areas">' + ids.map(function (id) {
      return "<li>" + esc(lanes[laneIndex[id]].name) + "</li>";
    }).join("") + "</ul>";
  }

  function comparison(e) {
    return (loopsOf[e.id] || []).map(function (rec) {
      return comparisonOne(e, rec.loop);
    }).join("");
  }

  function comparisonOne(e, lp) {
    var cells = lp.visits.map(function (vid, i) {
      var v = byId(engagements, vid);
      var said = v.quote ? "“" + v.quote + "”" : (v.suggestion || firstSentence(v.summary));
      return '<div' + (vid === e.id ? "" : "") + '><h6>Visit ' + (i + 1) + " · " + esc(fmtShort(v.date)) + "</h6>" +
        "<p>" + (vid === e.id ? "<b>You are reading this visit.</b> " : "") + esc(said) + "</p>" +
        (vid === e.id ? "" : '<p style="margin:0"><a href="#" data-goto="' + esc(vid) + '">Read this visit</a></p>') +
        "</div>";
    }).join("");

    var mid = lp.between.map(function (m) { return m.label; });
    (lp.buildIds || []).forEach(function (id) {
      var b = byId(builds, id);
      if (b) mid.push(b.label + ", " + fmtShort(b.date));
    });

    return '<div class="em-cmp"><h5 style="margin-top:var(--sp-4,1rem)">Return thread · ' +
      esc(lp.person) + (lp.zh ? " " + esc(lp.zh) : "") + " ×" + lp.count + "</h5>" +
      '<p class="em-cmp__depth" style="padding-top:0;margin-bottom:var(--sp-4,1rem)"><b>' + esc(lp.headline) + "</b></p>" +
      '<div class="em-cmp__grid" style="grid-template-columns:repeat(' + lp.visits.length + ',minmax(0,1fr))">' +
      cells + "</div>" +
      '<div class="em-cmp__mid"><div class="is-mid"><h6>What we built in between</h6><ul>' +
      mid.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") +
      "</ul></div></div>" +
      '<p class="em-cmp__depth">' + esc(lp.depth) + "</p></div>";
  }

  function panelHtml(e) {
    var i = engagements.indexOf(e);
    var stamps = "";
    (loopsOf[e.id] || []).forEach(function (rec) {
      stamps += '<span class="em-stamp em-stamp--loop">Visit ' + (rec.index + 1) + " of " +
        rec.loop.count + " with " + esc(rec.loop.person) + "</span> ";
    });
    if (e.recurring) stamps += '<span class="em-stamp em-stamp--loop">Standing thread</span> ';
    if (e.pending) stamps += '<span class="em-stamp em-stamp--open">Write-up owed</span> ';

    var led = (chainsFrom[e.id] || []).map(function (c) {
      var t = c.to.type === "build" ? byId(builds, c.to.id) : byId(engagements, c.to.id);
      var name = t ? (t.label || t.name) : c.to.id;
      var link = c.to.type === "engagement" ? ' <a href="#" data-goto="' + esc(c.to.id) + '">read it</a>' : "";
      return "<li><b>" + esc(name) + "</b>. " + esc(c.note) + link + "</li>";
    }).join("");
    var came = (chainsTo[e.id] || []).map(function (c) {
      var f = byId(engagements, c.from.id);
      return "<li><b>" + esc(f ? f.name : c.from.id) + "</b>. " + esc(c.note) +
        ' <a href="#" data-goto="' + esc(c.from.id) + '">read it</a></li>';
    }).join("");

    var main = "";
    if (e.summary) main += '<p class="em-summary">' + esc(e.summary) + "</p>";
    if (e.quote) main += '<blockquote class="em-quote em-quote--said">“' + esc(e.quote) + "”</blockquote>";
    else if (e.suggestion) main += "<h5>What they told us</h5><p class=\"em-quote\">" + esc(e.suggestion) + "</p>";
    if (e.quote && e.suggestion) main += "<h5>What we took from it</h5><p class=\"em-quote\">" + esc(e.suggestion) + "</p>";

    if (e.takeaways && e.takeaways.length) {
      main += "<h5>Key feedback</h5><ul class=\"em-list\">" +
        e.takeaways.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
    }
    if ((e.before && e.before.length) || (e.after && e.after.length)) {
      main += "<h5>Before this, and after it</h5><div class=\"em-ba\">" +
        "<div><h6>What we were doing</h6>" +
        (e.before && e.before.length
          ? "<ul>" + e.before.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>"
          : "<p>The log records no previous position for this engagement.</p>") + "</div>" +
        "<div class=\"em-ba--after\"><h6>What we changed</h6>" +
        (e.after && e.after.length
          ? "<ul>" + e.after.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>"
          : "<p>The log's action field for this entry is blank.</p>") + "</div></div>";
    }
    if (led) main += "<h5>What this led to</h5><ul class=\"em-list\">" + led + "</ul>";
    if (came) main += "<h5>Who sent us here</h5><ul class=\"em-list\">" + came + "</ul>";
    main += comparison(e);

    var side = "";
    (e.photos || []).forEach(function (p) {
      side += '<figure class="em-fig"><img src="../assets/img/human-practices/' + esc(p.src) +
        '" alt="' + esc(p.alt) + '" loading="lazy" decoding="async">' +
        "<figcaption>" + esc(p.alt) +
        '<span class="em-prov">' + esc(p.prov || "Resized for the web. No other adjustment.") + "</span></figcaption></figure>";
    });
    if (e.links && e.links.length) {
      side += "<div><h5>Where this shows up</h5><ul class=\"em-links\">" +
        e.links.map(function (l) { return '<li><a href="' + esc(l.href) + '">' + esc(l.label) + "</a></li>"; }).join("") +
        "</ul></div>";
    }
    side += '<p class="em-src"><b>Source:</b> ' + esc(e.source) + "</p>";
    if (e.dateNote) side += '<p class="em-src"><b>On the date:</b> ' + esc(e.dateNote) + "</p>";

    return '<div class="em-panel__top">' +
      '<span class="em-panel__date">' + esc(fmt(e.date)) + " · Engagement " +
      (i + 1 < 10 ? "0" + (i + 1) : (i + 1)) + " of " + engagements.length + "</span>" +
      '<button type="button" class="em-panel__close">Close</button></div>' +
      "<h4>" + esc(e.name) + (e.zh ? " <i>" + esc(e.zh) + "</i>" : "") + "</h4>" +
      '<p class="em-panel__role">' + esc(e.role) + (e.where ? ". " + esc(e.where) + "." : "") + "</p>" +
      (stamps ? "<p style=\"margin:0 0 var(--sp-4,1rem)\">" + stamps + "</p>" : "") +
      areaChips(e.lanes) +
      '<div class="em-body"><div>' + (main || "<p class=\"em-panel__hint\">The log lists this engagement and nothing else. The write-up is owed and nothing has been filled in for it.</p>") +
      '</div><div class="em-side">' + side + "</div></div>";
  }

  /* ============================================================== LIST ==== */

  function drawList(select) {
    var wrap = document.createElement("div");
    wrap.className = "em-listview";

    var items = engagements.map(function (e) { return { t: day(e.date), kind: "e", o: e }; })
      .concat(builds.map(function (b) { return { t: day(b.date), kind: "b", o: b }; }))
      .sort(function (a, b) { return a.t - b.t || (a.kind === "e" ? -1 : 1); });

    var html = "", month = "", openList = false;
    items.forEach(function (it) {
      var d = new Date(it.t);
      var m = MON[d.getMonth()] + " " + d.getFullYear();
      if (m !== month) {
        if (openList) html += "</ol>";
        html += '<h3 data-no-toc="true">' + esc(m) + "</h3><ol>";
        month = m; openList = true;
      }
      if (it.kind === "b") {
        var b = it.o;
        html += '<li data-listid="' + esc(b.id) + '"><div class="em-lrow">' +
          '<span class="em-lrow__date">' + esc(b.approx ? "Date not recorded" : fmtShort(b.date)) + "</span><div>" +
          "<h4>We built: " + esc(b.label) + "</h4>" +
          "<p>" + esc(b.note) + "</p>" +
          '<ul class="em-areas"><li>' + esc(lanes[laneIndex[b.lane]].name) + "</li></ul>" +
          '<p class="em-lmeta">Source: ' + esc(b.source) + (b.dateNote ? " " + esc(b.dateNote) : "") + "</p>" +
          "</div></div></li>";
        return;
      }
      var e = it.o, recs = loopsOf[e.id] || [];
      var thread = recs.map(function (rec) {
        return '<p class="em-lthread"><b>Return thread, visit ' + (rec.index + 1) + " of " + rec.loop.count +
          " with " + esc(rec.loop.person) + (rec.loop.zh ? " " + esc(rec.loop.zh) : "") + ".</b> " +
          esc(rec.loop.headline) + "</p>";
      }).join("");
      if (!recs.length && e.recurring) {
        thread = '<p class="em-lthread"><b>Standing thread.</b> ' + esc(e.dateNote || "") + "</p>";
      }
      var out = (chainsFrom[e.id] || []).map(function (c) {
        var t = c.to.type === "build" ? byId(builds, c.to.id) : byId(engagements, c.to.id);
        return esc(c.label) + ": " + esc(t ? (t.label || t.name) : c.to.id);
      }).join(". ");

      html += '<li data-listid="' + esc(e.id) + '"><div class="em-lrow">' +
        '<span class="em-lrow__date">' + esc(fmtShort(e.date)) + "</span><div>" +
        "<h4>" + esc(e.name) + (e.zh ? " <i>" + esc(e.zh) + "</i>" : "") + "</h4>" +
        '<p class="em-lmeta" style="margin-bottom:.4rem">' + esc(e.role) + (e.where ? ". " + esc(e.where) + "." : "") + "</p>" +
        areaChips(e.lanes) +
        (e.pending ? '<p><span class="em-stamp em-stamp--open">Write-up owed</span></p>' : "") +
        (e.summary ? "<p>" + esc(e.summary) + "</p>" : "") +
        (e.quote ? '<p class="em-lthread">“' + esc(e.quote) + "”</p>"
          : (e.suggestion ? '<p class="em-lthread">' + esc(e.suggestion) + "</p>" : "")) +
        thread +
        (e.after && e.after.length ? "<p><b>What we changed:</b> " + esc(e.after.join(". ")) + ".</p>" : "") +
        (out ? '<p class="em-lmeta">Led to: ' + out + "</p>" : "") +
        '<p class="em-lmeta">Source: ' + esc(e.source) + "</p>" +
        "</div></div></li>";
    });
    if (openList) html += "</ol>";

    /* the two thread sections, grouped */
    html += '<h3 data-no-toc="true">Return threads</h3><ol>';
    D.loops.forEach(function (lp) {
      html += "<li><div class=\"em-lrow\"><span class=\"em-lrow__date\">×" + lp.count + "</span><div>" +
        "<h4>" + esc(lp.person) + (lp.zh ? " <i>" + esc(lp.zh) + "</i>" : "") + "</h4>" +
        "<p><b>" + esc(lp.headline) + "</b></p>" +
        "<p><b>Visits:</b> " + lp.visits.map(function (v) {
          var e = byId(engagements, v);
          return esc(fmt(e.date));
        }).join(", then ") + ".</p>" +
        "<p><b>Built in between:</b> " + lp.between.map(function (m) { return esc(m.label); }).join(". ") + ".</p>" +
        "<p>" + esc(lp.depth) + "</p>" +
        '<p class="em-lmeta">Source: ' + esc(lp.source) + "</p>" +
        "</div></div></li>";
    });
    html += "</ol>";

    html += '<h3 data-no-toc="true">Referral chains</h3><ol>';
    D.chains.forEach(function (c) {
      var f = byId(engagements, c.from.id);
      var t = c.to.type === "build" ? byId(builds, c.to.id) : byId(engagements, c.to.id);
      html += "<li><div class=\"em-lrow\"><span class=\"em-lrow__date\">" +
        esc(f ? fmtShort(f.date) : "") + "</span><div>" +
        "<h4>" + esc(f ? f.name : c.from.id) + " → " + esc(t ? (t.label || t.name) : c.to.id) + "</h4>" +
        "<p><b>" + esc(c.label) + ".</b> " + esc(c.note) + "</p>" +
        '<p class="em-lmeta">Source: ' + esc(c.source) + "</p>" +
        "</div></div></li>";
    });
    html += "</ol>";

    wrap.innerHTML = html;
    wrap.querySelectorAll("[data-listid]").forEach(function (li) {
      var id = li.getAttribute("data-listid");
      if (!byId(engagements, id)) return;
      var h = li.querySelector("h4");
      if (!h) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "em-chip";
      b.style.marginTop = ".4rem";
      b.textContent = "Read in full";
      b.addEventListener("click", function () { select(id, { scroll: true }); });
      li.querySelector(".em-lrow > div:last-child").appendChild(b);
    });
    return wrap;
  }

  /* ================================================================ BOOT == */

  function boot() {
    document.documentElement.classList.add("js");
    var hosts = document.querySelectorAll("[data-evomap]");
    for (var i = 0; i < hosts.length; i++) build(hosts[i]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}());
