// src/budget.ts
var SCALE = 1e6;
function validateCounts(total, bad, targetPpm) {
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(total * SCALE) || !Number.isSafeInteger(bad) || bad < 0 || bad > total || !Number.isInteger(targetPpm) || targetPpm <= 0 || targetPpm >= SCALE) throw new RangeError("invalid budget inputs");
}
function summarizeBudget(total, bad, targetPpm) {
  validateCounts(total, bad, targetPpm);
  const allowed = total * (SCALE - targetPpm) / SCALE;
  return {
    total,
    bad,
    allowed,
    remaining: allowed - bad,
    sli: total === 0 ? null : (total - bad) / total,
    spentFraction: total === 0 ? null : bad / allowed,
    compliant: total === 0 ? null : bad * SCALE <= total * (SCALE - targetPpm)
  };
}
function burnRate(total, bad, targetPpm) {
  validateCounts(total, bad, targetPpm);
  if (total === 0) return null;
  return bad / total / ((SCALE - targetPpm) / SCALE);
}
function thresholdFor(fraction, periodHours, windowHours) {
  if (![fraction, periodHours, windowHours].every(Number.isFinite) || fraction <= 0 || fraction > 1 || periodHours <= 0 || windowHours <= 0 || windowHours > periodHours) throw new RangeError("invalid threshold");
  return fraction * periodHours / windowHours;
}
function projectedHoursToExhaustion(remaining, requestsPerHour, errorRatio) {
  if (![remaining, requestsPerHour, errorRatio].every(Number.isFinite) || requestsPerHour < 0 || errorRatio < 0 || errorRatio > 1) throw new RangeError("invalid projection");
  if (remaining <= 0) return 0;
  const badPerHour = requestsPerHour * errorRatio;
  return badPerHour === 0 ? null : remaining / badPerHour;
}

// src/sli.ts
function classifyHttp(events, thresholdMs) {
  if (!Number.isFinite(thresholdMs) || thresholdMs < 0) throw new RangeError("threshold");
  const seen = /* @__PURE__ */ new Set();
  const excluded = { synthetic: 0, route: 0, invalid: 0 };
  let eligible = 0, available = 0, fastAndAvailable = 0;
  const rows = events.map((event) => {
    if (seen.has(event.id)) throw new Error("duplicate observation");
    seen.add(event.id);
    if (event.durationMs !== null && (!Number.isFinite(event.durationMs) || event.durationMs < 0)) throw new RangeError("duration");
    const reason = event.traffic === "synthetic" ? "synthetic" : event.route !== "GET /reports/{id}" ? "route" : !event.requestValid ? "invalid" : null;
    if (reason) {
      excluded[reason]++;
      return { id: event.id, reason, available: false, fastAndAvailable: false };
    }
    eligible++;
    const correct = event.status === 200 && event.bodyValid || event.status === 404 && event.expectedNotFound && event.bodyValid;
    const fast = correct && event.durationMs !== null && event.durationMs <= thresholdMs;
    if (correct) available++;
    if (fast) fastAndAvailable++;
    return { id: event.id, reason: null, available: correct, fastAndAvailable: fast };
  });
  return { eligible, available, fastAndAvailable, excluded, rows };
}

// src/cohorts.ts
function classifyCohorts(operations, now, deadlineMinutes) {
  if (!Number.isFinite(now) || !Number.isFinite(deadlineMinutes) || deadlineMinutes <= 0) throw new RangeError("clock");
  const seen = /* @__PURE__ */ new Set();
  let eligible = 0, good = 0, immature = 0, future = 0;
  const rows = operations.map((operation) => {
    if (seen.has(operation.id)) throw new Error("duplicate operation");
    seen.add(operation.id);
    if (!Number.isFinite(operation.createdAt) || operation.finishedAt !== null && (!Number.isFinite(operation.finishedAt) || operation.finishedAt < operation.createdAt)) throw new RangeError("operation clock");
    const deadline = operation.createdAt + deadlineMinutes;
    if (operation.createdAt > now) {
      future++;
      return { id: operation.id, deadline, classification: "future" };
    }
    if (deadline > now) {
      immature++;
      return { id: operation.id, deadline, classification: "immature" };
    }
    eligible++;
    const onTime = operation.finishedAt !== null && operation.finishedAt <= now && operation.finishedAt <= deadline;
    const resolved = operation.outcome === "completed" || operation.outcome === "rejected";
    const success = onTime && resolved;
    if (success) good++;
    return { id: operation.id, deadline, classification: success ? "good" : "bad" };
  });
  return { eligible, good, immature, future, rows };
}

