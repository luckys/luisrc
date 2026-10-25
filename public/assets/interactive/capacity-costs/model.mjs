                     
                
                   
                 
                
              
              
  
                                                     
                     
                      
                     
                         
                          
                    
  
                       
               
                          
                     
                     
  
                              
                   
                  
                   
                     
                
  
function bounded(value        , min        , max        , integer = false) {
  if (
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isSafeInteger(value))
  )
    throw Error("outside_model_scope");
}
function validShape(s       ) {
  bounded(s.cpuMs, 1, 1000);
  bounded(s.cpuCores, 1, 64, true);
  bounded(s.target, 0.01, 1);
  bounded(s.spare, 0, 10, true);
  bounded(s.min, s.spare + 1, 100, true);
  bounded(s.max, s.min, 100, true);
}
function validProfile(p           ) {
  if (!Array.isArray(p) || !p.length || p.length > 24)
    throw Error("invalid_profile");
  for (const s of p) {
    bounded(s.hours, 1, 24, true);
    bounded(s.rps, 0, 10000, true);
  }
  if (p.reduce((sum, s) => sum + s.hours, 0) !== 24)
    throw Error("profile_requires_24_hours");
}
function money(value        ) {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,14})$/.test(value))
    throw Error("integer_micro_usd_required");
  return BigInt(value);
}
function ceilRatio(n        , d        ) {
  return (n + d - 1n) / d;
}

