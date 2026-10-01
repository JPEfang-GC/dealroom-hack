(function () {
  "use strict";

  var data = window.DEMO_FIXTURE;
  var entities = {};
  var cy = null;
  var colors = { fi: "#7957d5", fintech: "#3482bd", vc: "#9aaabc" };
  data.companies.forEach(function (x) { entities[x.id] = x; });
  data.gps.forEach(function (x) { entities[x.id] = x; });
  data.lps.forEach(function (x) { entities[x.id] = x; });

  function money(value) { return "$" + Math.round(value) + "m"; }
  function percent(value) { return Math.round(value * 100) + "%"; }
  function byGroup(group) {
    return data.companies.filter(function (c) {
      return group === "fi" ? c.group === "fi" : group === "fintech" ? c.group !== "venture" : true;
    });
  }
  function latestValue(company) {
    return company.rounds.length ? company.rounds[company.rounds.length - 1].valuation : null;
  }
  function median(values) {
    values = values.slice().sort(function (a, b) { return a - b; });
    if (!values.length) return null;
    var mid = Math.floor(values.length / 2);
    return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  }
  function cohortStats(group) {
    var companies = byGroup(group);
    var years = [2022, 2023, 2024, 2025];
    var funding = years.map(function (year) {
      return companies.reduce(function (sum, company) {
        return sum + company.rounds.filter(function (round) { return round.year === year; })
          .reduce(function (subtotal, round) { return subtotal + round.amount; }, 0);
      }, 0);
    });
    var steps = companies.map(function (company) {
      if (company.rounds.length < 2) return null;
      var prev = company.rounds[company.rounds.length - 2].valuation;
      var last = company.rounds[company.rounds.length - 1].valuation;
      return prev && last ? last / prev : null;
    }).filter(function (x) { return x !== null; });
    var values = companies.map(latestValue).filter(function (x) { return x !== null; }).sort(function (a, b) { return b - a; });
    var totalValue = values.reduce(function (sum, x) { return sum + x; }, 0);
    var followOnCount = companies.filter(function (c) { return c.rounds.length > 1; }).length;
    var exitCount = companies.filter(function (c) { return !!c.exit; }).length;
    return {
      group: group, companies: companies, years: years, funding: funding,
      followOn: followOnCount / companies.length, followOnCount: followOnCount,
      stepUp: median(steps), exits: exitCount / companies.length, exitCount: exitCount,
      top3: totalValue ? values.slice(0, 3).reduce(function (sum, x) { return sum + x; }, 0) / totalValue : 0
    };
  }
  var cohorts = [
    { id: "fi", label: "FI companies" },
    { id: "fintech", label: "All European fintech" },
    { id: "vc", label: "VC overall" }
  ];
  var stats = {};
  cohorts.forEach(function (c) { stats[c.id] = cohortStats(c.id); });

  function exposure(lp) {
    var companies = data.companies.filter(function (c) {
      return c.group === "fi" && c.gps.some(function (gp) { return lp.gps.indexOf(gp) !== -1; });
    });
    var links = companies.reduce(function (sum, c) {
      return sum + c.gps.filter(function (gp) { return lp.gps.indexOf(gp) !== -1; }).length;
    }, 0);
    return { companies: companies, links: links };
  }
  var rankedLPs = data.lps.map(function (lp) {
    var x = exposure(lp);
    return { lp: lp, companies: x.companies, links: x.links };
  }).sort(function (a, b) {
    return b.companies.length - a.companies.length || b.links - a.links || a.lp.name.localeCompare(b.lp.name);
  });

  function setView(view) {
    document.querySelectorAll(".tab").forEach(function (x) { x.classList.toggle("active", x.dataset.panel === view); });
    document.querySelectorAll(".panel").forEach(function (x) { x.classList.toggle("active", x.id === view); });
    if (view === "network" && cy) cy.resize();
  }
  function linkButton(id, label) {
    return '<button class="entity-link" type="button" data-node="' + id + '">' + label + '</button>';
  }
  function markPath(nodes, edges) {
    if (!cy) return;
    cy.elements().removeClass("faded path selected").addClass("faded");
    nodes.forEach(function (id) { cy.getElementById(id).removeClass("faded").addClass("path"); });
    edges.forEach(function (id) { cy.getElementById(id).removeClass("faded").addClass("path"); });
  }
  function addCompanyPath(company, nodes, edges) {
    nodes.push(company.id);
    if (company.group === "fi") {
      nodes.push(data.theme.id);
      edges.push("class-" + company.id);
    }
    company.gps.forEach(function (gp) {
      nodes.push(gp);
      edges.push("portfolio-" + company.id + "-" + gp);
      data.lps.filter(function (lp) { return lp.gps.indexOf(gp) !== -1; }).forEach(function (lp) {
        nodes.push(lp.id);
        edges.push("commit-" + gp + "-" + lp.id);
      });
    });
  }

  function openLP(id) {
    var lp = entities[id];
    var e = exposure(lp);
    var nodes = [lp.id];
    var edges = [];
    lp.gps.forEach(function (gp) {
      nodes.push(gp);
      edges.push("commit-" + gp + "-" + lp.id);
    });
    e.companies.forEach(function (company) {
      nodes.push(company.id, data.theme.id);
      edges.push("class-" + company.id);
      company.gps.filter(function (gp) { return lp.gps.indexOf(gp) !== -1; }).forEach(function (gp) {
        edges.push("portfolio-" + company.id + "-" + gp);
      });
    });
    markPath(nodes, edges);
    document.getElementById("why-panel").innerHTML =
      '<h3>' + lp.name + '</h3><p class="hint">' + lp.type + ' · fictional LP</p>' +
      '<div class="pathbox"><div class="path-line">' + lp.name + ' <span class="arrow">→</span> ' +
      lp.gps.map(function (gp) { return linkButton(gp, entities[gp].name); }).join(" ") +
      ' <span class="arrow">→</span> ' + e.companies.length + ' classified FI companies</div>' +
      '<div style="margin-top:9px"><span class="pill">' + e.links + ' GP–company links</span></div><ul class="company-list">' +
      e.companies.map(function (c) { return '<li>' + linkButton(c.id, c.name) + '<span class="muted"> · ' + c.product + '</span></li>'; }).join("") + '</ul></div>' +
      '<div class="detail-block"><strong>Why it surfaced</strong><p class="why">Its fictional GP commitments connect to ' + e.companies.length + ' unique fixture companies classified in the FI theme. This is indirect portfolio exposure only.</p></div>' +
      '<div class="detail-block"><strong>Outreach angle</strong><p>' + lp.angle + '</p></div>' +
      '<div class="detail-block"><strong>Next validation</strong><p>Confirm the fund-level LP commitment, fund vintage and company classification before attributing exposure.</p></div>' +
      '<div class="detail-block"><button class="action-button" data-trace="' + lp.id + '">Trace this LP in the network</button></div>';
    document.getElementById("lp-detail").innerHTML =
      '<h3>' + lp.name + '</h3><div class="meta">' + lp.type + ' · ' + lp.gps.length + ' associated GPs in fixture</div>' +
      '<div class="detail-block"><strong>Relevant GPs</strong><p>' + lp.gps.map(function (gp) { return linkButton(gp, entities[gp].name); }).join(" ") + '</p></div>' +
      '<div class="detail-block"><strong>FI company count</strong><p><b>' + e.companies.length + '</b> unique companies</p></div>' +
      '<div class="detail-block"><strong>Indirect portfolio links</strong><p><b>' + e.links + '</b> GP–company paths; this is not LP ownership or invested value.</p></div>' +
      '<div class="detail-block"><strong>Why relevant</strong><p class="why">A path from this LP through its fictional managers reaches companies classified in the inclusion theme.</p></div>' +
      '<div class="detail-block"><strong>Suggested outreach</strong><p>' + lp.angle + '</p></div>' +
      '<div class="detail-block"><button class="action-button" data-trace="' + lp.id + '">Trace this LP in the network</button></div>';
    document.querySelectorAll(".rank-table tbody tr").forEach(function (row) {
      row.classList.toggle("selected", row.dataset.lp === lp.id);
    });
  }

  function openGP(id) {
    var gp = entities[id];
    var companies = data.companies.filter(function (c) { return c.gps.indexOf(id) !== -1; });
    var fi = companies.filter(function (c) { return c.group === "fi"; });
    var lps = data.lps.filter(function (lp) { return lp.gps.indexOf(id) !== -1; });
    var nodes = [id, data.theme.id];
    var edges = [];
    companies.forEach(function (c) { addCompanyPath(c, nodes, edges); });
    markPath(nodes, edges);
    document.getElementById("why-panel").innerHTML = '<h3>' + gp.name + '</h3><p class="hint">General Partner · fictional fixture</p>' +
      '<div class="detail-block"><strong>FI portfolio (' + fi.length + ')</strong><p>' + (fi.length ? fi.map(function (c) { return linkButton(c.id, c.name); }).join(" ") : "No FI companies in this fixture") + '</p></div>' +
      '<div class="detail-block"><strong>Other portfolio companies</strong><p>' + companies.filter(function (c) { return c.group !== "fi"; }).map(function (c) { return linkButton(c.id, c.name); }).join(" ") + '</p></div>' +
      '<div class="detail-block"><strong>Connected LPs</strong><p>' + lps.map(function (lp) { return linkButton(lp.id, lp.name); }).join(" ") + '</p></div>' +
      '<div class="detail-block"><strong>Interpretation</strong><p>These are illustrative portfolio edges. A real LP commitment must be verified at fund level.</p></div>';
  }

  function openCompany(id) {
    var c = entities[id];
    var nodes = [];
    var edges = [];
    addCompanyPath(c, nodes, edges);
    markPath(nodes, edges);
    var roundText = c.rounds.map(function (r) { return r.year + ': ' + money(r.amount) + ' round, ' + money(r.valuation) + ' valuation'; }).join("; ");
    document.getElementById("why-panel").innerHTML = '<h3>' + c.name + '</h3><p class="hint">Portfolio company · ' + (c.group === "fi" ? "classified in the FI theme" : c.group === "fintech" ? "European fintech comparison" : "VC overall comparison") + '</p>' +
      '<div class="detail-block"><strong>Product description</strong><p>' + c.product + '</p></div>' +
      '<div class="detail-block"><strong>Theme classification</strong><p>' + (c.group === "fi" ? linkButton(data.theme.id, "Financial inclusion") : "Not tagged as FI in this fixture") + '</p></div>' +
      '<div class="detail-block"><strong>Funding progression</strong><p>' + roundText + '</p></div>' +
      '<div class="detail-block"><strong>Associated GPs</strong><p>' + c.gps.map(function (gp) { return linkButton(gp, entities[gp].name); }).join(" ") + '</p></div>' +
      '<div class="detail-block"><strong>Exit event</strong><p>' + (c.exit ? c.exit.type + ' · ' + c.exit.year : "No exit recorded in fixture") + '</p></div>';
  }

  function openTheme() {
    var fi = byGroup("fi");
    var nodes = [data.theme.id];
    var edges = [];
    fi.forEach(function (c) { addCompanyPath(c, nodes, edges); });
    markPath(nodes, edges);
    document.getElementById("why-panel").innerHTML = '<h3>' + data.theme.label + '</h3><p class="hint">Illustrative classification theme</p>' +
      '<div class="detail-block"><strong>Companies (' + fi.length + ')</strong><p>' + fi.map(function (c) { return linkButton(c.id, c.name); }).join(" ") + '</p></div>' +
      '<div class="detail-block"><strong>Classification caveat</strong><p>These fictional labels are for the demo only. A live build needs an auditable inclusion taxonomy and reviewed company-level evidence.</p></div>';
  }

  function openCohort(group) {
    var cohort = stats[group];
    setView("network");
    var nodes = [data.theme.id];
    var edges = [];
    cohort.companies.forEach(function (c) { addCompanyPath(c, nodes, edges); });
    markPath(nodes, edges);
    document.getElementById("why-panel").innerHTML = '<h3>' + cohorts.filter(function (c) { return c.id === group; })[0].label + '</h3>' +
      '<p class="hint">' + cohort.companies.length + ' fixture companies · click any company, GP or LP to continue exploring</p>' +
      '<div class="detail-block"><strong>Companies</strong><p>' + cohort.companies.map(function (c) { return linkButton(c.id, c.name); }).join(" ") + '</p></div>' +
      '<div class="detail-block"><strong>Follow-on / step-up / exits / top-3 share</strong><p>' + percent(cohort.followOn) + ' · ' + cohort.stepUp.toFixed(1) + '× · ' + percent(cohort.exits) + ' · ' + percent(cohort.top3) + '</p></div>';
  }

  function openNode(id) {
    if (id === data.theme.id) return openTheme();
    var entity = entities[id];
    if (!entity) return;
    if (data.lps.some(function (x) { return x.id === id; })) return openLP(id);
    if (data.gps.some(function (x) { return x.id === id; })) return openGP(id);
    return openCompany(id);
  }

  function renderRankedLPs() {
    var table = document.getElementById("lp-table");
    table.innerHTML = '<thead><tr><th>#</th><th>LP</th><th>Relevant GPs</th><th>FI companies</th><th>Indirect links</th></tr></thead><tbody>' +
      rankedLPs.map(function (row, i) {
        return '<tr data-lp="' + row.lp.id + '"><td><span class="rank">' + (i + 1) + '</span></td><td><span class="lp-name">' + row.lp.name + '</span><div class="small muted">' + row.lp.type + '</div></td><td>' + row.lp.gps.map(function (gp) { return linkButton(gp, entities[gp].name); }).join(" ") + '</td><td><b>' + row.companies.length + '</b></td><td>' + row.links + '</td></tr>';
      }).join("") + '</tbody>';
    table.querySelectorAll("tbody tr").forEach(function (row) {
      row.addEventListener("click", function (event) {
        if (event.target.closest("button")) return;
        openLP(row.dataset.lp);
      });
    });
    openLP(rankedLPs[0].lp.id);
  }

  function renderAnalytics() {
    var width = 720, height = 260, left = 58, right = 18, top = 16, bottom = 36;
    var max = Math.ceil(Math.max.apply(null, stats.vc.funding) / 50) * 50;
    var x = function (i) { return left + i * (width - left - right) / 3; };
    var y = function (v) { return top + (height - top - bottom) * (1 - v / max); };
    var svg = ['<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Click a cohort point to explore companies">'];
    for (var i = 0; i <= 4; i++) {
      var val = max * i / 4, yy = y(val);
      svg.push('<line x1="' + left + '" x2="' + (width - right) + '" y1="' + yy + '" y2="' + yy + '" stroke="#e7edf3"/><text x="' + (left - 8) + '" y="' + (yy + 4) + '" text-anchor="end" fill="#70839a" font-size="10">$' + Math.round(val) + 'm</text>');
    }
    cohorts.forEach(function (cohort) {
      var s = stats[cohort.id];
      svg.push('<polyline fill="none" stroke="' + colors[cohort.id] + '" stroke-width="3" points="' + s.funding.map(function (v, j) { return x(j) + ',' + y(v); }).join(" ") + '"/>');
      s.funding.forEach(function (v, j) {
        svg.push('<circle class="chart-point" data-group="' + cohort.id + '" data-year="' + s.years[j] + '" tabindex="0" role="button" aria-label="' + cohort.label + ' funding in ' + s.years[j] + ': ' + money(v) + '. Click to explore." cx="' + x(j) + '" cy="' + y(v) + '" r="5" fill="' + colors[cohort.id] + '"/><title>' + cohort.label + ' · ' + s.years[j] + ' · ' + money(v) + '</title>');
      });
    });
    stats.fi.years.forEach(function (yr, i) { svg.push('<text x="' + x(i) + '" y="' + (height - 9) + '" text-anchor="middle" fill="#70839a" font-size="11">' + yr + '</text>'); });
    svg.push('</svg>');
    document.getElementById("funding-chart").innerHTML = svg.join("");
    document.querySelectorAll(".chart-point").forEach(function (point) {
      var activate = function () { openCohort(point.dataset.group); };
      point.addEventListener("click", activate);
      point.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } });
    });
    document.getElementById("kpis").innerHTML =
      '<div class="card kpi"><div class="label">FI follow-on rate</div><div class="value">' + percent(stats.fi.followOn) + '</div><div class="detail">' + stats.fi.followOnCount + ' of ' + stats.fi.companies.length + ' fixture companies</div></div>' +
      '<div class="card kpi"><div class="label">FI median step-up</div><div class="value">' + stats.fi.stepUp.toFixed(1) + '×</div><div class="detail">Latest vs. previous priced round</div></div>' +
      '<div class="card kpi"><div class="label">FI exit rate</div><div class="value">' + percent(stats.fi.exits) + '</div><div class="detail">' + stats.fi.exitCount + ' exits of ' + stats.fi.companies.length + ' fixture companies</div></div>' +
      '<div class="card kpi"><div class="label">Top 3 valuation share</div><div class="value">' + percent(stats.fi.top3) + '</div><div class="detail">Concentration in latest known valuations</div></div>';
    var table = '<thead><tr><th>Cohort</th><th>Companies</th><th>Funding 2022 → 2025</th><th>Follow-on</th><th>Median step-up</th><th>Exit rate</th><th>Top 3 share</th></tr></thead><tbody>';
    cohorts.forEach(function (c) {
      var s = stats[c.id];
      table += '<tr class="cohort-row" data-group="' + c.id + '" tabindex="0" role="button"><td><strong>' + c.label + '</strong><div class="small muted">click to inspect companies</div></td><td>' + s.companies.length + '</td><td>' + money(s.funding[0]) + ' → ' + money(s.funding[3]) + '</td><td>' + percent(s.followOn) + '</td><td>' + s.stepUp.toFixed(1) + '×</td><td>' + percent(s.exits) + '</td><td>' + percent(s.top3) + '</td></tr>';
    });
    document.getElementById("metric-table").innerHTML = table + '</tbody>';
    document.querySelectorAll(".cohort-row").forEach(function (row) {
      var activate = function () { openCohort(row.dataset.group); };
      row.addEventListener("click", activate);
      row.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } });
    });
    var fi = stats.fi, ft = stats.fintech;
    var wins = [];
    if (fi.followOn > ft.followOn) wins.push("follow-on rate");
    if (fi.stepUp > ft.stepUp) wins.push("median valuation step-up");
    if (fi.exits > ft.exits) wins.push("exit rate");
    var verdict = wins.length ? "FI leads this illustrative fintech cohort on " + wins.join(", ") + "." : "FI does not lead this illustrative fintech cohort on follow-on rate, median step-up or exit rate.";
    document.getElementById("verdict").textContent = verdict + " The top three FI companies account for " + percent(fi.top3) + " of cohort valuation, so concentration is high. This synthetic sample cannot support an investment conclusion.";
  }

  function graphElements() {
    var elements = [{ data: { id: data.theme.id, label: data.theme.label }, position: { x: 90, y: 345 }, classes: "theme" }];
    data.companies.forEach(function (c, i) {
      elements.push({ data: { id: c.id, label: c.name }, position: { x: 345, y: 42 + i * 46 }, classes: c.group === "fi" ? "fi-company" : "peer-company" });
      if (c.group === "fi") elements.push({ data: { id: "class-" + c.id, source: data.theme.id, target: c.id }, classes: "classification" });
      c.gps.forEach(function (gp) { elements.push({ data: { id: "portfolio-" + c.id + "-" + gp, source: c.id, target: gp }, classes: "portfolio" }); });
    });
    data.gps.forEach(function (gp, i) { elements.push({ data: { id: gp.id, label: gp.name }, position: { x: 665, y: 170 + i * 220 }, classes: "gp" }); });
    data.lps.forEach(function (lp, i) {
      elements.push({ data: { id: lp.id, label: lp.name }, position: { x: 925, y: 105 + i * 170 }, classes: "lp" });
      lp.gps.forEach(function (gp) { elements.push({ data: { id: "commit-" + gp + "-" + lp.id, source: gp, target: lp.id }, classes: "commitment" }); });
    });
    return elements;
  }
  function initGraph() {
    if (!window.cytoscape) {
      document.getElementById("cy").innerHTML = '<p style="padding:20px">Cytoscape.js could not load. Connect to the internet and reload this page.</p>';
      return;
    }
    cy = window.cytoscape({ container: document.getElementById("cy"), elements: graphElements(), layout: { name: "preset", fit: true, padding: 35 }, minZoom: .45, maxZoom: 1.4,
      style: [
        { selector: "node", style: { label: "data(label)", "text-wrap": "wrap", "text-max-width": "135px", "font-size": 11, "font-weight": 700, color: "#fff", "text-valign": "center", "text-halign": "center", width: 150, height: 39, shape: "round-rectangle", "border-width": 1, "border-color": "rgba(10,30,50,.14)" } },
        { selector: "node.theme", style: { "background-color": "#7957d5", width: 112, height: 68, shape: "hexagon", "font-size": 12 } },
        { selector: "node.fi-company", style: { "background-color": "#1c9b78" } },
        { selector: "node.peer-company", style: { "background-color": "#3482bd", height: 32, "font-size": 10 } },
        { selector: "node.gp", style: { "background-color": "#d18c27", color: "#35250c" } },
        { selector: "node.lp", style: { "background-color": "#cf5a83" } },
        { selector: "edge", style: { width: 1.5, "line-color": "#b8c6d4", "target-arrow-color": "#b8c6d4", "target-arrow-shape": "triangle", "curve-style": "bezier", "arrow-scale": .75 } },
        { selector: "edge.classification", style: { "line-color": "#7957d5", "target-arrow-color": "#7957d5", "line-style": "dashed" } },
        { selector: "edge.path", style: { width: 3, "line-color": "#27a77e", "target-arrow-color": "#27a77e", "z-index": 10 } },
        { selector: "node.faded, edge.faded", style: { opacity: .14 } },
        { selector: "node.path", style: { "border-width": 3, "border-color": "#27a77e", "z-index": 10 } },
        { selector: "node.selected", style: { "border-width": 4, "border-color": "#14263c" } }
      ]
    });
    cy.on("tap", "node", function (event) { openNode(event.target.id()); });
  }

  document.querySelectorAll(".tab").forEach(function (button) {
    button.addEventListener("click", function () { setView(button.dataset.panel); });
  });
  document.body.addEventListener("click", function (event) {
    var nodeButton = event.target.closest("[data-node]");
    if (nodeButton) { openNode(nodeButton.dataset.node); return; }
    var traceButton = event.target.closest("[data-trace]");
    if (traceButton) { setView("network"); openLP(traceButton.dataset.trace); return; }
  });
  renderAnalytics();
  renderRankedLPs();
  initGraph();
  openLP(rankedLPs[0].lp.id);
})();