// src/windows.ts
var WindowIndex = class {
  #total = [0];
  #bad = [0];
  #present = [0];
  constructor(bins) {
    for (const [i, bin] of bins.entries()) {
      if (bin.minute !== i || typeof bin.present !== "boolean" || !bin.present && (bin.total !== 0 || bin.bad !== 0)) throw new Error("grid or gap invalid");
      validateCounts(bin.total, bin.bad, 999e3);
      const total = this.#total[i] + bin.total;
      validateCounts(total, 0, 999e3);
      this.#total.push(total);
      this.#bad.push(this.#bad[i] + bin.bad);
      this.#present.push(this.#present[i] + Number(bin.present));
    }
  }
  read(start, end) {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end >= this.#total.length) throw new RangeError("window bounds");
    const coveredMinutes = this.#present[end] - this.#present[start];
    return {
      total: this.#total[end] - this.#total[start],
      bad: this.#bad[end] - this.#bad[start],
      coveredMinutes,
      windowMinutes: end - start,
      complete: coveredMinutes === end - start
    };
  }
};

// src/alerts.ts
var rules = [
  { id: "fast", longMinutes: 60, shortMinutes: 5, threshold: 14.4, severity: "page", minLong: 1e3, minShort: 50 },
  { id: "slow", longMinutes: 360, shortMinutes: 30, threshold: 6, severity: "page", minLong: 1e3, minShort: 50 },
  { id: "ticket", longMinutes: 4320, shortMinutes: 360, threshold: 1, severity: "ticket", minLong: 1e3, minShort: 50 }
];
function evaluateAlerts(index, now, targetPpm, selectedRules = rules) {
  validateCounts(0, 0, targetPpm);
  const pairs = selectedRules.map((rule) => {
    if (!Number.isInteger(rule.longMinutes) || !Number.isInteger(rule.shortMinutes) || rule.shortMinutes <= 0 || rule.longMinutes < rule.shortMinutes || !Number.isFinite(rule.threshold) || rule.threshold <= 0) throw new RangeError("rule");
    if (now < rule.longMinutes) return { id: rule.id, severity: rule.severity, state: "missing_data", longBurn: null, shortBurn: null };
    const long = index.read(now - rule.longMinutes, now);
    const short = index.read(now - rule.shortMinutes, now);
    const longBurn = long.complete ? burnRate(long.total, long.bad, targetPpm) : null;
    const shortBurn = short.complete ? burnRate(short.total, short.bad, targetPpm) : null;
    const state = !long.complete || !short.complete ? "missing_data" : long.total === 0 || short.total === 0 ? "no_traffic" : long.total < rule.minLong || short.total < rule.minShort ? "insufficient_volume" : longBurn > rule.threshold && shortBurn > rule.threshold ? "firing" : "ok";
    return { id: rule.id, severity: rule.severity, state, longBurn, shortBurn };
  });
  const active = pairs.filter((pair) => pair.state === "firing");
  const severity = active.some((pair) => pair.severity === "page") ? "page" : active.length ? "ticket" : "none";
  return { severity, pairs };
}

// src/simulation.ts
var PERIOD_MINUTES = 43200;
var segment = (minutes, total = 1e3, bad = 0, present = true) => ({ minutes, total, bad, present });
var scenarios = [
  { id: "baseline", title: "Sin errores", segments: [segment(PERIOD_MINUTES)] },
  { id: "fast-burn", title: "Degradaci\xF3n r\xE1pida activa", segments: [segment(43190), segment(10, 1e3, 150)] },
  { id: "recovered", title: "Degradaci\xF3n ya recuperada", segments: [segment(43175), segment(10, 1e3, 150), segment(15)] },
  { id: "slow-burn", title: "Degradaci\xF3n lenta sostenida", segments: [segment(42840), segment(360, 1e3, 10)] },
  { id: "low-traffic", title: "Un fallo con tr\xE1fico bajo", segments: [segment(43199, 1), segment(1, 1, 1)] },
  { id: "no-traffic", title: "Sin tr\xE1fico conocido", segments: [segment(PERIOD_MINUTES, 0)] },
  { id: "missing-data", title: "Faltan cinco minutos de telemetr\xEDa", segments: [segment(43195), segment(5, 0, 0, false)] }
];
function expand(scenario) {
  const bins = [];
  for (const s of scenario.segments) {
    if (!Number.isInteger(s.minutes) || s.minutes <= 0 || bins.length + s.minutes > PERIOD_MINUTES) throw new RangeError("segment duration");
    for (let i = 0; i < s.minutes; i++) bins.push({ minute: bins.length, total: s.total, bad: s.bad, present: s.present });
  }
  if (bins.length !== PERIOD_MINUTES) throw new RangeError("incomplete scenario grid");
  return bins;
}
export {
  PERIOD_MINUTES,
  SCALE,
  WindowIndex,
  burnRate,
  classifyCohorts,
  classifyHttp,
  evaluateAlerts,
  expand,
  projectedHoursToExhaustion,
  rules,
  scenarios,
  summarizeBudget,
  thresholdFor,
  validateCounts
};