export function meanInFlight(rps        , meanMs        ) {
  bounded(rps, 0, 10000);
  bounded(meanMs, 0, 3600000);
  return (rps * meanMs) / 1000;
}
export function replicasFor(rps        , s       ) {
  validShape(s);
  bounded(rps, 0, 10000);
  const required = Math.max(
    s.min,
    Math.ceil((rps * s.cpuMs) / (1000 * s.cpuCores * s.target)) + s.spare,
  );
  const provisioned = Math.min(s.max, required);
  const demandCores = (rps * s.cpuMs) / 1000;
  return {
    required,
    provisioned,
    feasible: required <= s.max,
    cpuUtilization: demandCores / (provisioned * s.cpuCores),
    afterLossUtilization: demandCores / ((provisioned - s.spare) * s.cpuCores),
  };
}
export function bottleneck(
  replicas        ,
  s                                                           ,
) {
  validShape(s);
  bounded(replicas, 1, 100, true);
  bounded(s.dbSlots, 1, 1000, true);
  bounded(s.dbMs, 1, 10000);
  bounded(s.visits, 1, 100, true);
  const appRps = (replicas * s.cpuCores * 1000) / s.cpuMs;
  const databaseRps = (s.dbSlots * 1000) / (s.dbMs * s.visits);
  return {
    appRps,
    databaseRps,
    ceilingRps: Math.min(appRps, databaseRps),
    limiting:
      appRps < databaseRps ? "app" : appRps > databaseRps ? "database" : "both",
  };
}
export function simulate(p        ) {
  validShape(p);
  for (const k of ["interval", "startup", "downHold"]         ) {
    bounded(p[k], k === "interval" ? 5 : 0, 120, true);
    if (p[k] % 5) throw Error("five_second_multiple_required");
  }
  bounded(p.queueLimit, 0, 10000, true);
  bounded(p.dbRps, 1, 10000);
  let ready = p.min,
    desired = ready,
    pending                                       = null;
  let downSince                = null,
    queue = 0,
    arrived = 0,
    served = 0,
    rejected = 0;
  const rows = [];
  for (let time = 0; time < 300; time += 5) {
    if (pending && time >= pending.at) {
      ready = pending.count;
      pending = null;
    }
    const rps = time >= 60 && time < 180 ? 300 : 20;
    if (time % p.interval === 0) {
      desired = replicasFor(rps, p).provisioned;
      if (desired > ready) {
        downSince = null;
        if (!pending) pending = { at: time + p.startup, count: desired };
        if (p.startup === 0) {
          ready = desired;
          pending = null;
        }
      } else if (desired < ready) {
        pending = null;
        downSince ??= time;
        if (time - downSince >= p.downHold) {
          ready = desired;
          downSince = null;
        }
      } else {
        downSince = null;
        pending = null;
      }
    }
    const capacityRps = Math.min(
      (ready * p.cpuCores * 1000) / p.cpuMs,
      p.dbRps,
    );
    const incoming = rps * 5;
    const completed = Math.min(queue + incoming, capacityRps * 5);
    const waiting = queue + incoming - completed;
    const dropped = Math.max(0, waiting - p.queueLimit);
    queue = Math.min(p.queueLimit, waiting);
    arrived += incoming;
    served += completed;
    rejected += dropped;
    rows.push({
      time,
      until: time + 5,
      rps,
      ready,
      desired,
      pendingAt: pending?.at ?? null,
      capacityRps,
      queue,
      arrived,
      served,
      rejected,
    });
  }
  return rows;
}
export function estimate(
  profile           ,
  shape       ,
  rates       ,
  p         ,
) {
  validProfile(profile);
  validShape(shape);
  bounded(p.days, 1, 31, true);
  bounded(p.bytesPerRequest, 0, 1000000, true);
  bounded(p.storageGiB, 0, 100000, true);
  bounded(p.successBps, 0, 10000, true);
  const r = Object.fromEntries(
    Object.entries(rates).map(([k, v]) => [k, money(v)]),
  )                               ;
  const segments = profile.map((s) => ({ ...s, ...replicasFor(s.rps, shape) }));
  const requests =
    p.days * profile.reduce((sum, s) => sum + s.hours * 3600 * s.rps, 0);
  const replicaHours =
    p.days * segments.reduce((sum, s) => sum + s.hours * s.provisioned, 0);
  const staticHours =
    p.days * 24 * Math.max(...segments.map((s) => s.provisioned));
  const lines = {
    compute: (BigInt(replicaHours) * r.replicaHour).toString(),
    fixed: r.fixedMonth.toString(),
    requests: ceilRatio(
      BigInt(requests) * r.requestMillion,
      1000000n,
    ).toString(),
    storage: (BigInt(p.storageGiB) * r.storageGiBMonth).toString(),
    egress: ceilRatio(
      BigInt(requests) * BigInt(p.bytesPerRequest) * r.egressGiB,
      1073741824n,
    ).toString(),
  };
  const subtotal = Object.values(lines).reduce((sum, v) => sum + BigInt(v), 0n);
  const goodRequests = Number(
    (BigInt(requests) * BigInt(p.successBps)) / 10000n,
  );
  return {
    segments,
    requests,
    goodRequests,
    replicaHours,
    staticHours,
    lines,
    subtotal: subtotal.toString(),
    staticCompute: (BigInt(staticHours) * r.replicaHour).toString(),
    perMillionOffered: requests
      ? ceilRatio(subtotal * 1000000n, BigInt(requests)).toString()
      : null,
    perMillionGood: goodRequests
      ? ceilRatio(subtotal * 1000000n, BigInt(goodRequests)).toString()
      : null,
    capacityValidated: false,
    feasibleCpuModel: segments.every((s) => s.feasible),
  };
}
export function commitment(
  profile           ,
  s       ,
  days        ,
  units        ,
  onDemand        ,
  committed        ,
) {
  validProfile(profile);
  validShape(s);
  bounded(days, 1, 31, true);
  bounded(units, 0, 100, true);
  const od = money(onDemand),
    rate = money(committed);
  if (rate > od) throw Error("discount_expected");
  let cost = 0n,
    usedUnitHours = 0,
    unusedUnitHours = 0,
    onDemandUnitHours = 0;
  for (const segment of profile) {
    const replicas = replicasFor(segment.rps, s).provisioned;
    const hours = days * segment.hours;
    usedUnitHours += hours * Math.min(replicas, units);
    unusedUnitHours += hours * Math.max(0, units - replicas);
    onDemandUnitHours += hours * Math.max(0, replicas - units);
    cost +=
      BigInt(hours) *
      (BigInt(units) * rate + BigInt(Math.max(0, replicas - units)) * od);
  }
  return {
    cost: cost.toString(),
    usedUnitHours,
    unusedUnitHours,
    onDemandUnitHours,
  };
}
export function allocate(total        , weights          ) {
  const amount = money(total);
  if (!weights.length || weights.length > 100) throw Error("invalid_weights");
  for (const w of weights) bounded(w, 0, 1000000000, true);
  const denominator = weights.reduce((a, b) => a + BigInt(b), 0n);
  if (!denominator) throw Error("positive_total_weight_required");
  const shares = weights.map((w) => (amount * BigInt(w)) / denominator);
  const order = weights
    .map((w, i) => ({ i, remainder: (amount * BigInt(w)) % denominator }))
    .sort((a, b) =>
      a.remainder === b.remainder
        ? a.i - b.i
        : a.remainder > b.remainder
          ? -1
          : 1,
    );
  const remaining = amount - shares.reduce((a, b) => a + b, 0n);
  for (let i = 0; i < Number(remaining); i++) shares[order[i].i] += 1n;
  return shares.map(String);
}
