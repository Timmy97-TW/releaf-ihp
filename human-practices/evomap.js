/* =============================================================================
   ReLeaf: Project Evolution Map
   -----------------------------------------------------------------------------
   Renders window.EVOMAP into [data-evomap] as a road down the page: a start
   state, twenty-five engagement cards alternating either side of a curving
   road, a decision pill on the road under each card, and the state we ended
   with. Repeat visits carry a thread ribbon and open a visit-by-visit
   comparison. Filtering by project area swaps the start and end states for
   that area's own, so each part of the project can be read on its own.

   Everything is progressive: with scripts off the section says so and the same
   engagements are described in sections 3 to 5. Nothing here reads or writes
   anything outside its own container, except the html.evo-dark class that
   fades the page into the blueprint ground while the band is on screen.
   ========================================================================== */

(function () {
  "use strict";

  var D = window.EVOMAP;
  var root = document.querySelector("[data-evomap]");
  if (!D || !root) return;

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
                "August", "September", "October", "November", "December"];
  var SHORT  = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var byLane   = index(D.lanes, "id");
  var byEng    = index(D.engagements, "id");
  var byBuild  = index(D.builds, "id");
  var loopOf   = {};          /* engagement id -> { loop, visitNo } */
  D.loops.forEach(function (lp) {
    lp.visits.forEach(function (id, i) { loopOf[id] = { loop: lp, n: i + 1 }; });
  });

  var state = { area: "all", threads: false };
  var lastFocus = null;

  /* ---- small helpers ------------------------------------------------------ */

  function index(list, key) {
    var out = {};
    list.forEach(function (o) { out[o[key]] = o; });
    return out;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    /* page.js numbers every heading it finds and lists it in the contents
       rail. The map has its own headings by the dozen; none of them belong
       in the rail, and an empty data-no-toc is falsy to page.js, so the
       value has to be there. */
    if (/^H[1-6]$/.test(n.tagName)) n.setAttribute("data-no-toc", "true");
    return n;
  }
  function date(iso) {
    var p = iso.split("-");
    return parseInt(p[2], 10) + " " + SHORT[parseInt(p[1], 10) - 1];
  }
  function longDate(iso) {
    var p = iso.split("-");
    return parseInt(p[2], 10) + " " + MONTHS[parseInt(p[1], 10) - 1] + " " + p[0];
  }
  function monthKey(iso) { return iso.slice(0, 7); }
  function monthName(key) {
    var p = key.split("-");
    return MONTHS[parseInt(p[1], 10) - 1] + " " + p[0];
  }
  function days(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }
  function gap(a, b) {
    var d = days(a, b);
    if (d < 21) return d + " days";
    var w = Math.round(d / 7);
    if (w < 14) return w + " weeks";
    return Math.round(d / 30.4) + " months";
  }

  /* What an engagement changed, in the words of the lane state it moved. */
  function decisions(e) {
    return D.laneStates.filter(function (s) { return s.by === e.id; });
  }
  function visible(e) {
    if (state.threads && !loopOf[e.id]) return false;
    if (state.area !== "all" && e.lanes.indexOf(state.area) < 0) return false;
    return true;
  }

  /* ---- the frame ---------------------------------------------------------- */

  var wrap = el("div", "evo");
  var controls, tally, planStart, planEnd, road, svg, sheet, sheetCard;

  function build() {
    /* controls */
    controls = el("div", "evo__controls");
    var filters = el("div", "evo__filters");
    filters.appendChild(el("span", "evo__flabel", "Read"));

    chip(filters, "all", "The whole project");
    D.lanes.forEach(function (l) { chip(filters, l.id, l.name, l.blurb); });

    var th = el("button", "evo__chip evo__chip--thread");
    th.type = "button";
    th.textContent = "Return visits only";
    th.setAttribute("aria-pressed", "false");
    th.title = "Show only the stakeholders who came back for a second look";
    th.addEventListener("click", function () {
      state.threads = !state.threads;
      th.setAttribute("aria-pressed", state.threads ? "true" : "false");
      apply();
    });
    filters.appendChild(th);

    tally = el("span", "evo__count");
    filters.appendChild(tally);
    controls.appendChild(filters);
    wrap.appendChild(controls);

    /* start state */
    planStart = el("div", "evo__plan evo__plan--start");
    wrap.appendChild(planStart);

    /* the road */
    road = el("div", "evo__road");
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "evo__line");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("preserveAspectRatio", "none");
    road.appendChild(svg);

    var lastMonth = null, side = 0;
    D.engagements.forEach(function (e, i) {
      var mk = monthKey(e.date);
      if (mk !== lastMonth) {
        var m = el("div", "evo__month");
        m.dataset.month = mk;
        m.appendChild(el("span", null, monthName(mk)));
        road.appendChild(m);
        lastMonth = mk;
      }
      road.appendChild(row(e, i, side % 2 === 0 ? "left" : "right"));
      side += 1;
    });

    var none = el("p", "evo__empty", "No engagement in this area. Try another.");
    none.hidden = true;
    road.appendChild(none);
    road.dataset.none = "";
    wrap.appendChild(road);

    /* end state */
    planEnd = el("div", "evo__plan evo__plan--end");
    wrap.appendChild(planEnd);

    wrap.appendChild(key());

    /* the record sheet */
    sheet = el("div", "evo__sheet");
    sheet.hidden = true;
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", "The full record of this engagement");
    sheetCard = el("div", "evo__sheetcard");
    var close = el("button", "evo__close", "✕");
    close.type = "button";
    close.setAttribute("aria-label", "Close this record");
    close.addEventListener("click", closeSheet);
    sheet.appendChild(sheetCard);
    sheetCard.appendChild(close);
    sheet.addEventListener("click", function (ev) { if (ev.target === sheet) closeSheet(); });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !sheet.hidden) closeSheet();
    });

    root.textContent = "";
    root.appendChild(wrap);
    root.appendChild(sheet);
  }

  function chip(into, id, label, title) {
    var b = el("button", "evo__chip");
    b.type = "button";
    b.textContent = label;
    if (title) b.title = title;
    b.setAttribute("aria-pressed", id === state.area ? "true" : "false");
    b.dataset.area = id;
    b.addEventListener("click", function () {
      state.area = id;
      [].forEach.call(into.querySelectorAll("[data-area]"), function (o) {
        o.setAttribute("aria-pressed", o.dataset.area === id ? "true" : "false");
      });
      apply();
    });
    into.appendChild(b);
  }

  /* ---- one engagement ----------------------------------------------------- */

  function row(e, i, sideName) {
    var r = el("div", "evo__row evo__row--" + sideName);
    r.dataset.id = e.id;
    r.dataset.lanes = e.lanes.join(" ");
    if (loopOf[e.id]) r.classList.add("evo__row--thread");
    if (e.pending) r.classList.add("evo__row--pending");

    var card = el("article", "evo__card");
    card.id = "evo-" + e.id;

    var meta = el("div", "evo__meta");
    meta.appendChild(el("span", "evo__date", date(e.date)));
    meta.appendChild(el("span", "evo__no", String(i + 1).padStart(2, "0") + " of " + D.engagements.length));
    meta.appendChild(el("span", "evo__kind", kindName(e.kind)));
    card.appendChild(meta);

    var who = el("h3", "evo__who");
    who.appendChild(document.createTextNode(e.name + " "));
    if (e.zh) { var zh = el("i", null, e.zh); who.appendChild(zh); }
    card.appendChild(who);
    if (e.role) card.appendChild(el("p", "evo__role", e.role));

    /* the return-visit ribbon, which is the point of the whole map */
    var lp = loopOf[e.id];
    if (lp && lp.n > 1) {
      var first = byEng[lp.loop.visits[0]];
      var rib = el("div", "evo__thread");
      rib.appendChild(el("b", null, "Visit " + lp.n + " of " + lp.loop.count));
      rib.appendChild(el("span", null, gap(first.date, e.date) + " after the first, and this time they had seen what we did with it."));
      var cmp = el("button", null, "Compare the visits");
      cmp.type = "button";
      cmp.addEventListener("click", function () { openSheet(e.id, true); });
      rib.appendChild(cmp);
      card.appendChild(rib);
    } else if (lp) {
      var rib2 = el("div", "evo__thread");
      rib2.appendChild(el("b", null, "Visit 1 of " + lp.loop.count));
      rib2.appendChild(el("span", null, "They came back. " + lp.loop.headline));
      card.appendChild(rib2);
    }

    var areas = el("ul", "evo__areas");
    e.lanes.forEach(function (id) {
      if (byLane[id]) areas.appendChild(el("li", null, byLane[id].name));
    });
    card.appendChild(areas);

    if (e.suggestion || e.quote) {
      var said = el("div", "evo__said");
      said.appendChild(el("b", null, e.quote ? "In their words" : "What they told us"));
      said.appendChild(document.createTextNode(e.quote ? "“" + e.quote + "”" : e.suggestion));
      card.appendChild(said);
    } else if (e.pending) {
      var pend = el("div", "evo__said");
      pend.appendChild(el("b", null, "Write-up owed"));
      pend.appendChild(document.createTextNode("The record for this one is not written yet. It is on the map because it happened, not because we can report it."));
      card.appendChild(pend);
    }

    if (e.takeaways && e.takeaways.length) {
      var ul = el("ul", "evo__points");
      e.takeaways.slice(0, 2).forEach(function (t) { ul.appendChild(el("li", null, t)); });
      card.appendChild(ul);
    }

    /* what we built between this visit and the one before it */
    if (lp && lp.n > 1) {
      var built = builtBetween(lp.loop, lp.n);
      if (built.length) {
        var bx = el("div", "evo__built");
        bx.appendChild(el("b", null, "What we built in between"));
        var bl = el("ul");
        built.forEach(function (t) { bl.appendChild(el("li", null, t)); });
        bx.appendChild(bl);
        card.appendChild(bx);
      }
    }

    var foot = el("div", "evo__foot");
    var more = el("button", "evo__more", "Read the full record");
    more.type = "button";
    more.addEventListener("click", function () { openSheet(e.id, false); });
    foot.appendChild(more);
    card.appendChild(foot);
    r.appendChild(card);

    /* the decision that followed, drawn on the road */
    var ds = decisions(e);
    var chain = D.chains.filter(function (c) { return c.from.type === "engagement" && c.from.id === e.id; });
    var text = null, label = null;
    if (ds.length) {
      label = ds.length > 1 ? ds.length + " areas changed" : byLane[ds[0].lane].name + " changed";
      text = ds.map(function (s) { return s.label; }).join(" · ");
    } else if (chain.length) {
      var target = chain[0].to.type === "build" ? byBuild[chain[0].to.id] : byEng[chain[0].to.id];
      label = "What followed";
      text = target ? (target.label || target.name) : chain[0].label;
    } else if (e.after && e.after.length) {
      label = "What we did next";
      text = e.after[0];
    }
    if (text) {
      var pill = el("button", "evo__pill");
      pill.type = "button";
      pill.appendChild(el("b", null, label));
      pill.appendChild(el("span", null, text));
      pill.addEventListener("click", function () { openSheet(e.id, false); });
      r.appendChild(pill);
    }
    return r;
  }

  function kindName(kind) {
    if (kind === "expert") return "Expert";
    if (kind === "company") return "Industry";
    if (kind === "farmer") return "Farmer";
    if (kind === "event") return "Event";
    if (kind === "exhibition") return "Exhibition";
    return kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : "Engagement";
  }

  function builtBetween(lp, n) {
    var prev = byEng[lp.visits[n - 2]], here = byEng[lp.visits[n - 1]];
    var out = [];
    (lp.buildIds || []).forEach(function (id) {
      var b = byBuild[id];
      if (b && b.date > prev.date && b.date <= here.date) out.push(b.label);
    });
    (lp.between || []).forEach(function (b) { if (out.indexOf(b.label) < 0) out.push(b.label); });
    return out.slice(0, 3);
  }

  /* ---- the record sheet --------------------------------------------------- */

  function openSheet(id, comparison) {
    var e = byEng[id];
    if (!e) return;
    lastFocus = document.activeElement;
    var lp = loopOf[id];

    /* clear everything except the close button */
    [].slice.call(sheetCard.children).forEach(function (c) {
      if (!c.classList.contains("evo__close")) sheetCard.removeChild(c);
    });

    var head = el("p", "evo__sheetmeta");
    head.appendChild(el("b", null, longDate(e.date)));
    head.appendChild(document.createTextNode(
      "  ·  " + kindName(e.kind) + (e.where ? "  ·  " + e.where : "")));
    sheetCard.appendChild(head);
    sheetCard.appendChild(el("h3", null, e.name + (e.zh ? " " + e.zh : "")));
    if (e.role) sheetCard.appendChild(el("p", "evo__sheetmeta", e.role));
    if (e.dateNote) sheetCard.appendChild(el("p", "evo__sheetmeta", e.dateNote));

    if (lp) sheetCard.appendChild(visits(lp.loop, e));
    if (lp && lp.loop.depth) {
      var deep = el("div", "evo__deep");
      deep.appendChild(el("b", null, "What went deeper. "));
      deep.appendChild(document.createTextNode(lp.loop.depth));
      sheetCard.appendChild(deep);
    }

    if (e.summary) {
      sheetCard.appendChild(el("h4", null, "The meeting"));
      sheetCard.appendChild(el("p", null, e.summary));
    }
    if (e.quote) {
      sheetCard.appendChild(el("h4", null, "In their words"));
      sheetCard.appendChild(el("p", null, "“" + e.quote + "”"));
    }
    if (e.suggestion) {
      sheetCard.appendChild(el("h4", null, "What they told us"));
      sheetCard.appendChild(el("p", null, e.suggestion));
    }
    if (e.takeaways && e.takeaways.length) {
      sheetCard.appendChild(el("h4", null, "Key feedback"));
      var ul = el("ul");
      e.takeaways.forEach(function (t) { ul.appendChild(el("li", null, t)); });
      sheetCard.appendChild(ul);
    }

    if ((e.before && e.before.length) || (e.after && e.after.length)) {
      sheetCard.appendChild(el("h4", null, "Before this, and after it"));
      var ba = el("div", "evo__ba");
      ba.appendChild(col("from", "What we were doing", e.before));
      ba.appendChild(col("to", "What we changed", e.after));
      sheetCard.appendChild(ba);
    }

    var ds = decisions(e);
    if (ds.length) {
      sheetCard.appendChild(el("h4", null, ds.length > 1 ? "The areas this moved" : "The area this moved"));
      var dl = el("ul");
      ds.forEach(function (s) {
        var li = el("li");
        li.appendChild(el("b", null, byLane[s.lane].name + ": "));
        li.appendChild(document.createTextNode(s.label + ". " + (s.note || "")));
        dl.appendChild(li);
      });
      sheetCard.appendChild(dl);
    }

    if (e.photos && e.photos.length) {
      var f = el("figure", "evo__shot");
      var img = document.createElement("img");
      img.src = "../assets/img/human-practices/" + e.photos[0].src;
      img.alt = e.photos[0].alt || "";
      img.loading = "lazy";
      f.appendChild(img);
      var cap = el("figcaption", null, (e.photos[0].alt || "") + " " + (e.photos[0].prov || "Scaled only."));
      f.appendChild(cap);
      sheetCard.appendChild(f);
    }

    if (e.links && e.links.length) {
      var ls = el("div", "evo__links");
      e.links.forEach(function (l) {
        var a = el("a", null, l.label);
        a.href = l.href;
        ls.appendChild(a);
      });
      sheetCard.appendChild(ls);
    }
    if (e.source) sheetCard.appendChild(el("p", "evo__src", "Source: " + e.source + "."));

    sheet.hidden = false;
    document.body.style.overflow = "hidden";
    sheetCard.scrollTop = 0;
    sheetCard.querySelector(".evo__close").focus();
  }

  function col(cls, title, items) {
    var d = el("div", cls);
    d.appendChild(el("h5", null, title));
    var ul = el("ul");
    (items || []).forEach(function (t) { ul.appendChild(el("li", null, t)); });
    d.appendChild(ul);
    return d;
  }

  function visits(lp, here) {
    var box = el("div", "evo__visits");
    box.style.setProperty("--n", lp.count);
    lp.visits.forEach(function (id, i) {
      var v = byEng[id];
      var d = el("div", id === here.id ? "is-here" : null);
      d.appendChild(el("h5", null, "Visit " + (i + 1) + " · " + longDate(v.date)));
      d.appendChild(el("p", null, id === here.id
        ? "You are reading this visit. " + (v.suggestion || v.summary || "")
        : (v.suggestion || v.summary || "")));
      if (id !== here.id) {
        var go = el("button", null, "Read this visit");
        go.type = "button";
        go.addEventListener("click", function () { openSheet(id, true); });
        d.appendChild(go);
      }
      box.appendChild(d);
    });
    return box;
  }

  function closeSheet() {
    sheet.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---- the key ------------------------------------------------------------ */

  function key() {
    var k = el("div", "evo__key");

    var a = el("div");
    a.appendChild(el("h4", null, "How to read the road"));
    a.appendChild(el("p", null, "Every card is one conversation, in date order. The pill on the road under it is what changed in the project because of it."));
    a.appendChild(el("p", null, "A card with a green edge is someone who came back. Its ribbon says which visit you are looking at and what we had built since the last one."));
    k.appendChild(a);

    var b = el("div");
    b.appendChild(el("h4", null, "Reading one area"));
    b.appendChild(el("p", null, "The chips above filter the road to one part of the project. The start and end states change with them, so you can follow the plant model, or the reactor, from the first plan to the last."));
    k.appendChild(b);

    var c = el("div");
    c.appendChild(el("h4", null, "Where the facts come from"));
    c.appendChild(el("p", null, "Each record names its source: our interview log, the plant screening page, or the hardware notebook. " + (D.meta.note || "")));
    c.appendChild(el("p", null, "An entry with a dashed edge is one whose write-up we still owe."));
    k.appendChild(c);

    return k;
  }

  /* ---- filtering ---------------------------------------------------------- */

  function apply() {
    var shown = 0, threads = {};
    [].forEach.call(road.querySelectorAll(".evo__row"), function (r) {
      var e = byEng[r.dataset.id];
      var on = visible(e);
      r.hidden = !on;
      if (on) {
        shown += 1;
        if (loopOf[e.id]) threads[loopOf[e.id].loop.id] = 1;
      }
    });

    /* a month divider with nothing under it is noise */
    var months = road.querySelectorAll(".evo__month");
    [].forEach.call(months, function (m, i) {
      var n = m.nextElementSibling, any = false;
      while (n && !n.classList.contains("evo__month")) {
        if (n.classList.contains("evo__row") && !n.hidden) { any = true; break; }
        n = n.nextElementSibling;
      }
      m.hidden = !any;
    });

    var empty = road.querySelector(".evo__empty");
    if (empty) empty.hidden = shown > 0;

    tally.textContent = shown + " of " + D.engagements.length + " engagements · "
      + Object.keys(threads).length + " return threads";

    states();
    window.requestAnimationFrame(draw);
  }

  function states() {
    var startLabel, startText, endLabel, endText;
    if (state.area === "all") {
      startLabel = "Where we started";
      startText  = D.meta.startState;
      endLabel   = "Where it ended";
      endText    = D.meta.endState;
      planStart.dataset.title = "March 2026";
    } else {
      var ls = D.laneStates.filter(function (s) { return s.lane === state.area; });
      var first = ls[0], last = ls[ls.length - 1];
      startLabel = byLane[state.area].name + ", at the start";
      startText  = first ? (first.label + ". " + (first.note || "")) : "";
      endLabel   = byLane[state.area].name + ", now";
      endText    = last ? (last.label + ". " + (last.note || "")) : "";
    }
    fillPlan(planStart, "Start point", startLabel, startText);
    fillPlan(planEnd, "Where it ended", endLabel, endText);
  }

  function fillPlan(box, tag, title, text) {
    box.textContent = "";
    box.appendChild(el("span", "evo__label", tag));
    box.appendChild(el("h3", null, title));
    box.appendChild(el("p", null, text));
  }

  /* ---- the road line ------------------------------------------------------ */

  function draw() {
    if (!road || window.innerWidth < 992) { svg.innerHTML = ""; return; }
    var box = road.getBoundingClientRect();
    var w = road.clientWidth, h = road.clientHeight;
    if (!w || !h) return;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);

    var pts = [[w / 2, 0]];
    [].forEach.call(road.querySelectorAll(".evo__row"), function (r) {
      if (r.hidden) return;
      var card = r.querySelector(".evo__card");
      var c = card.getBoundingClientRect();
      pts.push([c.left - box.left + c.width / 2, c.top - box.top + c.height / 2]);
    });
    pts.push([w / 2, h]);

    var d = "M " + pts[0][0] + " " + pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      var p0 = pts[i - 1], p1 = pts[i];
      var dy = (p1[1] - p0[1]) * 0.55;
      d += " C " + p0[0] + " " + (p0[1] + dy) + ", " + p1[0] + " " + (p1[1] - dy) + ", " + p1[0] + " " + p1[1];
    }

    var ns = "http://www.w3.org/2000/svg";
    svg.innerHTML = "";
    var path = document.createElementNS(ns, "path");
    path.setAttribute("class", "rd");
    path.setAttribute("d", d);
    svg.appendChild(path);

    pts.slice(1, -1).forEach(function (p) {
      var cir = document.createElementNS(ns, "circle");
      cir.setAttribute("class", "dot");
      cir.setAttribute("cx", p[0]);
      cir.setAttribute("cy", p[1]);
      cir.setAttribute("r", 5);
      svg.appendChild(cir);
    });
  }

  /* ---- full bleed without a sideways page ---------------------------------- */
  /* 100vw counts the scrollbar; the document's client width does not. */

  function vw() {
    document.documentElement.style.setProperty(
      "--evo-vw", document.documentElement.clientWidth + "px");
  }

  /* ---- the ground fade ---------------------------------------------------- */

  function fade() {
    var band = root.closest(".sec--evo");
    if (!band || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        document.documentElement.classList.toggle("evo-dark", en.isIntersecting);
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    io.observe(band);
  }

  /* ---- go ----------------------------------------------------------------- */

  vw();
  build();
  apply();
  fade();

  /* A record is addressable: /human-practices/#record-e20 opens Prof. Cheng's
     second visit. That is how we link to one conversation from elsewhere on
     the wiki, and how this section is checked. */
  function fromHash() {
    var m = /^#record-(e\d+)$/.exec(window.location.hash || "");
    if (m && byEng[m[1]]) openSheet(m[1], false);
  }
  fromHash();
  window.addEventListener("hashchange", fromHash);

  var t;
  window.addEventListener("resize", function () {
    vw();
    clearTimeout(t);
    t = setTimeout(draw, 120);
  });
  window.addEventListener("load", draw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
})();
