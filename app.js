const DATA_URLS = {
  birthsDeaths: "https://ourworldindata.org/grapher/births-and-deaths-projected-to-2100.csv",
  birthsRegion: "https://ourworldindata.org/grapher/annual-number-of-births-by-world-region.csv",
  deathsRegion: "https://ourworldindata.org/grapher/annual-number-of-deaths-by-world-region.csv",
  population: "https://ourworldindata.org/grapher/population-long-run-with-projections.csv",
  populationHistoric: "https://ourworldindata.org/grapher/population.csv",
  ageGroups: "https://ourworldindata.org/grapher/population-by-five-year-age-group.csv",
  tfr: "https://ourworldindata.org/grapher/fertility-rate-with-projections.csv",
  tfrAlt: "https://ourworldindata.org/grapher/children-born-per-woman.csv",
  birthRate: "https://ourworldindata.org/grapher/long-run-birth-rate.csv",
  life: "https://ourworldindata.org/grapher/life-expectancy.csv",
  childMortality: "https://ourworldindata.org/grapher/youth-mortality-rate.csv",
  deathRatesByAge: "https://ourworldindata.org/grapher/annual-death-rates-in-different-age-groups.csv",
  growth: "https://ourworldindata.org/grapher/population-growth-rate.csv"
};

const MAX_AGE = 500;
const START_SIM_YEAR = 2022;
const AGE_GROUPS = [
  "0-4 years", "5-9 years", "10-14 years", "15-19 years", "20-24 years",
  "25-29 years", "30-34 years", "35-39 years", "40-44 years", "45-49 years",
  "50-54 years", "55-59 years", "60-64 years", "65-69 years", "70-74 years",
  "75-79 years", "80-84 years", "85-89 years", "90-94 years", "95-99 years", "100+ years"
];

const DEFAULT_ACTIVE_PANELS = ["population", "vitals", "fertility", "life", "absoluteGrowth", "mortality", "agePercentile"];

const FERTILITY_SCENARIOS = {
  replacement: { label: "2.1 forever", points: [{ year: 2030, tfr: 2.1 }, { year: 2100, tfr: 2.1 }] },
  unMedian: { label: "UN median", points: [{ year: 2030, tfr: 2.1 }, { year: 2050, tfr: 2.0 }, { year: 2100, tfr: 1.8 }] },
  recentTrend: { label: "Recent trend", points: [{ year: 2030, tfr: 2.0 }, { year: 2040, tfr: 1.75 }, { year: 2050, tfr: 1.6 }, { year: 2100, tfr: 1.5 }] },
  floorOne: { label: "Floor of 1", points: [{ year: 2030, tfr: 2.0 }, { year: 2040, tfr: 1.75 }, { year: 2050, tfr: 1.5 }, { year: 2070, tfr: 1.0 }, { year: 2100, tfr: 1.0 }] },
  noSocialRules: { label: "No social rules", points: [{ year: 2030, tfr: 2.0 }, { year: 2035, tfr: 1.9 }, { year: 2040, tfr: 1.6 }, { year: 2050, tfr: 1.2 }, { year: 2100, tfr: 1.0 }] }
};

const LIFE_SCENARIOS = {
  halt: { label: "Halt" },
  quarterForever: { label: "0.25 forever" },
  approaching95: { label: "Approaching 95" },
  slowLev: { label: "Slow LEV" },
  mediumLev: { label: "Medium LEV" },
  fastLev: { label: "Fast LEV" }
};

const DEFAULT_FERTILITY_SCENARIO = "recentTrend";
const DEFAULT_LIFE_SCENARIO = "mediumLev";
const DEFAULT_CHECKPOINTS = [
  { year: 2030, tfr: 2.0, life: 76, migration: 0.0, caution: 0.0 },
  { year: 2035, tfr: 1.875, life: 78.5, migration: 0.0, caution: 0.0 },
  { year: 2040, tfr: 1.75, life: 83.5, migration: 0.0, caution: 0.0 },
  { year: 2050, tfr: 1.6, life: 98.5, migration: 0.0, caution: 0.0 },
  { year: 2100, tfr: 1.5, life: 173.5, migration: 0.0, caution: 1.0 }
];

const PANELS = [
  ["population", "Total Population"],
  ["vitals", "Births and Deaths"],
  ["fertility", "TFR"],
  ["life", "Life Expectancy"],
  ["growth", "Growth Rate"],
  ["absoluteGrowth", "Absolute Growth"],
  ["migrationAbsolute", "Migration"],
  ["migrationRate", "Migration Per Mille"],
  ["mortality", "Death Curve"],
  ["pyramid", "Population Pyramid"],
  ["feelPyramid", "Feel-Age Comparison"],
  ["ageShare", "Age Share"],
  ["agePercentile", "Median / Percentile Age"],
  ["healthAge", "Feel Age"]
];

const mortalityCache = new Map();
const exposureCache = new Map();
const tfrAnchorCache = new Map();
const LOW_ESTIMATE_DEFAULT = true;
const REGION_ALIASES = {
  Africa: ["Africa", "Africa (UN)"],
  Asia: ["Asia", "Asia (UN)"],
  Europe: ["Europe", "Europe (UN)"],
  "North America": ["North America", "Northern America (UN)", "Americas (UN)"],
  "South America": ["South America", "Latin America and the Caribbean (UN)", "Americas (UN)"],
  Oceania: ["Oceania", "Oceania (UN)"],
  World: ["World"]
};

const GROUPS = {
  "European Union": ["Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden"],
  ASEAN: ["Brunei", "Cambodia", "Indonesia", "Laos", "Malaysia", "Myanmar", "Philippines", "Singapore", "Thailand", "Vietnam"],
  "Eastern Africa": ["Burundi", "Comoros", "Djibouti", "Eritrea", "Ethiopia", "Kenya", "Madagascar", "Malawi", "Mauritius", "Mozambique", "Rwanda", "Seychelles", "Somalia", "South Sudan", "Tanzania", "Uganda", "Zambia", "Zimbabwe"],
  "Middle Africa": ["Angola", "Cameroon", "Central African Republic", "Chad", "Congo", "Democratic Republic of Congo", "Equatorial Guinea", "Gabon", "Sao Tome and Principe"],
  "Northern Africa": ["Algeria", "Egypt", "Libya", "Morocco", "Sudan", "Tunisia", "Western Sahara"],
  "Southern Africa": ["Botswana", "Eswatini", "Lesotho", "Namibia", "South Africa"],
  "Western Africa": ["Benin", "Burkina Faso", "Cape Verde", "Cote d'Ivoire", "Gambia", "Ghana", "Guinea", "Guinea-Bissau", "Liberia", "Mali", "Mauritania", "Niger", "Nigeria", "Saint Helena", "Senegal", "Sierra Leone", "Togo"],
  Caribbean: ["Anguilla", "Antigua and Barbuda", "Aruba", "Bahamas", "Barbados", "British Virgin Islands", "Cayman Islands", "Cuba", "Curacao", "Dominica", "Dominican Republic", "Grenada", "Guadeloupe", "Haiti", "Jamaica", "Martinique", "Montserrat", "Puerto Rico", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Trinidad and Tobago", "Turks and Caicos Islands", "United States Virgin Islands"],
  "Central America": ["Belize", "Costa Rica", "El Salvador", "Guatemala", "Honduras", "Mexico", "Nicaragua", "Panama"],
  "Northern America": ["Bermuda", "Canada", "Greenland", "Saint Pierre and Miquelon", "United States"],
  "South America": ["Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador", "Falkland Islands", "French Guiana", "Guyana", "Paraguay", "Peru", "Suriname", "Uruguay", "Venezuela"],
  "Central Asia": ["Afghanistan", "Iran", "Kazakhstan", "Kyrgyzstan", "Tajikistan", "Turkmenistan", "Uzbekistan"],
  "Eastern Asia": ["China", "Hong Kong", "Japan", "Macao", "Mongolia", "North Korea", "South Korea", "Taiwan"],
  "South-eastern Asia": ["Brunei", "Cambodia", "Indonesia", "Laos", "Malaysia", "Myanmar", "Philippines", "Singapore", "Thailand", "East Timor", "Vietnam"],
  "Southern Asia": ["Bangladesh", "Bhutan", "India", "Maldives", "Nepal", "Pakistan", "Sri Lanka"],
  "Western Asia": ["Armenia", "Azerbaijan", "Bahrain", "Cyprus", "Georgia", "Iraq", "Israel", "Jordan", "Kuwait", "Lebanon", "Oman", "Palestine", "Qatar", "Saudi Arabia", "Syria", "Turkey", "United Arab Emirates", "Yemen"]
};

const state = {
  rows: {},
  byEntity: {},
  entities: [],
  checkpoints: structuredClone(DEFAULT_CHECKPOINTS),
  mode: "history",
  dynamic: true,
  dirty: false,
  activePanels: new Set(DEFAULT_ACTIVE_PANELS),
  fertilityScenario: DEFAULT_FERTILITY_SCENARIO,
  lifeScenario: DEFAULT_LIFE_SCENARIO,
  populationKeyExpanded: false,
  dynamicPyramidAge: false,
  dynamicFeelPyramidAge: false,
  mortalityCurves: [
    { type: "le", value: 75 },
    { type: "year", value: START_SIM_YEAR }
  ],
  scenario: [],
  historical: []
};

const el = {
  appShell: document.querySelector("#appShell"),
  dataStatus: document.querySelector("#dataStatus"),
  placeFlag: document.querySelector("#placeFlag"),
  entitySelect: document.querySelector("#entitySelect"),
  yearStart: document.querySelector("#yearStart"),
  yearEnd: document.querySelector("#yearEnd"),
  addCheckpoint: document.querySelector("#addCheckpoint"),
  checkpointList: document.querySelector("#checkpointList"),
  mortalityCurveType: document.querySelector("#mortalityCurveType"),
  mortalityCurveValue: document.querySelector("#mortalityCurveValue"),
  addMortalityCurve: document.querySelector("#addMortalityCurve"),
  mortalityCurveList: document.querySelector("#mortalityCurveList"),
  ageShareStart: document.querySelector("#ageShareStart"),
  ageShareEnd: document.querySelector("#ageShareEnd"),
  agePercentile: document.querySelector("#agePercentile"),
  pyramidYear: document.querySelector("#pyramidYear"),
  pyramidMaxAge: document.querySelector("#pyramidMaxAge"),
  feelPyramidYear: document.querySelector("#feelPyramidYear"),
  feelPyramidMaxAge: document.querySelector("#feelPyramidMaxAge"),
  healthLifeExpectancy: document.querySelector("#healthLifeExpectancy"),
  healthMaxAge: document.querySelector("#healthMaxAge"),
  zeroPopulation: document.querySelector("#zeroPopulation"),
  zeroVitals: document.querySelector("#zeroVitals"),
  zeroFertility: document.querySelector("#zeroFertility"),
  zeroLife: document.querySelector("#zeroLife"),
  zeroAbsoluteGrowth: document.querySelector("#zeroAbsoluteGrowth"),
  zeroMigrationAbsolute: document.querySelector("#zeroMigrationAbsolute"),
  zeroMigrationRate: document.querySelector("#zeroMigrationRate"),
  zeroAgePercentile: document.querySelector("#zeroAgePercentile"),
  panelToggles: document.querySelector("#panelToggles"),
  dashboard: document.querySelector("#dashboard"),
  updateCharts: document.querySelector("#updateCharts"),
  dynamicMode: document.querySelector("#dynamicMode"),
  resetLayout: document.querySelector("#resetLayout"),
  exportScenario: document.querySelector("#exportScenario"),
  sidebarResize: document.querySelector("#sidebarResize"),
  resetGraphs: document.querySelector("#resetGraphs"),
  resetZoomAll: document.querySelector("#resetZoomAll"),
  fertilityScenarios: document.querySelector("#fertilityScenarios"),
  lifeScenarios: document.querySelector("#lifeScenarios"),
  togglePopulationKey: document.querySelector("#togglePopulationKey"),
  populationKey: document.querySelector("#populationKey"),
  dynamicPyramidAge: document.querySelector("#dynamicPyramidAge"),
  dynamicFeelPyramidAge: document.querySelector("#dynamicFeelPyramidAge")
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (c === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") {
      cell += c;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows.shift();
  return rows.filter((r) => r.length === headers.length).map((r) => {
    const obj = {};
    headers.forEach((h, i) => {
      const value = r[i];
      const numeric = value !== "" && value !== null && !Number.isNaN(Number(value));
      obj[h] = numeric && h !== "Code" && h !== "Entity" ? Number(value) : value;
    });
    return obj;
  });
}

async function loadDataset(name, url) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${name}: ${res.status}`);
      return parseCsv(await res.text());
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }
  throw lastError;
}

function indexRows(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.Entity)) map.set(row.Entity, new Map());
    map.get(row.Entity).set(Number(row.Year), row);
  }
  return map;
}

function rowFor(dataset, entity, year) {
  const map = state.byEntity[dataset];
  return map?.get(entity)?.get(Number(year));
}

function rowForAnyEntity(dataset, entity, year) {
  for (const candidate of entityCandidates(entity)) {
    const row = rowFor(dataset, candidate, year);
    if (row) return row;
  }
  return null;
}

function entityCandidates(entity) {
  return REGION_ALIASES[entity] || [entity];
}

function groupMembers(entity) {
  return (GROUPS[entity] || []).filter((member) => state.byEntity.population?.has(member) || state.byEntity.populationHistoric?.has(member));
}

function isGroupEntity(entity) {
  return groupMembers(entity).length > 0;
}

function aggregateSum(entity, year, getter) {
  const members = groupMembers(entity);
  if (!members.length) return null;
  const values = members.map((member) => getter(member, year)).filter(Number.isFinite);
  return values.length ? values.reduce((a, b) => a + b, 0) : null;
}

function aggregateWeighted(entity, year, getter) {
  const members = groupMembers(entity);
  let numerator = 0;
  let denominator = 0;
  for (const member of members) {
    const population = getPopulation(member, year);
    const value = getter(member, year);
    if (Number.isFinite(population) && population > 0 && Number.isFinite(value)) {
      numerator += value * population;
      denominator += population;
    }
  }
  return denominator > 0 ? numerator / denominator : null;
}

function valueForAny(dataset, entity, year, columns, interpolate = true) {
  for (const candidate of entityCandidates(entity)) {
    const value = valueFor(dataset, candidate, year, columns, interpolate);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function finiteYearsFor(dataset, entity, columns) {
  const cols = Array.isArray(columns) ? columns : [columns];
  const years = [];
  for (const candidate of entityCandidates(entity)) {
    const entityMap = state.byEntity[dataset]?.get(candidate);
    if (!entityMap) continue;
    for (const [year, row] of entityMap.entries()) {
      if (cols.some((col) => Number.isFinite(row?.[col]))) years.push(year);
    }
  }
  return [...new Set(years)].sort((a, b) => a - b);
}

function valueWithinObservedRange(dataset, entity, year, columns) {
  const years = finiteYearsFor(dataset, entity, columns);
  if (!years.length || year < years[0] || year > years[years.length - 1]) return null;
  return valueForAny(dataset, entity, year, columns);
}

function valueFor(dataset, entity, year, columns, interpolate = true) {
  const exact = rowFor(dataset, entity, year);
  const cols = Array.isArray(columns) ? columns : [columns];
  for (const col of cols) {
    const value = exact?.[col];
    if (Number.isFinite(value)) return value;
  }
  if (!interpolate) return null;

  const entityMap = state.byEntity[dataset]?.get(entity);
  if (!entityMap) return null;
  const years = [...entityMap.keys()].sort((a, b) => a - b);
  let before = null;
  let after = null;
  for (const y of years) {
    const has = cols.some((col) => Number.isFinite(entityMap.get(y)?.[col]));
    if (!has) continue;
    if (y < year) before = y;
    if (y > year) {
      after = y;
      break;
    }
  }
  if (before === null && after === null) return null;
  if (before === null) return firstFinite(entityMap.get(after), cols);
  if (after === null) return firstFinite(entityMap.get(before), cols);
  const a = firstFinite(entityMap.get(before), cols);
  const b = firstFinite(entityMap.get(after), cols);
  const t = (year - before) / (after - before);
  return a + (b - a) * t;
}

function firstFinite(row, cols) {
  for (const col of cols) {
    if (Number.isFinite(row?.[col])) return row[col];
  }
  return null;
}

function formatNumber(n, compact = true) {
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: n >= 10 ? 1 : 2
  }).format(n);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function checkpointValue(year, key, entity = el.entitySelect.value || "World") {
  return valueFromCheckpoints(state.checkpoints, year, key, entity);
}

function valueFromCheckpoints(checkpoints, year, key, entity = el.entitySelect.value || "World") {
  const baseline = {
    year: START_SIM_YEAR,
    tfr: observedTfr(entity, START_SIM_YEAR) ?? observedTfr(entity, START_SIM_YEAR - 1) ?? 2.2,
    life: getLife(entity, START_SIM_YEAR) ?? getLife(entity, START_SIM_YEAR - 1) ?? 73,
    migration: 0,
    caution: 0
  };
  const points = [baseline, ...checkpoints.filter((p) => p.year > START_SIM_YEAR)].sort((a, b) => a.year - b.year);
  if (year <= points[0].year) return points[0][key];
  if (year >= points[points.length - 1].year) return points[points.length - 1][key];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (year >= a.year && year <= b.year) {
      return lerp(a[key], b[key], (year - a.year) / (b.year - a.year));
    }
  }
  return points[points.length - 1][key];
}

function diseaseHazard(age, shift) {
  if (age < 20) return 0.00004;
  const makeham = 0.00018;
  const gompertz = 0.00022 * Math.exp(0.088 * (age - 45 - shift));
  return makeham + gompertz;
}

function childExternalHazard(age, targetLife) {
  const lowLife = clamp((82 - targetLife) / 45, 0, 1);
  const highLife = clamp((targetLife - 85) / 70, 0, 1);
  const infant = (0.003 + 0.14 * lowLife) * Math.exp(-age / 1.65);
  const child = 0.00012 + 0.012 * lowLife * Math.exp(-Math.max(age - 1, 0) / 7);
  const external = (0.00034 + 0.0018 * lowLife) * Math.exp(-Math.pow((age - 24) / 17, 2));
  const senescenceFloor = highLife * 0.00003;
  return infant + child + external + senescenceFloor;
}

function buildMortalityCurve(targetLife, kind = "general") {
  const cacheKey = `${kind}:${Number(targetLife).toFixed(2)}`;
  if (mortalityCache.has(cacheKey)) return mortalityCache.get(cacheKey);
  let lo = -120;
  let hi = 650;
  for (let i = 0; i < 46; i += 1) {
    const mid = (lo + hi) / 2;
    const life = lifeExpectancyFromRates(buildRates(targetLife, mid, kind));
    if (life < targetLife) lo = mid;
    else hi = mid;
  }
  const rates = buildRates(targetLife, (lo + hi) / 2, kind);
  mortalityCache.set(cacheKey, rates);
  return rates;
}

function applyCaution(qx, caution) {
  const reduction = clamp(Number(caution) || 0, 0, 1) / 1000;
  return qx.map((q) => normalizedDeathRate(q - reduction));
}

function normalizedDeathRate(q) {
  return clamp(Number.isFinite(q) ? q : 0, 0, 0.999999);
}

function deathsByAge(cohorts, qx) {
  return cohorts.map((cohort, age) => Math.max(0, cohort || 0) * normalizedDeathRate(qx[age]));
}

function scaleDeathsToTarget(ageDeaths, cohorts, targetDeaths) {
  if (!Number.isFinite(targetDeaths)) return ageDeaths;
  const available = cohorts.reduce((sum, cohort) => sum + Math.max(0, cohort || 0), 0);
  const target = clamp(targetDeaths, 0, available);
  const current = ageDeaths.reduce((a, b) => a + b, 0);
  if (current <= 0 || target <= 0) return ageDeaths.map(() => 0);
  const factor = target / current;
  const scaled = ageDeaths.map((death, age) => Math.min(Math.max(0, cohorts[age] || 0), death * factor));
  for (let pass = 0; pass < 6; pass += 1) {
    const total = scaled.reduce((a, b) => a + b, 0);
    const remainder = target - total;
    if (Math.abs(remainder) < 0.001) break;
    if (remainder > 0) {
      const capacity = scaled.map((death, age) => Math.max(0, (cohorts[age] || 0) - death));
      const denom = capacity.reduce((a, b) => a + b, 0);
      if (denom <= 0) break;
      for (let age = 0; age <= MAX_AGE; age += 1) {
        scaled[age] += Math.min(capacity[age], remainder * capacity[age] / denom);
      }
    } else {
      const denom = scaled.reduce((a, b) => a + b, 0);
      if (denom <= 0) break;
      for (let age = 0; age <= MAX_AGE; age += 1) {
        scaled[age] = Math.max(0, scaled[age] + remainder * scaled[age] / denom);
      }
    }
  }
  return scaled;
}

function mortalityAgeLimit(life, startAge = 0, kind = "general") {
  const qx = buildMortalityCurve(life || 75, kind);
  for (let age = startAge; age <= MAX_AGE; age += 1) {
    if ((qx[age] || 0) >= 0.99) return age;
  }
  return MAX_AGE;
}

function buildRates(targetLife, shift, kind) {
  const rates = [];
  for (let age = 0; age <= MAX_AGE; age += 1) {
    const disease = diseaseHazard(age, shift);
    const external = kind === "disease" ? 0 : childExternalHazard(age, targetLife);
    const hazard = disease + external;
    rates.push(clamp(1 - Math.exp(-hazard), 0.000001, 0.995));
  }
  rates[MAX_AGE] = 0.995;
  return rates;
}

function lifeExpectancyFromRates(qx) {
  let survivors = 1;
  let years = 0;
  for (let age = 0; age < qx.length; age += 1) {
    years += survivors;
    survivors *= 1 - qx[age];
  }
  return years;
}

function survivalToAge(qx, ageLimit) {
  let s = 1;
  for (let age = 0; age < ageLimit; age += 1) {
    s *= 1 - qx[age];
  }
  return s;
}

function feelAgeFor(actualAge, life) {
  if (actualAge < 20) return actualAge;
  const scenario = buildMortalityCurve(life, "disease");
  const baseline = buildMortalityCurve(75, "disease");
  const target = scenario[Math.round(clamp(actualAge, 0, MAX_AGE))];
  for (let age = 20; age < MAX_AGE; age += 1) {
    const a = baseline[age];
    const b = baseline[age + 1];
    if (target >= a && target <= b) {
      return age + (target - a) / (b - a);
    }
  }
  return target < baseline[20] ? 20 : MAX_AGE;
}

function rowHasAgeGroups(row) {
  return AGE_GROUPS.some((name) => Number.isFinite(row?.[name]));
}

function ageGroupRowFor(entity, year) {
  for (const candidate of entityCandidates(entity)) {
    const row = rowFor("ageGroups", candidate, year);
    if (rowHasAgeGroups(row)) return row;
  }
  return null;
}

function nearestAgeGroupYear(entity, year) {
  const years = [];
  for (const candidate of entityCandidates(entity)) {
    const entityMap = state.byEntity.ageGroups?.get(candidate);
    if (!entityMap) continue;
    for (const [candidateYear, row] of entityMap.entries()) {
      if (rowHasAgeGroups(row)) years.push(candidateYear);
    }
  }
  const unique = [...new Set(years)].sort((a, b) => a - b);
  if (!unique.length) return null;
  let best = null;
  for (const candidateYear of unique) {
    if (candidateYear <= year) best = candidateYear;
    else break;
  }
  return best;
}

function fiveYearToSingleAge(entity, year) {
  if (isGroupEntity(entity)) {
    const cohorts = Array(MAX_AGE + 1).fill(0);
    for (const member of groupMembers(entity)) {
      const memberCohorts = fiveYearToSingleAge(member, year);
      for (let age = 0; age <= MAX_AGE; age += 1) cohorts[age] += memberCohorts[age] || 0;
    }
    return cohorts;
  }
  const cohorts = Array(MAX_AGE + 1).fill(0);
  const sourceYear = nearestAgeGroupYear(entity, year);
  const row = ageGroupRowFor(entity, year)
    || (sourceYear !== null ? ageGroupRowFor(entity, sourceYear) : null)
    || ageGroupRowFor("World", START_SIM_YEAR)
    || ageGroupRowFor("World", 2023);
  if (!row) {
    const pop = getPopulation(entity, year) || getPopulation("World", year) || 1;
    cohorts[0] = pop;
    return cohorts;
  }

  const densities = AGE_GROUPS.map((name, i) => {
    const count = Number(row[name]) || 0;
    const width = name === "100+ years" ? 25 : 5;
    const center = name === "100+ years" ? 112 : i * 5 + 2;
    return { center, density: count / width };
  });
  for (let age = 0; age < 100; age += 1) {
    const lower = densities.findLast((d) => d.center <= age) || densities[0];
    const upper = densities.find((d) => d.center >= age) || densities[densities.length - 1];
    const t = upper.center === lower.center ? 0 : (age - lower.center) / (upper.center - lower.center);
    cohorts[age] = Math.max(0, lerp(lower.density, upper.density, clamp(t, 0, 1)));
  }
  const oldDensity = densities[densities.length - 1].density;
  for (let age = 100; age <= MAX_AGE; age += 1) {
    cohorts[age] = oldDensity * Math.exp(-(age - 100) / 9);
  }
  const sourceTotal = AGE_GROUPS.reduce((sum, name) => sum + (Number(row[name]) || 0), 0);
  const smoothedTotal = cohorts.reduce((a, b) => a + b, 0);
  if (sourceTotal > 0 && smoothedTotal > 0) {
    for (let age = 0; age <= MAX_AGE; age += 1) cohorts[age] *= sourceTotal / smoothedTotal;
  }
  return cohorts;
}

function modeledCohorts(entity, year, population) {
  const qx = buildMortalityCurve(getLife(entity, year) || 55, "general");
  const r = clamp(populationGrowthFraction(entity, year), -0.025, 0.04);
  const weights = Array(MAX_AGE + 1).fill(0);
  let survivors = 1;
  for (let age = 0; age <= MAX_AGE; age += 1) {
    weights[age] = survivors * Math.exp(-r * age);
    survivors *= 1 - qx[age];
  }
  const total = weights.reduce((a, b) => a + b, 0);
  return total > 0 ? weights.map((v) => v * (population || 0) / total) : weights;
}

function cohortsForYear(entity, year, population = getPopulation(entity, year)) {
  if (isGroupEntity(entity)) {
    const cohorts = Array(MAX_AGE + 1).fill(0);
    for (const member of groupMembers(entity)) {
      const memberCohorts = cohortsForYear(member, year, getPopulation(member, year));
      for (let age = 0; age <= MAX_AGE; age += 1) cohorts[age] += memberCohorts[age] || 0;
    }
    const total = cohorts.reduce((a, b) => a + b, 0);
    if (Number.isFinite(population) && population > 0 && total > 0) {
      return cohorts.map((v) => v * population / total);
    }
    return cohorts;
  }
  const sourceYear = nearestAgeGroupYear(entity, year);
  let cohorts = sourceYear !== null ? fiveYearToSingleAge(entity, year) : modeledCohorts(entity, year, population);
  const total = cohorts.reduce((a, b) => a + b, 0);
  if (Number.isFinite(population) && population > 0 && total > 0) {
    cohorts = cohorts.map((v) => v * population / total);
  }
  return cohorts;
}

function selectedPercentile() {
  return clamp(Number(el.agePercentile?.value) || 50, 0, 100);
}

function percentileLabel(percentile) {
  return Number(percentile).toLocaleString("en", { maximumFractionDigits: 1 });
}

function percentileAge(cohorts, percentile = 50) {
  const total = cohorts.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  const target = total * clamp(percentile, 0, 100) / 100;
  let cumulative = 0;
  for (let age = 0; age <= MAX_AGE; age += 1) {
    const value = cohorts[age] || 0;
    const next = cumulative + value;
    if (target <= next) {
      const within = value > 0 ? (target - cumulative) / value : 0;
      return clamp(age + within, 0, MAX_AGE);
    }
    cumulative = next;
  }
  return MAX_AGE;
}

function agePercentileMetrics(cohorts, life) {
  const percentile = selectedPercentile();
  return {
    percentileAge: percentileAge(cohorts, percentile),
    adjustedPercentileAge: percentileAge(feelDistribution(cohorts, life || 75), percentile)
  };
}

function fertilityWeight(age) {
  if (age < 15 || age > 49) return 0;
  const early = Math.exp(-Math.pow((age - 28) / 7.8, 2));
  const late = 0.35 * Math.exp(-Math.pow((age - 35) / 5.8, 2));
  return early + late;
}

const FERTILITY_DENOMINATOR = Array.from({ length: MAX_AGE + 1 }, (_, age) => fertilityWeight(age)).reduce((a, b) => a + b, 0);

function simulateBirths(cohorts, tfr) {
  let weightedWomen = 0;
  for (let age = 15; age <= 49; age += 1) {
    weightedWomen += cohorts[age] * 0.5 * fertilityWeight(age);
  }
  return (tfr / FERTILITY_DENOMINATOR) * weightedWomen;
}

function distributeMigration(cohorts, totalMigration) {
  const out = cohorts.slice();
  const profile = cohorts.map((_, age) => {
    const workingAge = Math.exp(-Math.pow((age - 29) / 18, 2));
    const family = 0.45 * Math.exp(-Math.pow((age - 7) / 9, 2));
    return 0.2 + workingAge + family;
  });
  const denom = profile.reduce((a, b) => a + b, 0);
  for (let age = 0; age <= MAX_AGE; age += 1) out[age] += totalMigration * profile[age] / denom;
  return out.map((v) => Math.max(0, v));
}

function advanceCohorts(cohorts, births, qx, migrationPermille, options = {}) {
  const total = cohorts.reduce((a, b) => a + b, 0);
  let deaths = 0;
  const ageDeaths = scaleDeathsToTarget(deathsByAge(cohorts, qx), cohorts, options.targetDeaths);
  const next = Array(MAX_AGE + 1).fill(0);
  next[0] = births;
  for (let age = 0; age < MAX_AGE; age += 1) {
    const d = ageDeaths[age];
    deaths += d;
    next[age + 1] += Math.max(0, (cohorts[age] || 0) - d);
  }
  const oldDeaths = ageDeaths[MAX_AGE];
  deaths += oldDeaths;
  next[MAX_AGE] += Math.max(0, (cohorts[MAX_AGE] || 0) - oldDeaths);
  const migrated = distributeMigration(next, total * migrationPermille / 1000);
  return { cohorts: migrated, deaths };
}

function getPopulation(entity, year) {
  if (isGroupEntity(entity)) return aggregateSum(entity, year, getPopulation);
  return valueForAny("population", entity, year, ["Population", "Population (projections) (Projected)"])
    ?? valueForAny("populationHistoric", entity, year, "Population");
}

function getBirths(entity, year) {
  if (isGroupEntity(entity)) return aggregateSum(entity, year, getBirths);
  const direct = valueForAny("birthsDeaths", entity, year, ["Births", "Projected births (Projected)"], false);
  const regional = valueForAny("birthsRegion", entity, year, "Births", false);
  const directValues = [direct, regional].filter(Number.isFinite);
  if (directValues.length) return LOW_ESTIMATE_DEFAULT ? Math.min(...directValues) : directValues[0];
  const pop = getPopulation(entity, year);
  const rate = valueWithinObservedRange("birthRate", entity, year, "Birth rate");
  const rateBirths = pop && rate ? pop * rate / 1000 : null;
  const modeled = modelBirths(entity, year);
  const values = [rateBirths, modeled].filter(Number.isFinite);
  if (!values.length) return null;
  return LOW_ESTIMATE_DEFAULT ? Math.min(...values) : values[0];
}

function getDeaths(entity, year) {
  if (isGroupEntity(entity)) return aggregateSum(entity, year, getDeaths);
  const direct = valueForAny("birthsDeaths", entity, year, ["Deaths", "Projected deaths (Projected)"], false);
  const regional = valueForAny("deathsRegion", entity, year, "Deaths", false);
  if (Number.isFinite(direct) || Number.isFinite(regional)) {
    return Number.isFinite(direct) ? direct : regional;
  }
  const births = getBirths(entity, year);
  const pop = getPopulation(entity, year);
  const nextPop = getPopulation(entity, year + 1);
  if (Number.isFinite(births) && Number.isFinite(pop) && Number.isFinite(nextPop)) {
    return Math.max(0, births - (nextPop - pop));
  }
  return modelDeaths(entity, year);
}

function observedTfr(entity, year) {
  const a = valueForAny("tfr", entity, year, ["Fertility rate (estimates)", "Fertility rate (projections) (Projected)"], false);
  const b = valueForAny("tfrAlt", entity, year, "Total fertility rate", false);
  const values = [a, b].filter(Number.isFinite);
  if (!values.length) return null;
  return LOW_ESTIMATE_DEFAULT ? Math.min(...values) : values[0];
}

function stableReproductiveExposure(life, growthRate) {
  const cacheKey = `${Number(life || 55).toFixed(2)}:${Number(growthRate || 0).toFixed(3)}`;
  if (exposureCache.has(cacheKey)) return exposureCache.get(cacheKey);
  const qx = buildMortalityCurve(life || 55, "general");
  const r = clamp((growthRate || 0) / 100, -0.025, 0.04);
  let survivors = 1;
  let total = 0;
  let weightedFertile = 0;
  for (let age = 0; age <= MAX_AGE; age += 1) {
    const stableWeight = survivors * Math.exp(-r * age);
    total += stableWeight;
    weightedFertile += stableWeight * 0.5 * fertilityWeight(age);
    survivors *= 1 - qx[age];
  }
  const exposure = total > 0 ? weightedFertile / total : 0.16;
  exposureCache.set(cacheKey, exposure);
  return exposure;
}

function stableDeathRate(life, growthRate) {
  const qx = buildMortalityCurve(life || 55, "general");
  const r = clamp((growthRate || 0) / 100, -0.025, 0.04);
  let survivors = 1;
  let total = 0;
  let deaths = 0;
  for (let age = 0; age <= MAX_AGE; age += 1) {
    const stableWeight = survivors * Math.exp(-r * age);
    total += stableWeight;
    deaths += stableWeight * qx[age];
    survivors *= 1 - qx[age];
  }
  const modeled = total > 0 ? deaths / total : 0.02;
  const historicalFloor = Number.isFinite(life) && life < 65 ? 0.95 / Math.max(life, 18) : 0;
  return Math.max(modeled, historicalFloor);
}

function populationGrowthFraction(entity, year) {
  const population = getPopulation(entity, year);
  const previousPopulation = getPopulation(entity, year - 1);
  const nextPopulation = getPopulation(entity, year + 1);
  if (Number.isFinite(population) && Number.isFinite(previousPopulation) && previousPopulation > 0) {
    return population / previousPopulation - 1;
  }
  if (Number.isFinite(population) && Number.isFinite(nextPopulation) && population > 0) {
    return nextPopulation / population - 1;
  }
  return 0;
}

function modelDeaths(entity, year) {
  const population = getPopulation(entity, year);
  if (!Number.isFinite(population) || population <= 0) return null;
  const life = getLife(entity, year);
  const deathRate = stableDeathRate(life, populationGrowthFraction(entity, year) * 100);
  return population * clamp(deathRate, 0.003, 0.08);
}

function modelBirths(entity, year) {
  const population = getPopulation(entity, year);
  if (!Number.isFinite(population) || population <= 0) return null;
  const growth = populationGrowthFraction(entity, year);
  const deathRate = stableDeathRate(getLife(entity, year), growth * 100);
  return population * clamp(deathRate + growth, 0.006, 0.075);
}

function modelTfrFromBirths(entity, year) {
  const births = getBirths(entity, year);
  const population = getPopulation(entity, year);
  if (!Number.isFinite(births) || !Number.isFinite(population) || population <= 0) return null;
  const previousPopulation = getPopulation(entity, year - 1);
  const nextPopulation = getPopulation(entity, year + 1);
  let growth = 0;
  if (Number.isFinite(previousPopulation) && previousPopulation > 0) growth = (population / previousPopulation - 1) * 100;
  else if (Number.isFinite(nextPopulation) && nextPopulation > 0) growth = (nextPopulation / population - 1) * 100;
  const life = getLife(entity, year);
  const exposure = stableReproductiveExposure(life, growth);
  if (exposure <= 0) return null;
  return clamp((births / population) * FERTILITY_DENOMINATOR / exposure, 0.4, 8.5);
}

function firstObservedTfrYear(entity) {
  if (tfrAnchorCache.has(entity)) return tfrAnchorCache.get(entity);
  const years = [
    ...finiteYearsFor("tfr", entity, ["Fertility rate (estimates)", "Fertility rate (projections) (Projected)"]),
    ...finiteYearsFor("tfrAlt", entity, "Total fertility rate")
  ].filter((year) => Number.isFinite(observedTfr(entity, year))).sort((a, b) => a - b);
  const year = years[0] ?? null;
  tfrAnchorCache.set(entity, year);
  return year;
}

function estimatedTfr(entity, year) {
  const modeled = modelTfrFromBirths(entity, year);
  if (!Number.isFinite(modeled)) return null;
  const anchorYear = firstObservedTfrYear(entity);
  if (!Number.isFinite(anchorYear) || year >= anchorYear) return modeled;
  const anchorObserved = observedTfr(entity, anchorYear);
  const anchorModeled = modelTfrFromBirths(entity, anchorYear);
  if (!Number.isFinite(anchorObserved) || !Number.isFinite(anchorModeled) || anchorModeled <= 0) return modeled;
  const ratio = clamp(anchorObserved / anchorModeled, 0.65, 1.45);
  const distance = anchorYear - year;
  const correction = 1 + (ratio - 1) * Math.exp(-distance / 85);
  return clamp(modeled * correction, 0.4, 8.5);
}

function getTfr(entity, year) {
  return observedTfr(entity, year) ?? estimatedTfr(entity, year);
}

function getLife(entity, year) {
  if (isGroupEntity(entity)) {
    const weighted = aggregateWeighted(entity, year, getLife);
    if (Number.isFinite(weighted)) return weighted;
  }
  const exact = valueForAny("life", entity, year, "Life expectancy", false);
  if (Number.isFinite(exact)) return exact;
  const years = finiteYearsFor("life", entity, "Life expectancy");
  if (years.length) {
    const firstYear = years[0];
    const lastYear = years[years.length - 1];
    if (year < firstYear) {
      const firstLife = valueForAny("life", entity, firstYear, "Life expectancy", false);
      return clamp(firstLife - Math.sqrt(firstYear - year) * 2.2, 24, firstLife);
    }
    if (year > lastYear) {
      const latest = valueForAny("life", entity, lastYear, "Life expectancy", false);
      return Number.isFinite(latest) ? latest + (year - lastYear) * 0.18 : 73;
    }
  }
  const interpolated = valueForAny("life", entity, year, "Life expectancy");
  if (Number.isFinite(interpolated)) return interpolated;
  const world = valueForAny("life", "World", year, "Life expectancy");
  return Number.isFinite(world) ? world : clamp(28 + (year - 1800) * 0.16, 24, 73);
}

function getChildMortality(entity, year, life) {
  const qx = buildMortalityCurve(life || 73, "general");
  return (1 - survivalToAge(qx, 15)) * 100;
}

function lifeWithRateSchedule(baseLife, targetYear, schedule) {
  let life = baseLife;
  let cursor = START_SIM_YEAR;
  for (const segment of schedule) {
    const until = Math.min(targetYear, segment.until);
    if (until > cursor) {
      life += (until - cursor) * segment.rate;
      cursor = until;
    }
    if (targetYear <= segment.until) break;
  }
  return clamp(life, 1, MAX_AGE);
}

function lifeScenarioPoints(key, entity = el.entitySelect.value || "World") {
  const baseLife = getLife(entity, START_SIM_YEAR) ?? getLife(entity, START_SIM_YEAR - 1) ?? 74;
  const point = (year, life) => ({ year, life: clamp(life, 1, MAX_AGE) });
  if (key === "halt") {
    return [2030, 2100].map((year) => point(year, baseLife));
  }
  if (key === "quarterForever") {
    return [2030, 2050, 2100, 2400].map((year) => point(year, baseLife + (year - START_SIM_YEAR) * 0.25));
  }
  if (key === "approaching95") {
    const years = [2030, 2050, 2100, 2400];
    return years.map((year) => {
      let life = baseLife;
      let cursor = START_SIM_YEAR;
      if (life < 85) {
        const yearsTo85 = (85 - life) / 0.25;
        const end = Math.min(year, cursor + yearsTo85);
        life += Math.max(0, end - cursor) * 0.25;
        cursor = end;
      }
      if (year > cursor && life < 95) {
        const yearsTo95 = (95 - life) / 0.1;
        const end = Math.min(year, cursor + yearsTo95);
        life += Math.max(0, end - cursor) * 0.1;
      }
      return point(year, Math.min(life, 95));
    });
  }
  if (key === "slowLev") {
    const schedule = [{ until: 2030, rate: 0.25 }, { until: 2035, rate: 0.4 }, { until: 2040, rate: 0.8 }, { until: 2400, rate: 1.2 }];
    return [2030, 2035, 2040, 2050, 2100, 2400].map((year) => point(year, lifeWithRateSchedule(baseLife, year, schedule)));
  }
  if (key === "fastLev") {
    return [
      point(2030, baseLife + (2030 - START_SIM_YEAR) * 0.25),
      point(2035, baseLife + 8 * 0.25 + 5 * 0.8),
      point(2040, baseLife + 8 * 0.25 + 5 * 0.8 + 5 * 1.5),
      point(2050, 150),
      point(2100, 225),
      point(2400, 500)
    ];
  }
  const schedule = [{ until: 2030, rate: 0.25 }, { until: 2035, rate: 0.5 }, { until: 2040, rate: 1.0 }, { until: 2400, rate: 1.5 }];
  return [2030, 2035, 2040, 2050, 2100, 2400].map((year) => point(year, lifeWithRateSchedule(baseLife, year, schedule)));
}

function fertilityScenarioPoints(key) {
  return FERTILITY_SCENARIOS[key]?.points || FERTILITY_SCENARIOS[DEFAULT_FERTILITY_SCENARIO].points;
}

function valueFromScenarioPoints(points, year, key, fallback) {
  const sorted = points.slice().sort((a, b) => a.year - b.year);
  if (!sorted.length) return fallback;
  if (year <= sorted[0].year) return sorted[0][key];
  if (year >= sorted[sorted.length - 1].year) return sorted[sorted.length - 1][key];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (year >= a.year && year <= b.year) {
      return lerp(a[key], b[key], (year - a.year) / (b.year - a.year));
    }
  }
  return fallback;
}

function applyCheckpointScenario({ fertilityKey = state.fertilityScenario, lifeKey = state.lifeScenario, updateFertility = true, updateLife = true } = {}) {
  const entity = el.entitySelect.value || "World";
  const previous = structuredClone(state.checkpoints);
  const fertilityPoints = updateFertility ? fertilityScenarioPoints(fertilityKey) : [];
  const lifePoints = updateLife ? lifeScenarioPoints(lifeKey, entity) : [];
  const years = [...new Set([
    ...previous.map((p) => p.year),
    ...fertilityPoints.map((p) => p.year),
    ...lifePoints.map((p) => p.year)
  ])].sort((a, b) => a - b);

  state.checkpoints = years.map((year) => ({
    year,
    tfr: updateFertility
      ? valueFromScenarioPoints(fertilityPoints, year, "tfr", valueFromCheckpoints(previous, year, "tfr", entity))
      : valueFromCheckpoints(previous, year, "tfr", entity),
    life: updateLife
      ? valueFromScenarioPoints(lifePoints, year, "life", valueFromCheckpoints(previous, year, "life", entity))
      : valueFromCheckpoints(previous, year, "life", entity),
    migration: valueFromCheckpoints(previous, year, "migration", entity),
    caution: valueFromCheckpoints(previous, year, "caution", entity)
  }));
  if (updateFertility) state.fertilityScenario = fertilityKey;
  if (updateLife) state.lifeScenario = lifeKey;
  sortCheckpointsByYear();
  setupCheckpoints();
  renderScenarioButtons();
  scheduleRender();
}

function clampAnnualCount(count, population, minRate, maxRate) {
  if (!Number.isFinite(count) || !Number.isFinite(population) || population <= 0) return count;
  return clamp(count, population * minRate, population * maxRate);
}

function buildHistorical(entity, start, end) {
  const rows = [];
  for (let year = start; year <= Math.min(end, START_SIM_YEAR); year += 1) {
    const population = getPopulation(entity, year);
    const births = clampAnnualCount(getBirths(entity, year), population, 0.004, 0.075);
    const deaths = clampAnnualCount(getDeaths(entity, year), population, 0.002, 0.09);
    const tfr = getTfr(entity, year);
    const life = getLife(entity, year);
    const childMortality = getChildMortality(entity, year, life);
    const adjustedTfr = Number.isFinite(tfr) ? tfr * (1 - childMortality / 100) : null;
    const cohorts = cohortsForYear(entity, year, population);
    const ageMetrics = agePercentileMetrics(cohorts, life);
    const previousPopulation = year === start ? null : getPopulation(entity, year - 1);
    const nextPopulation = getPopulation(entity, year + 1);
    const absoluteGrowth = Number.isFinite(population) && Number.isFinite(previousPopulation)
      ? population - previousPopulation
      : Number.isFinite(population) && Number.isFinite(nextPopulation)
      ? nextPopulation - population
      : null;
    const growth = Number.isFinite(absoluteGrowth) && Number.isFinite(population) && population > 0 ? absoluteGrowth / population * 100 : null;
    let migrationAbsolute = entity === "World" && year <= START_SIM_YEAR
      ? 0
      : Number.isFinite(absoluteGrowth) && Number.isFinite(births) && Number.isFinite(deaths)
      ? absoluteGrowth - births + deaths
      : null;
    if (Number.isFinite(migrationAbsolute) && Number.isFinite(population) && population > 0) {
      migrationAbsolute = clamp(migrationAbsolute, -population * 0.08, population * 0.08);
    }
    const migration = Number.isFinite(migrationAbsolute) && Number.isFinite(population) && population > 0
      ? migrationAbsolute / population * 1000
      : null;
    rows.push({ year, population, births, deaths, tfr, adjustedTfr, life, childMortality, growth, absoluteGrowth, migration, migrationAbsolute, cohorts, ageShare: ageIntervalShare(cohorts), ...ageMetrics, source: year > START_SIM_YEAR ? "projection" : "estimate" });
  }
  return rows;
}

function buildScenario(entity, start, end) {
  const seedYear = START_SIM_YEAR;
  let cohorts = cohortsForYear(entity, seedYear, getPopulation(entity, seedYear));
  const actualSeedTotal = cohorts.reduce((a, b) => a + b, 0);
  const targetSeedTotal = getPopulation(entity, seedYear) || actualSeedTotal;
  if (actualSeedTotal > 0) cohorts = cohorts.map((v) => v * targetSeedTotal / actualSeedTotal);

  const rows = [];
  for (let year = seedYear; year < start; year += 1) {
    const tfr = getTfr(entity, year) ?? checkpointValue(year, "tfr", entity);
    const life = getLife(entity, year);
    const qx = buildMortalityCurve(life, "general");
    const births = simulateBirths(cohorts, tfr);
    const advanced = advanceCohorts(cohorts, births, qx, 0);
    cohorts = advanced.cohorts;
  }

  for (let year = start; year <= end; year += 1) {
    if (year === START_SIM_YEAR) {
      const population = getPopulation(entity, year) || cohorts.reduce((a, b) => a + b, 0);
      const cohortTotal = cohorts.reduce((a, b) => a + b, 0);
      if (population > 0 && cohortTotal > 0) cohorts = cohorts.map((v) => v * population / cohortTotal);
      const births = getBirths(entity, year);
      const deaths = getDeaths(entity, year);
      const tfr = getTfr(entity, year) ?? checkpointValue(year, "tfr", entity);
      const life = getLife(entity, year);
      const childMortality = getChildMortality(entity, year, life);
      const ageMetrics = agePercentileMetrics(cohorts, life);
      rows.push({
        year,
        population,
        births,
        deaths,
        tfr,
        adjustedTfr: tfr * (1 - childMortality / 100),
        life,
        childMortality,
        growth: null,
        absoluteGrowth: null,
        migration: entity === "World" ? 0 : checkpointValue(year, "migration", entity),
        migrationAbsolute: entity === "World" ? 0 : population * checkpointValue(year, "migration", entity) / 1000,
        caution: checkpointValue(year, "caution", entity),
        cohorts: cohorts.slice(),
        ageShare: ageIntervalShare(cohorts),
        ...ageMetrics,
        source: "anchor"
      });
      const qx = applyCaution(buildMortalityCurve(life, "general"), checkpointValue(year, "caution", entity));
      const advanced = advanceCohorts(cohorts, births, qx, checkpointValue(year, "migration", entity), { targetDeaths: deaths });
      cohorts = advanced.cohorts;
      continue;
    }
    const tfr = checkpointValue(year, "tfr", entity);
    const life = checkpointValue(year, "life", entity);
    const migration = checkpointValue(year, "migration", entity);
    const caution = checkpointValue(year, "caution", entity);
    const qx = applyCaution(buildMortalityCurve(life, "general"), caution);
    const births = simulateBirths(cohorts, tfr);
    const childMortality = (1 - survivalToAge(qx, 15)) * 100;
    const population = cohorts.reduce((a, b) => a + b, 0);
    const migrationAbsolute = population * migration / 1000;
    const ageShare = ageIntervalShare(cohorts);
    const ageMetrics = agePercentileMetrics(cohorts, life);
    rows.push({
      year,
      population,
      births,
      deaths: 0,
      tfr,
      adjustedTfr: tfr * (1 - childMortality / 100),
      life,
      childMortality,
      growth: null,
      absoluteGrowth: null,
      migration,
      migrationAbsolute,
      caution,
      cohorts: cohorts.slice(),
      ageShare,
      ...ageMetrics,
      source: "scenario"
    });
    const advanced = advanceCohorts(cohorts, births, qx, migration);
    rows[rows.length - 1].deaths = advanced.deaths;
    cohorts = advanced.cohorts;
  }

  for (let i = 1; i < rows.length; i += 1) {
    rows[i].growth = (rows[i].population / rows[i - 1].population - 1) * 100;
    rows[i].absoluteGrowth = rows[i].population - rows[i - 1].population;
  }
  rows[0].growth = rows[0].population ? ((rows[0].births - rows[0].deaths) / rows[0].population + rows[0].migration / 1000) * 100 : 0;
  rows[0].absoluteGrowth = rows[0].births - rows[0].deaths + rows[0].migrationAbsolute;
  return rows;
}

function ageIntervalShare(cohorts) {
  const start = clamp(Number(el.ageShareStart.value) || 0, 0, MAX_AGE);
  const end = clamp(Number(el.ageShareEnd.value) || MAX_AGE, start, MAX_AGE);
  const total = cohorts.reduce((a, b) => a + b, 0);
  let selected = 0;
  for (let age = Math.floor(start); age <= Math.floor(end); age += 1) {
    selected += cohorts[age] || 0;
  }
  return total ? selected / total * 100 : 0;
}

function estimatedAgeIntervalShare(entity, year) {
  const start = clamp(Number(el.ageShareStart.value) || 0, 0, MAX_AGE);
  const end = clamp(Number(el.ageShareEnd.value) || MAX_AGE, start, MAX_AGE);
  const qx = buildMortalityCurve(getLife(entity, year), "general");
  const r = clamp(populationGrowthFraction(entity, year), -0.025, 0.04);
  let survivors = 1;
  let total = 0;
  let selected = 0;
  for (let age = 0; age <= MAX_AGE; age += 1) {
    const weight = survivors * Math.exp(-r * age);
    total += weight;
    if (age >= Math.floor(start) && age <= Math.floor(end)) selected += weight;
    survivors *= 1 - qx[age];
  }
  return total > 0 ? selected / total * 100 : null;
}

function composeSeries() {
  const entity = el.entitySelect.value || "World";
  const start = Number(el.yearStart.value) || 1800;
  const end = Number(el.yearEnd.value) || 2200;
  state.historical = buildHistorical(entity, start, Math.min(end, START_SIM_YEAR));
  state.scenario = end >= START_SIM_YEAR ? buildScenario(entity, START_SIM_YEAR, end) : [];

  const combined = [];
  for (let year = start; year <= end; year += 1) {
    const simulated = state.scenario.find((r) => r.year === year);
    const historical = state.historical.find((r) => r.year === year);
    combined.push(year >= START_SIM_YEAR && simulated ? simulated : historical);
  }
  return combined.filter(Boolean);
}

function baseLayout(titleY = "") {
  return {
    margin: { l: 54, r: 18, t: 42, b: 40 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Inter, Segoe UI, sans-serif", color: "#1e2326", size: 12 },
    xaxis: { gridcolor: "#eee9de", zerolinecolor: "#d7d4ca", nticks: 9 },
    yaxis: { title: titleY, gridcolor: "#eee9de", zerolinecolor: "#d7d4ca", nticks: 8 },
    legend: { orientation: "h", y: 1.22, x: 0, yanchor: "bottom", font: { size: 11 } },
    hovermode: "x unified"
  };
}

function zeroAnchoredRange(traces) {
  const values = traces.flatMap((trace) => trace.y || []).filter(Number.isFinite);
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min >= 0) {
    const upper = max > 0 ? max * 1.05 : 1;
    return [0, upper];
  }
  if (max <= 0) {
    const lower = min < 0 ? min * 1.05 : -1;
    return [lower, 0];
  }
  const pad = (max - min) * 0.05;
  return [min - pad, max + pad];
}

function plotLine(target, traces, yTitle = "", options = {}) {
  const layout = baseLayout(yTitle);
  if (options.zeroY) {
    const range = zeroAnchoredRange(traces);
    if (range) layout.yaxis.range = range;
  }
  Plotly.react(target, traces, layout, {
    responsive: true,
    displayModeBar: false,
    doubleClick: "reset"
  });
}

const POPULATION_GROWTH_COLORS = [
  { min: 2, label: "> 2%", color: "#c7352f" },
  { min: 1.5, max: 2, label: "1.5-2%", color: "#c85b16" },
  { min: 1, max: 1.5, label: "1-1.5%", color: "#d4921e" },
  { min: 0.75, max: 1, label: "0.75-1%", color: "#dfc33a" },
  { min: 0.5, max: 0.75, label: "0.5-0.75%", color: "#9bc93a" },
  { min: 0.25, max: 0.5, label: "0.25-0.5%", color: "#3f9e4b" },
  { min: 0.1, max: 0.25, label: "0.1-0.25%", color: "#176b3a" },
  { min: 0, max: 0.1, label: "0-0.1%", color: "#0f5c63" },
  { min: -0.25, max: 0, label: "-0.25-0%", color: "#18a9f2" },
  { min: -0.5, max: -0.25, label: "-0.5--0.25%", color: "#1d65f2" },
  { min: -1, max: -0.5, label: "-1--0.5%", color: "#7c45c4" },
  { max: -1, label: "< -1%", color: "#8b145a" }
];

const LIFE_CHANGE_COLORS = [
  { max: 0, label: "decrease", color: "#c7352f" },
  { min: 0, max: 0.2, label: "0-0.2 y/y", color: "#dfc33a" },
  { min: 0.2, max: 0.4, label: "0.2-0.4 y/y", color: "#9bc93a" },
  { min: 0.4, max: 0.8, label: "0.4-0.8 y/y", color: "#3f9e4b" },
  { min: 0.8, max: 1.2, label: "0.8-1.2 y/y", color: "#2dbec7" },
  { min: 1.2, max: 2, label: "1.2-2 y/y", color: "#18a9f2" },
  { min: 2, label: "> 2 y/y", color: "#174fb8" }
];

function colorForValue(value, bands) {
  for (const band of bands) {
    const above = band.min === undefined || value >= band.min;
    const below = band.max === undefined || value < band.max;
    if (above && below) return band.color;
  }
  return bands[bands.length - 1].color;
}

function segmentedLineTraces(years, values, metricValues, bands, name, hoverFormat = ",.0f") {
  const outline = {
    x: years,
    y: values,
    name: `${name} outline`,
    type: "scatter",
    mode: "lines",
    line: { color: "#141414", width: 5 },
    hoverinfo: "skip",
    showlegend: false
  };
  const segments = [outline];
  for (let i = 1; i < years.length; i += 1) {
    const metric = Number.isFinite(metricValues[i]) ? metricValues[i] : metricValues[i - 1];
    const color = colorForValue(metric, bands);
    segments.push({
      x: [years[i - 1], years[i]],
      y: [values[i - 1], values[i]],
      name,
      type: "scatter",
      mode: "lines",
      line: { color, width: 3 },
      legendgroup: name,
      showlegend: i === 1,
      hovertemplate: `%{y:${hoverFormat}}<extra>${name}</extra>`
    });
  }
  return segments;
}

function renderColorKey(container, bands) {
  if (!container) return;
  container.innerHTML = bands.map((band) => `
    <span class="key-item"><span class="key-swatch" style="background:${band.color}"></span>${band.label}</span>
  `).join("");
}

function scheduleRender({ force = false } = {}) {
  if (!force && !state.dynamic) {
    state.dirty = true;
    el.updateCharts?.classList.add("dirty");
    return;
  }
  render();
}

function render() {
  if (!state.entities.length) return;
  state.dirty = false;
  el.updateCharts?.classList.remove("dirty");
  updatePlaceFlag();
  const rows = composeSeries();
  const first = rows[0] || {};
  const second = rows[1] || {};
  el.dashboard.dataset.summary = JSON.stringify({
    entity: el.entitySelect.value,
    firstYear: first.year,
    firstBirths: first.births,
    firstDeaths: first.deaths,
    firstTfr: first.tfr,
    firstAdjustedTfr: first.adjustedTfr,
    firstMigration: first.migration,
    secondYear: second.year,
    secondBirths: second.births,
    secondDeaths: second.deaths
  });
  renderPanelToggles();
  updatePanelVisibility();
  renderCharts(rows);
  fitDashboardHeight();
}

function resetZoomAllGraphs() {
  render();
  setTimeout(() => {
    document.querySelectorAll(".chart").forEach((chart) => {
      if (chart.offsetParent) Plotly.Plots.resize(chart).catch(() => {});
    });
  }, 40);
}

function dynamicAgeLimitForCohorts(cohorts, buffer = 5) {
  const p = percentileAge(cohorts, 99.9);
  return clamp(Math.ceil((Number.isFinite(p) ? p : 120) + buffer), 20, MAX_AGE);
}

function renderCharts(rows) {
  const years = rows.map((r) => r.year);
  if (state.activePanels.has("population")) {
    renderColorKey(el.populationKey, POPULATION_GROWTH_COLORS);
    if (el.populationKey) el.populationKey.hidden = !state.populationKeyExpanded;
    const populationValues = rows.map((r) => r.population);
    const growthValues = rows.map((r, i) => Number.isFinite(r.growth)
      ? r.growth
      : i > 0 && Number.isFinite(rows[i - 1]?.population) && Number.isFinite(r.population)
      ? (r.population / rows[i - 1].population - 1) * 100
      : 0);
    plotLine("populationChart", segmentedLineTraces(years, populationValues, growthValues, POPULATION_GROWTH_COLORS, "Population"), "people", { zeroY: el.zeroPopulation.checked });
  }

  if (state.activePanels.has("vitals")) {
    plotLine("vitalsChart", [
      { x: years, y: rows.map((r) => r.births), name: "Births", type: "scatter", mode: "lines", line: { color: "#365f91", width: 3 } },
      { x: years, y: rows.map((r) => r.deaths), name: "Deaths", type: "scatter", mode: "lines", line: { color: "#bf4b3f", width: 3 } }
    ], "people / year", { zeroY: el.zeroVitals.checked });
  }

  if (state.activePanels.has("fertility")) {
    plotLine("fertilityChart", [
      { x: years, y: rows.map((r) => r.tfr), name: "TFR", type: "scatter", mode: "lines", line: { color: "#365f91", width: 3 } },
      { x: years, y: rows.map((r) => r.adjustedTfr), name: "Survival-adjusted", type: "scatter", mode: "lines", line: { color: "#bf4b3f", width: 3 } }
    ], "births per woman", { zeroY: el.zeroFertility.checked });
  }

  if (state.activePanels.has("life")) {
    const lifeValues = rows.map((r) => r.life);
    const lifeChanges = rows.map((r, i) => i === 0 ? 0 : (r.life ?? 0) - (rows[i - 1]?.life ?? r.life ?? 0));
    plotLine("lifeChart", segmentedLineTraces(years, lifeValues, lifeChanges, LIFE_CHANGE_COLORS, "Life expectancy", ".1f"), "years", { zeroY: el.zeroLife.checked });
  }

  if (state.activePanels.has("growth")) {
    plotLine("growthChart", [
      { x: years, y: rows.map((r) => r.growth), name: "Growth", type: "scatter", mode: "lines", line: { color: "#80662c", width: 3 } }
    ], "% / year");
  }

  if (state.activePanels.has("absoluteGrowth")) {
    plotLine("absoluteGrowthChart", [
      { x: years, y: rows.map((r) => r.absoluteGrowth), name: "Absolute growth", type: "scatter", mode: "lines", line: { color: "#2e757f", width: 3 } }
    ], "people / year", { zeroY: el.zeroAbsoluteGrowth.checked });
  }

  if (state.activePanels.has("migrationAbsolute")) {
    plotLine("migrationAbsoluteChart", [
      { x: years, y: rows.map((r) => r.migrationAbsolute), name: "Net migration", type: "scatter", mode: "lines", line: { color: "#59466b", width: 3 } }
    ], "people / year", { zeroY: el.zeroMigrationAbsolute.checked });
  }

  if (state.activePanels.has("migrationRate")) {
    plotLine("migrationRateChart", [
      { x: years, y: rows.map((r) => r.migration), name: "Migration", type: "scatter", mode: "lines", line: { color: "#bf4b3f", width: 3 } }
    ], "per mille", { zeroY: el.zeroMigrationRate.checked });
  }

  if (state.activePanels.has("ageShare")) {
    plotLine("ageShareChart", [
      { x: years, y: rows.map((r) => r.ageShare), name: "Selected ages", type: "scatter", mode: "lines", fill: "tozeroy", line: { color: "#277a68", width: 3 } }
    ], "% of population");
  }

  if (state.activePanels.has("agePercentile")) {
    const percentile = selectedPercentile();
    plotLine("agePercentileChart", [
      { x: years, y: rows.map((r) => r.percentileAge), name: `${percentileLabel(percentile)}% actual age`, type: "scatter", mode: "lines", line: { color: "#365f91", width: 3 } },
      { x: years, y: rows.map((r) => r.adjustedPercentileAge), name: `${percentileLabel(percentile)}% feel age`, type: "scatter", mode: "lines", line: { color: "#277a68", width: 3 } }
    ], "age", { zeroY: el.zeroAgePercentile?.checked ?? true });
  }

  if (state.activePanels.has("mortality")) renderMortalityChart(rows);
  if (state.activePanels.has("pyramid")) renderPyramid(rows);
  if (state.activePanels.has("feelPyramid")) renderFeelPyramid(rows);
  if (state.activePanels.has("healthAge")) renderHealthAge();
}

function rowForMortalityCurve(rows, item) {
  if (item.type !== "year") return null;
  const year = Number(item.value);
  const visible = rows.find((r) => r.year === year);
  if (visible) return visible;
  const scenario = state.scenario.find((r) => r.year === year);
  if (scenario) return scenario;
  if (year > START_SIM_YEAR) {
    return {
      year,
      life: checkpointValue(year, "life", el.entitySelect.value || "World"),
      caution: checkpointValue(year, "caution", el.entitySelect.value || "World")
    };
  }
  return null;
}

const MORTALITY_LINEAR_MAX = 0.1;

function mortalityRatePerThousand(q) {
  return Math.max(0, normalizedDeathRate(q) * 1000);
}

function mortalityHybridY(ratePerThousand) {
  const rate = Math.max(0, Number(ratePerThousand) || 0);
  if (rate <= MORTALITY_LINEAR_MAX) return rate / MORTALITY_LINEAR_MAX;
  return 1 + Math.log10(rate / MORTALITY_LINEAR_MAX);
}

function mortalityHybridTicks() {
  const rates = [0, 0.01, 0.05, 0.1, 1, 10, 100, 1000];
  return {
    values: rates.map(mortalityHybridY),
    text: rates.map((rate) => String(rate))
  };
}

function renderMortalityChart(rows) {
  renderMortalityCurveList();
  const curveItems = state.mortalityCurves.slice(0, 10);
  const colors = ["#80662c", "#277a68", "#365f91", "#bf4b3f", "#59466b", "#2e757f"];
  const traceModels = curveItems.map((item, i) => {
    const row = rowForMortalityCurve(rows, item);
    const life = item.type === "year" ? (row?.life ?? getLife(el.entitySelect.value || "World", item.value)) : item.value;
    const caution = item.type === "year" ? (row?.caution ?? 0) : 0;
    const qx = applyCaution(buildMortalityCurve(life, "general"), caution);
    const label = item.type === "year" ? `${item.value} LE ${life.toFixed(1)}${caution ? ` c${caution}` : ""}` : `LE ${life}`;
    return { qx, label, color: colors[i % colors.length], width: item.type === "le" && Number(item.value) === 75 ? 4 : 2 };
  });
  const maxAge = Math.max(20, ...traceModels.map((model) => ageAtRate(model.qx, 0.995)));
  const age = Array.from({ length: maxAge + 1 }, (_, i) => i);
  const traces = traceModels.map((model) => {
    const rates = age.map((a) => mortalityRatePerThousand(model.qx[a] ?? model.qx[model.qx.length - 1]));
    return {
      x: age,
      y: rates.map(mortalityHybridY),
      customdata: rates,
      name: model.label,
      type: "scatter",
      mode: "lines",
      line: { color: model.color, width: model.width },
      hovertemplate: "Age %{x}<br>%{customdata:.4g} deaths per 1,000<extra>%{fullData.name}</extra>"
    };
  });
  const ticks = mortalityHybridTicks();
  const layout = baseLayout("deaths per 1,000");
  layout.yaxis.type = "linear";
  layout.yaxis.range = [0, mortalityHybridY(1000)];
  layout.yaxis.tickmode = "array";
  layout.yaxis.tickvals = ticks.values;
  layout.yaxis.ticktext = ticks.text;
  layout.xaxis.range = [0, maxAge];
  layout.margin.t = 58;
  Plotly.react("mortalityChart", traces, layout, { responsive: true, displayModeBar: false, doubleClick: "reset" });
}

function ageAtRate(qx, threshold) {
  for (let age = 0; age <= MAX_AGE; age += 1) {
    if ((qx[age] || 0) >= threshold) return age;
  }
  return MAX_AGE;
}

function renderMortalityCurveList() {
  if (!el.mortalityCurveList) return;
  el.mortalityCurveList.innerHTML = "";
  state.mortalityCurves.forEach((item, index) => {
    const chip = document.createElement("span");
    chip.className = "curve-chip";
    chip.innerHTML = `<span>${item.type === "year" ? `Year ${item.value}` : `LE ${item.value}`}</span>${index > 1 ? `<button title="Remove curve" data-curve-remove="${index}">x</button>` : ""}`;
    el.mortalityCurveList.appendChild(chip);
  });
}

function rowForPyramidYear(rows, targetYear) {
  const visible = rows.find((r) => r.year === targetYear && r.cohorts);
  if (visible) return visible;
  const entity = el.entitySelect.value || "World";
  if (targetYear <= START_SIM_YEAR) return buildHistorical(entity, targetYear, targetYear)[0] || null;
  const existing = state.scenario.find((r) => r.year === targetYear && r.cohorts);
  if (existing) return existing;
  return buildScenario(entity, START_SIM_YEAR, targetYear).find((r) => r.year === targetYear) || null;
}

function applyPyramidHoverLayout(layout) {
  layout.hovermode = "y unified";
  layout.xaxis.showspikes = false;
  layout.yaxis.showspikes = true;
  layout.yaxis.spikemode = "across";
  layout.yaxis.spikesnap = "cursor";
  layout.yaxis.spikethickness = 1;
  layout.yaxis.spikecolor = "#657078";
}

function renderPyramid(rows) {
  const targetYear = clamp(Number(el.pyramidYear.value) || START_SIM_YEAR, 1800, 2400);
  const row = rowForPyramidYear(rows, targetYear);
  if (!row) {
    Plotly.react("pyramidChart", [], baseLayout("people"), { responsive: true, displayModeBar: false, doubleClick: "reset" });
    return;
  }
  const ageLimit = state.dynamicPyramidAge
    ? dynamicAgeLimitForCohorts(row.cohorts)
    : clamp(Number(el.pyramidMaxAge.value) || mortalityAgeLimit(row.life, 0, "general"), 20, MAX_AGE);
  if (state.dynamicPyramidAge && el.pyramidMaxAge) el.pyramidMaxAge.value = ageLimit;
  const ages = Array.from({ length: ageLimit + 1 }, (_, i) => i);
  const half = ages.map((age) => (row.cohorts[age] || 0) / 2);
  const traces = [
    { y: ages, x: half.map((v) => -v), name: "Female", type: "bar", orientation: "h", marker: { color: "#bf4b3f" }, hovertemplate: "Age %{y}<br>%{customdata}<extra>Female</extra>", customdata: half.map((v) => formatNumber(v)) },
    { y: ages, x: half, name: "Male", type: "bar", orientation: "h", marker: { color: "#365f91" }, hovertemplate: "Age %{y}<br>%{customdata}<extra>Male</extra>", customdata: half.map((v) => formatNumber(v)) }
  ];
  const layout = baseLayout("age");
  layout.barmode = "relative";
  layout.xaxis.tickformat = "~s";
  layout.yaxis.range = [0, ageLimit];
  layout.yaxis.dtick = 20;
  applyPyramidHoverLayout(layout);
  Plotly.react("pyramidChart", traces, layout, { responsive: true, displayModeBar: false, doubleClick: "reset" });
}

function renderFeelPyramid(rows) {
  const targetYear = clamp(Number(el.feelPyramidYear.value) || START_SIM_YEAR, 1800, 2400);
  const row = rowForPyramidYear(rows, targetYear);
  if (!row) {
    Plotly.react("feelPyramidChart", [], baseLayout("people"), { responsive: true, displayModeBar: false, doubleClick: "reset" });
    return;
  }
  const feelDistributionValues = feelDistribution(row.cohorts, row.life);
  const ageLimit = state.dynamicFeelPyramidAge
    ? dynamicAgeLimitForCohorts(feelDistributionValues)
    : clamp(Number(el.feelPyramidMaxAge.value) || mortalityAgeLimit(row.life, 20, "disease"), 20, MAX_AGE);
  if (state.dynamicFeelPyramidAge && el.feelPyramidMaxAge) el.feelPyramidMaxAge.value = ageLimit;
  const ages = Array.from({ length: ageLimit - 19 }, (_, i) => i + 20);
  const actualHalf = ages.map((age) => (row.cohorts[age] || 0) / 2);
  const feel = feelDistributionValues.map((v) => v / 2);
  const feelHalf = ages.map((age) => feel[age] || 0);
  const actualMax = Math.max(...actualHalf, 1);
  const feelMax = Math.max(...feelHalf, 1);
  const actualScaled = actualHalf.map((v) => -100 * v / actualMax);
  const feelScaled = feelHalf.map((v) => 100 * v / feelMax);
  const traces = [
    { y: ages, x: actualScaled, name: "Actual age", type: "bar", orientation: "h", marker: { color: "#365f91" }, hovertemplate: "Actual age %{y}<br>%{customdata}<extra></extra>", customdata: actualHalf.map((v) => formatNumber(v)) },
    { y: ages, x: feelScaled, name: "Feel age", type: "bar", orientation: "h", marker: { color: "#277a68" }, hovertemplate: "Feel age %{y}<br>%{customdata}<extra></extra>", customdata: feelHalf.map((v) => formatNumber(v)) }
  ];
  const layout = baseLayout("age");
  layout.barmode = "relative";
  layout.xaxis.range = [-105, 105];
  layout.xaxis.tickvals = [-100, -50, 0, 50, 100];
  layout.xaxis.ticktext = [formatNumber(actualMax), formatNumber(actualMax / 2), "0", formatNumber(feelMax / 2), formatNumber(feelMax)];
  layout.yaxis.range = [20, ageLimit];
  layout.yaxis.dtick = 20;
  applyPyramidHoverLayout(layout);
  Plotly.react("feelPyramidChart", traces, layout, { responsive: true, displayModeBar: false, doubleClick: "reset" });
}

function feelDistribution(cohorts, life) {
  const out = Array(MAX_AGE + 1).fill(0);
  for (let age = 0; age <= MAX_AGE; age += 1) {
    const mapped = feelAgeFor(age, life);
    if (age >= 20 && mapped <= 20.02) {
      distributeExponentialFeel(out, cohorts[age], 20, 40, 5);
      continue;
    }
    const lo = Math.floor(mapped);
    const hi = Math.min(MAX_AGE, lo + 1);
    const t = mapped - lo;
    out[lo] += cohorts[age] * (1 - t);
    out[hi] += cohorts[age] * t;
  }
  const sourceTotal = cohorts.reduce((a, b) => a + b, 0);
  const mappedTotal = out.reduce((a, b) => a + b, 0);
  if (mappedTotal > 0 && sourceTotal > 0) {
    for (let age = 0; age <= MAX_AGE; age += 1) out[age] *= sourceTotal / mappedTotal;
  }
  return out;
}

function distributeExponentialFeel(out, amount, startAge, endAge, halfLife) {
  let denom = 0;
  for (let age = startAge; age <= endAge; age += 1) {
    denom += Math.pow(0.5, (age - startAge) / halfLife);
  }
  for (let age = startAge; age <= endAge; age += 1) {
    out[age] += amount * Math.pow(0.5, (age - startAge) / halfLife) / denom;
  }
}

function renderHealthAge() {
  const selectedLife = Number(el.healthLifeExpectancy.value) || 85;
  const limit = clamp(Number(el.healthMaxAge.value) || mortalityAgeLimit(selectedLife, 20, "disease"), 20, MAX_AGE);
  const ages = Array.from({ length: limit - 19 }, (_, i) => i + 20);
  const feel = ages.map((age) => feelAgeFor(age, selectedLife));
  plotLine("healthAgeChart", [
    { x: ages, y: feel, name: `LE ${selectedLife} feel age`, type: "scatter", mode: "lines", line: { color: "#277a68", width: 3 } },
    { x: ages, y: ages, name: "Actual age", type: "scatter", mode: "lines", line: { color: "#657078", width: 2, dash: "dot" } }
  ], "LE-75 equivalent age");
}

function sortCheckpointsByYear() {
  state.checkpoints.sort((a, b) => {
    const yearA = Number.isFinite(Number(a.year)) ? Number(a.year) : Infinity;
    const yearB = Number.isFinite(Number(b.year)) ? Number(b.year) : Infinity;
    return yearA - yearB;
  });
}

function setupCheckpoints() {
  sortCheckpointsByYear();
  el.checkpointList.innerHTML = "";
  state.checkpoints
    .forEach((point, index) => {
      const row = document.createElement("div");
      row.className = "checkpoint";
      row.innerHTML = `
        <label>Year<input type="number" min="${START_SIM_YEAR}" max="2400" value="${point.year}" data-key="year" data-index="${index}"></label>
        <label>TFR<input type="number" min="0" max="8" step="0.01" value="${point.tfr}" data-key="tfr" data-index="${index}"></label>
        <label>LE<input type="number" min="35" max="500" step="0.5" value="${point.life}" data-key="life" data-index="${index}"></label>
        <label>Migration<input type="number" min="-50" max="50" step="0.1" value="${point.migration}" data-key="migration" data-index="${index}"></label>
        <label>Caution<input type="number" min="0" max="1" step="0.01" value="${point.caution ?? 0}" data-key="caution" data-index="${index}"></label>
        <div class="checkpoint-actions">
          <button class="icon-button" title="Remove checkpoint" data-remove="${index}"><i data-lucide="trash-2"></i></button>
        </div>
      `;
      el.checkpointList.appendChild(row);
    });
  lucide.createIcons();
}

function renderScenarioButtons() {
  if (el.fertilityScenarios) {
    el.fertilityScenarios.innerHTML = Object.entries(FERTILITY_SCENARIOS).map(([key, scenario]) => (
      `<button class="text-button ${state.fertilityScenario === key ? "active" : ""}" data-fertility-scenario="${key}">${scenario.label}</button>`
    )).join("");
  }
  if (el.lifeScenarios) {
    el.lifeScenarios.innerHTML = Object.entries(LIFE_SCENARIOS).map(([key, scenario]) => (
      `<button class="text-button ${state.lifeScenario === key ? "active" : ""}" data-life-scenario="${key}">${scenario.label}</button>`
    )).join("");
  }
  lucide.createIcons();
}

function renderPanelToggles() {
  if (el.panelToggles.childElementCount) return;
  for (const [key, label] of PANELS) {
    const item = document.createElement("label");
    item.className = "panel-toggle";
    item.innerHTML = `<input type="checkbox" ${state.activePanels.has(key) ? "checked" : ""} data-panel-toggle="${key}"><span>${label}</span>`;
    el.panelToggles.appendChild(item);
  }
}

function updatePanelVisibility() {
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.style.display = state.activePanels.has(panel.dataset.panel) ? "grid" : "none";
  });
}

function setPanelPreset(keys) {
  state.activePanels = new Set(keys);
  document.querySelectorAll("[data-panel-toggle]").forEach((input) => {
    input.checked = state.activePanels.has(input.dataset.panelToggle);
  });
  updatePanelVisibility();
}

function resetLayout() {
  const gap = 16;
  const pad = 16;
  const width = Math.max(320, el.dashboard.clientWidth || 960);
  const columns = width > 1260 ? 3 : width > 760 ? 2 : 1;
  const colWidth = Math.floor((width - pad * 2 - gap * (columns - 1)) / columns);
  const order = ["population", "vitals", "fertility", "life", "growth", "absoluteGrowth", "migrationAbsolute", "migrationRate", "mortality", "pyramid", "feelPyramid", "ageShare", "agePercentile", "healthAge"];
  const heights = {
    population: 495,
    vitals: 495,
    fertility: 428,
    life: 428,
    growth: 428,
    absoluteGrowth: 428,
    migrationAbsolute: 428,
    migrationRate: 428,
    mortality: 645,
    pyramid: 615,
    feelPyramid: 615,
    ageShare: 510,
    agePercentile: 510,
    healthAge: 510
  };
  const y = Array(columns).fill(pad);
  document.querySelectorAll(".panel").forEach((panel) => {
    const visibleIndex = order.filter((key) => state.activePanels.has(key)).indexOf(panel.dataset.panel);
    if (visibleIndex < 0) {
      panel.style.transform = "translate(0px, 0px)";
      panel.dataset.x = "0";
      panel.dataset.y = "0";
      return;
    }
    const col = visibleIndex % columns;
    const left = pad + col * (colWidth + gap);
    const top = y[col];
    const height = heights[panel.dataset.panel] || 300;
    y[col] += height + gap;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.width = `${colWidth}px`;
    panel.style.height = `${height}px`;
    panel.style.transform = "translate(0px, 0px)";
    panel.classList.remove("collapsed");
    panel.dataset.x = "0";
    panel.dataset.y = "0";
  });
  fitDashboardHeight();
  setTimeout(() => {
    document.querySelectorAll(".chart").forEach((chart) => {
      if (chart.offsetParent) Plotly.Plots.resize(chart).catch(() => {});
    });
  }, 50);
}

function fitDashboardHeight() {
  let bottom = 0;
  document.querySelectorAll(".panel").forEach((panel) => {
    if (getComputedStyle(panel).display === "none") return;
    const top = parseFloat(panel.style.top) || 0;
    const y = parseFloat(panel.dataset.y) || 0;
    bottom = Math.max(bottom, top + y + panel.getBoundingClientRect().height);
  });
  el.dashboard.style.minHeight = `${Math.max(window.innerHeight - 28, bottom + 24)}px`;
}

function visiblePanels() {
  return Array.from(document.querySelectorAll(".panel"))
    .filter((panel) => getComputedStyle(panel).display !== "none");
}

function materializePanelTransform(panel) {
  const x = parseFloat(panel.dataset.x) || 0;
  const y = parseFloat(panel.dataset.y) || 0;
  if (!x && !y) return;
  panel.style.left = `${(parseFloat(panel.style.left) || 0) + x}px`;
  panel.style.top = `${(parseFloat(panel.style.top) || 0) + y}px`;
  panel.style.transform = "translate(0px, 0px)";
  panel.dataset.x = "0";
  panel.dataset.y = "0";
}

function panelBox(panel) {
  const left = parseFloat(panel.style.left) || 0;
  const top = parseFloat(panel.style.top) || 0;
  const rect = panel.getBoundingClientRect();
  return {
    left,
    top,
    width: rect.width,
    height: rect.height,
    right: left + rect.width,
    bottom: top + rect.height
  };
}

function boxesOverlap(a, b, gap = 14) {
  return a.left < b.right + gap
    && a.right + gap > b.left
    && a.top < b.bottom + gap
    && a.bottom + gap > b.top;
}

function movePanelTo(panel, left, top) {
  panel.style.left = `${Math.max(16, left)}px`;
  panel.style.top = `${Math.max(16, top)}px`;
  panel.style.transform = "translate(0px, 0px)";
  panel.dataset.x = "0";
  panel.dataset.y = "0";
}

function settlePanelLayout(activePanel = null) {
  const gap = 16;
  const panels = visiblePanels();
  if (!panels.length) return;
  panels.forEach(materializePanelTransform);
  if (activePanel) movePanelTo(activePanel, panelBox(activePanel).left, panelBox(activePanel).top);

  const ordered = panels
    .filter((panel) => panel !== activePanel)
    .sort((a, b) => panelBox(a).top - panelBox(b).top || panelBox(a).left - panelBox(b).left);
  const placed = [];
  if (activePanel && panels.includes(activePanel)) placed.push({ panel: activePanel, box: panelBox(activePanel) });

  for (const panel of ordered) {
    let box = panelBox(panel);
    let guard = 0;
    while (placed.some((item) => boxesOverlap(box, item.box, gap)) && guard < 100) {
      const blockers = placed.filter((item) => boxesOverlap(box, item.box, gap));
      box.top = Math.max(...blockers.map((item) => item.box.bottom + gap));
      box.bottom = box.top + box.height;
      guard += 1;
    }
    movePanelTo(panel, box.left, box.top);
    placed.push({ panel, box: panelBox(panel) });
  }

  const compacted = panels
    .sort((a, b) => panelBox(a).top - panelBox(b).top || panelBox(a).left - panelBox(b).left);
  for (const panel of compacted) {
    if (panel === activePanel) continue;
    const box = panelBox(panel);
    let top = 16;
    for (const other of panels) {
      if (other === panel) continue;
      const otherBox = panelBox(other);
      const horizontalOverlap = box.left < otherBox.right + gap && box.right + gap > otherBox.left;
      if (horizontalOverlap && otherBox.bottom + gap <= box.top) {
        top = Math.max(top, otherBox.bottom + gap);
      }
    }
    if (top < box.top) movePanelTo(panel, box.left, top);
  }

  fitDashboardHeight();
  setTimeout(() => {
    document.querySelectorAll(".chart").forEach((chart) => {
      if (chart.offsetParent) Plotly.Plots.resize(chart).catch(() => {});
    });
  }, 40);
}

function setupDragging() {
  interact(".panel")
    .draggable({
      allowFrom: "header",
      listeners: {
        move(event) {
          const target = event.target;
          const x = (parseFloat(target.dataset.x) || 0) + event.dx;
          const y = (parseFloat(target.dataset.y) || 0) + event.dy;
          target.style.transform = `translate(${x}px, ${y}px)`;
          target.dataset.x = x;
          target.dataset.y = y;
          fitDashboardHeight();
        },
        end(event) {
          settlePanelLayout(event.target);
        }
      }
    })
    .resizable({
      edges: { left: true, right: true, bottom: true, top: true },
      listeners: {
        move(event) {
          const target = event.target;
          let x = parseFloat(target.dataset.x) || 0;
          let y = parseFloat(target.dataset.y) || 0;
          target.style.width = `${event.rect.width}px`;
          target.style.height = `${event.rect.height}px`;
          x += event.deltaRect.left;
          y += event.deltaRect.top;
          target.style.transform = `translate(${x}px, ${y}px)`;
          target.dataset.x = x;
          target.dataset.y = y;
          const chart = target.querySelector(".chart");
          if (chart?.offsetParent) Plotly.Plots.resize(chart).catch(() => {});
          fitDashboardHeight();
        },
        end(event) {
          settlePanelLayout(event.target);
        }
      },
      modifiers: [
        interact.modifiers.restrictSize({ min: { width: 260, height: 172 } })
      ]
    });
}

function sidebarWidthBounds() {
  const viewport = Math.max(window.innerWidth || 0, 980);
  return {
    min: 360,
    max: Math.max(420, Math.min(720, Math.floor(viewport * 0.55)))
  };
}

function setSidebarWidth(width, persist = true) {
  if (!el.appShell) return;
  const bounds = sidebarWidthBounds();
  const next = clamp(Number(width) || 420, bounds.min, bounds.max);
  el.appShell.style.setProperty("--sidebar-width", `${next}px`);
  state.sidebarWidth = next;
  if (persist) localStorage.setItem("populationVisualizer.sidebarWidth", String(next));
}

function setupSidebarResize() {
  if (!el.sidebarResize || !el.appShell) return;
  const saved = Number(localStorage.getItem("populationVisualizer.sidebarWidth"));
  if (Number.isFinite(saved)) setSidebarWidth(saved, false);

  let startX = 0;
  let startWidth = state.sidebarWidth || 420;

  el.sidebarResize.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    startX = event.clientX;
    startWidth = state.sidebarWidth || 420;
    el.sidebarResize.setPointerCapture(event.pointerId);
    document.body.classList.add("resizing-sidebar");
  });

  el.sidebarResize.addEventListener("pointermove", (event) => {
    if (!el.sidebarResize.hasPointerCapture(event.pointerId)) return;
    setSidebarWidth(startWidth + event.clientX - startX);
    fitDashboardHeight();
    document.querySelectorAll(".chart").forEach((chart) => {
      if (chart.offsetParent) Plotly.Plots.resize(chart).catch(() => {});
    });
  });

  const finishResize = (event) => {
    if (!el.sidebarResize.hasPointerCapture(event.pointerId)) return;
    el.sidebarResize.releasePointerCapture(event.pointerId);
    document.body.classList.remove("resizing-sidebar");
    settlePanelLayout();
  };
  el.sidebarResize.addEventListener("pointerup", finishResize);
  el.sidebarResize.addEventListener("pointercancel", finishResize);
}

function setupEvents() {
  const rerenderControls = [
    el.entitySelect, el.yearStart, el.yearEnd,
    el.ageShareStart, el.ageShareEnd, el.agePercentile,
    el.pyramidYear, el.pyramidMaxAge,
    el.feelPyramidYear, el.feelPyramidMaxAge,
    el.healthLifeExpectancy, el.healthMaxAge,
    el.zeroPopulation, el.zeroVitals, el.zeroFertility, el.zeroLife,
    el.zeroAbsoluteGrowth, el.zeroMigrationAbsolute, el.zeroMigrationRate,
    el.zeroAgePercentile
  ];
  rerenderControls.filter(Boolean).forEach((control) => {
    control.addEventListener("input", () => scheduleRender());
    control.addEventListener("change", () => scheduleRender());
  });

  el.addMortalityCurve?.addEventListener("click", () => {
    if (state.mortalityCurves.length >= 10) return;
    const type = el.mortalityCurveType.value;
    const raw = Number(el.mortalityCurveValue.value);
    if (!Number.isFinite(raw)) return;
    const value = type === "year" ? Math.round(clamp(raw, 1800, 2400)) : clamp(raw, 1, 500);
    const exists = state.mortalityCurves.some((item) => item.type === type && Number(item.value) === Number(value));
    if (!exists) state.mortalityCurves.push({ type, value });
    scheduleRender();
  });

  el.mortalityCurveList?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-curve-remove]");
    if (!button) return;
    state.mortalityCurves.splice(Number(button.dataset.curveRemove), 1);
    scheduleRender();
  });

  el.addCheckpoint.addEventListener("click", () => {
    const last = state.checkpoints[state.checkpoints.length - 1] || DEFAULT_CHECKPOINTS[0];
    state.checkpoints.push({
      year: Math.min(2400, last.year + 25),
      tfr: last.tfr,
      life: last.life + 5,
      migration: last.migration,
      caution: last.caution ?? 0
    });
    sortCheckpointsByYear();
    setupCheckpoints();
    scheduleRender();
  });

  el.checkpointList.addEventListener("input", (event) => {
    const input = event.target.closest("input[data-key]");
    if (!input) return;
    const index = Number(input.dataset.index);
    const key = input.dataset.key;
    if (!state.checkpoints[index]) return;
    state.checkpoints[index][key] = Number(input.value);
    if (key === "year") {
      window.clearTimeout(state.checkpointSortTimer);
      state.checkpointSortTimer = window.setTimeout(() => {
        if (document.activeElement === input) return;
        commitCheckpointEdit(input);
      }, 700);
      return;
    }
    scheduleRender();
  });

  const commitCheckpointEdit = (input) => {
    const index = Number(input.dataset.index);
    const key = input.dataset.key;
    if (!state.checkpoints[index]) return;
    state.checkpoints[index][key] = Number(input.value);
    sortCheckpointsByYear();
    setupCheckpoints();
    scheduleRender();
  };

  el.checkpointList.addEventListener("change", (event) => {
    const input = event.target.closest("input[data-key]");
    if (!input) return;
    commitCheckpointEdit(input);
  });

  el.checkpointList.addEventListener("focusout", (event) => {
    const input = event.target.closest("input[data-key='year']");
    if (!input) return;
    commitCheckpointEdit(input);
  });

  el.checkpointList.addEventListener("keydown", (event) => {
    const input = event.target.closest("input[data-key='year']");
    if (!input || event.key !== "Enter") return;
    event.preventDefault();
    commitCheckpointEdit(input);
  });

  el.fertilityScenarios?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-fertility-scenario]");
    if (!button) return;
    applyCheckpointScenario({ fertilityKey: button.dataset.fertilityScenario, updateFertility: true, updateLife: false });
  });

  el.lifeScenarios?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-life-scenario]");
    if (!button) return;
    applyCheckpointScenario({ lifeKey: button.dataset.lifeScenario, updateFertility: false, updateLife: true });
  });

  el.checkpointList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-remove]");
    if (!button || state.checkpoints.length <= 2) return;
    state.checkpoints.splice(Number(button.dataset.remove), 1);
    sortCheckpointsByYear();
    setupCheckpoints();
    scheduleRender();
  });

  el.panelToggles.addEventListener("input", (event) => {
    const input = event.target.closest("input[data-panel-toggle]");
    if (!input) return;
    if (input.checked) state.activePanels.add(input.dataset.panelToggle);
    else state.activePanels.delete(input.dataset.panelToggle);
    updatePanelVisibility();
    resetLayout();
    scheduleRender();
  });

  document.querySelectorAll(".collapse").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const panel = button.closest(".panel");
      panel.classList.toggle("collapsed");
      setTimeout(() => {
        const chart = panel.querySelector(".chart");
        if (chart?.offsetParent) Plotly.Plots.resize(chart).catch(() => {});
      }, 50);
    });
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.mode = tab.dataset.mode;
      if (state.mode === "history") {
        el.yearStart.value = 1950;
        el.yearEnd.value = START_SIM_YEAR;
        setPanelPreset(DEFAULT_ACTIVE_PANELS);
      } else if (state.mode === "simulation") {
        el.yearStart.value = 1950;
        el.yearEnd.value = 2100;
        setPanelPreset(DEFAULT_ACTIVE_PANELS);
      }
      resetLayout();
      scheduleRender({ force: true });
    });
  });

  el.updateCharts.addEventListener("click", () => scheduleRender({ force: true }));
  el.dynamicMode.addEventListener("click", () => {
    state.dynamic = !state.dynamic;
    el.dynamicMode.classList.toggle("active", state.dynamic);
    el.dynamicMode.setAttribute("aria-pressed", String(state.dynamic));
    if (state.dynamic && state.dirty) scheduleRender({ force: true });
  });
  el.resetLayout.addEventListener("click", resetAll);
  el.resetGraphs?.addEventListener("click", () => {
    resetLayout();
    scheduleRender({ force: true });
  });
  el.resetZoomAll?.addEventListener("click", resetZoomAllGraphs);
  el.togglePopulationKey?.addEventListener("click", () => {
    state.populationKeyExpanded = !state.populationKeyExpanded;
    el.togglePopulationKey.textContent = state.populationKeyExpanded ? "Hide key" : "Expand key";
    el.togglePopulationKey.setAttribute("aria-expanded", String(state.populationKeyExpanded));
    if (el.populationKey) el.populationKey.hidden = !state.populationKeyExpanded;
    setTimeout(() => Plotly.Plots.resize(document.querySelector("#populationChart")).catch(() => {}), 40);
  });
  el.dynamicPyramidAge?.addEventListener("click", () => {
    state.dynamicPyramidAge = !state.dynamicPyramidAge;
    el.dynamicPyramidAge.classList.toggle("active", state.dynamicPyramidAge);
    el.dynamicPyramidAge.setAttribute("aria-pressed", String(state.dynamicPyramidAge));
    scheduleRender();
  });
  el.dynamicFeelPyramidAge?.addEventListener("click", () => {
    state.dynamicFeelPyramidAge = !state.dynamicFeelPyramidAge;
    el.dynamicFeelPyramidAge.classList.toggle("active", state.dynamicFeelPyramidAge);
    el.dynamicFeelPyramidAge.setAttribute("aria-pressed", String(state.dynamicFeelPyramidAge));
    scheduleRender();
  });
  el.exportScenario.addEventListener("click", exportScenario);
  window.addEventListener("resize", () => {
    window.clearTimeout(state.resizeTimer);
    state.resizeTimer = window.setTimeout(() => {
      if (state.sidebarWidth) setSidebarWidth(state.sidebarWidth, false);
      resetLayout();
      document.querySelectorAll(".chart").forEach((chart) => {
        if (chart.offsetParent) Plotly.Plots.resize(chart).catch(() => {});
      });
    }, 120);
  });
}

function resetAll() {
  state.checkpoints = structuredClone(DEFAULT_CHECKPOINTS);
  state.mode = "history";
  state.dynamic = true;
  state.dirty = false;
  state.fertilityScenario = DEFAULT_FERTILITY_SCENARIO;
  state.lifeScenario = DEFAULT_LIFE_SCENARIO;
  state.populationKeyExpanded = false;
  state.dynamicPyramidAge = false;
  state.dynamicFeelPyramidAge = false;
  if (state.entities.length) el.dataStatus.textContent = `${state.entities.length} places loaded.`;
  state.activePanels = new Set(DEFAULT_ACTIVE_PANELS);
  state.mortalityCurves = [{ type: "le", value: 75 }, { type: "year", value: START_SIM_YEAR }];
  el.entitySelect.value = state.entities.includes("World") ? "World" : state.entities[0];
  el.yearStart.value = 1950;
  el.yearEnd.value = START_SIM_YEAR;
  el.dynamicMode.classList.add("active");
  el.dynamicMode.setAttribute("aria-pressed", "true");
  if (el.togglePopulationKey) {
    el.togglePopulationKey.textContent = "Expand key";
    el.togglePopulationKey.setAttribute("aria-expanded", "false");
  }
  if (el.populationKey) el.populationKey.hidden = true;
  [el.dynamicPyramidAge, el.dynamicFeelPyramidAge].forEach((button) => {
    if (!button) return;
    button.classList.remove("active");
    button.setAttribute("aria-pressed", "false");
  });
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === "history"));
  el.ageShareStart.value = 65;
  el.ageShareEnd.value = 100;
  if (el.agePercentile) el.agePercentile.value = 50;
  el.pyramidYear.value = START_SIM_YEAR;
  el.feelPyramidYear.value = START_SIM_YEAR;
  el.pyramidMaxAge.value = 120;
  el.feelPyramidMaxAge.value = 120;
  el.healthLifeExpectancy.value = 85;
  el.healthMaxAge.value = 120;
  [el.zeroPopulation, el.zeroVitals, el.zeroFertility, el.zeroLife, el.zeroAbsoluteGrowth, el.zeroMigrationAbsolute, el.zeroMigrationRate]
    .forEach((input) => { if (input) input.checked = false; });
  if (el.zeroAgePercentile) el.zeroAgePercentile.checked = true;
  localStorage.removeItem("populationVisualizer.sidebarWidth");
  setSidebarWidth(420, false);
  applyCheckpointScenario({ fertilityKey: DEFAULT_FERTILITY_SCENARIO, lifeKey: DEFAULT_LIFE_SCENARIO, updateFertility: true, updateLife: true });
  setPanelPreset([...state.activePanels]);
  resetLayout();
  scheduleRender({ force: true });
}

function setExportFeedback(message) {
  const label = el.exportScenario?.querySelector("span");
  if (!label) return;
  const original = label.dataset.original || label.textContent || "Export";
  label.dataset.original = original;
  label.textContent = message;
  clearTimeout(setExportFeedback.timer);
  setExportFeedback.timer = setTimeout(() => {
    label.textContent = original;
  }, 2200);
}

async function copyTextFallback(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

async function exportScenario() {
  const rows = composeSeries();
  const payload = {
    entity: el.entitySelect.value,
    generatedAt: new Date().toISOString(),
    checkpoints: state.checkpoints,
    rows: rows.map(({ cohorts, ...rest }) => rest)
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `population-scenario-${el.entitySelect.value.replaceAll(" ", "-").toLowerCase()}.json`;
  a.style.display = "none";
  document.body.appendChild(a);
  let copied = false;
  a.click();
  try {
    copied = await copyTextFallback(json);
  } catch (error) {
    copied = false;
  }
  setExportFeedback(copied ? "Copied JSON" : "Exported");
  el.dataStatus.textContent = copied
    ? "Scenario JSON copied to clipboard; a download was also requested."
    : "Scenario JSON download requested.";
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 30000);
}

function countryFlagFromCode(code) {
  if (!/^[A-Z]{2}$/.test(code || "")) return null;
  const base = 127397;
  return [...code].map((char) => String.fromCodePoint(char.charCodeAt(0) + base)).join("");
}

function flagForEntity(entity) {
  const code = rowFor("population", entity, 2023)?.Code
    || rowFor("birthsDeaths", entity, 2023)?.Code
    || rowFor("life", entity, 2023)?.Code;
  const alpha2 = code && code.length === 3 ? {
    AFG: "AF", ALB: "AL", DZA: "DZ", AND: "AD", AGO: "AO", ARG: "AR", ARM: "AM", AUS: "AU", AUT: "AT", AZE: "AZ",
    BHR: "BH", BGD: "BD", BLR: "BY", BEL: "BE", BEN: "BJ", BOL: "BO", BIH: "BA", BWA: "BW", BRA: "BR", BGR: "BG",
    BFA: "BF", BDI: "BI", KHM: "KH", CMR: "CM", CAN: "CA", CAF: "CF", TCD: "TD", CHL: "CL", CHN: "CN", COL: "CO",
    COD: "CD", COG: "CG", CRI: "CR", CIV: "CI", HRV: "HR", CUB: "CU", CYP: "CY", CZE: "CZ", DNK: "DK", DOM: "DO",
    ECU: "EC", EGY: "EG", SLV: "SV", EST: "EE", ETH: "ET", FIN: "FI", FRA: "FR", GAB: "GA", GMB: "GM", GEO: "GE",
    DEU: "DE", GHA: "GH", GRC: "GR", GTM: "GT", GIN: "GN", HTI: "HT", HND: "HN", HKG: "HK", HUN: "HU", ISL: "IS",
    IND: "IN", IDN: "ID", IRN: "IR", IRQ: "IQ", IRL: "IE", ISR: "IL", ITA: "IT", JAM: "JM", JPN: "JP", JOR: "JO",
    KAZ: "KZ", KEN: "KE", KWT: "KW", KGZ: "KG", LAO: "LA", LVA: "LV", LBN: "LB", LSO: "LS", LBR: "LR", LBY: "LY",
    LTU: "LT", LUX: "LU", MDG: "MG", MWI: "MW", MYS: "MY", MLI: "ML", MLT: "MT", MRT: "MR", MUS: "MU", MEX: "MX",
    MDA: "MD", MNG: "MN", MNE: "ME", MAR: "MA", MOZ: "MZ", MMR: "MM", NAM: "NA", NPL: "NP", NLD: "NL", NZL: "NZ",
    NIC: "NI", NER: "NE", NGA: "NG", PRK: "KP", MKD: "MK", NOR: "NO", OMN: "OM", PAK: "PK", PAN: "PA", PRY: "PY",
    PER: "PE", PHL: "PH", POL: "PL", PRT: "PT", QAT: "QA", ROU: "RO", RUS: "RU", RWA: "RW", SAU: "SA", SEN: "SN",
    SRB: "RS", SLE: "SL", SGP: "SG", SVK: "SK", SVN: "SI", ZAF: "ZA", KOR: "KR", ESP: "ES", LKA: "LK", SDN: "SD",
    SWE: "SE", CHE: "CH", SYR: "SY", TWN: "TW", TJK: "TJ", TZA: "TZ", THA: "TH", TGO: "TG", TTO: "TT", TUN: "TN",
    TUR: "TR", TKM: "TM", UGA: "UG", UKR: "UA", ARE: "AE", GBR: "GB", USA: "US", URY: "UY", UZB: "UZ", VEN: "VE",
    VNM: "VN", YEM: "YE", ZMB: "ZM", ZWE: "ZW"
  }[code] : code;
  return countryFlagFromCode(alpha2) || {
    World: "WR", Africa: "AF", Asia: "AS", Europe: "EU", "North America": "NA", "South America": "SA", Oceania: "OC",
    "European Union": "EU", ASEAN: "AS"
  }[entity] || (GROUPS[entity] ? "RG" : "PV");
}

function updatePlaceFlag() {
  if (!el.placeFlag) return;
  el.placeFlag.textContent = flagForEntity(el.entitySelect.value || "World");
  el.placeFlag.classList.toggle("text-mark", (el.placeFlag.textContent || "").length > 2);
}

function populateEntities() {
  const popEntities = new Set(state.rows.population.map((r) => r.Entity));
  const bdEntities = new Set(state.rows.birthsDeaths.map((r) => r.Entity));
  const ageEntities = new Set(state.rows.ageGroups.map((r) => r.Entity));
  const continents = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"];
  const groupNames = Object.keys(GROUPS).filter((entity) => groupMembers(entity).length).sort((a, b) => a.localeCompare(b));
  const countries = [...popEntities]
    .filter((entity) => {
      if (entity === "World" || continents.includes(entity) || entity.includes("(UN)") || GROUPS[entity]) return false;
      const code = rowFor("population", entity, 2023)?.Code || rowFor("populationHistoric", entity, 2023)?.Code;
      return (bdEntities.has(entity) || ageEntities.has(entity)) && code && !code.startsWith("OWID_") && !code.startsWith("UN_");
    })
    .sort((a, b) => a.localeCompare(b));
  state.entities = [...new Set(["World", ...continents.filter((e) => popEntities.has(e)), ...groupNames, ...countries])];
  el.entitySelect.innerHTML = state.entities.map((entity) => `<option value="${entity}">${entity}</option>`).join("");
  el.entitySelect.value = state.entities.includes("World") ? "World" : state.entities[0];
}

async function init() {
  setupCheckpoints();
  renderScenarioButtons();
  renderPanelToggles();
  setupEvents();
  setupDragging();
  setupSidebarResize();
  lucide.createIcons();

  try {
    const entries = Object.entries(DATA_URLS);
    const loaded = await Promise.all(entries.map(([name, url]) => loadDataset(name, url).then((rows) => [name, rows])));
    for (const [name, rows] of loaded) {
      state.rows[name] = rows;
      state.byEntity[name] = indexRows(rows);
    }
    populateEntities();
    applyCheckpointScenario({ fertilityKey: DEFAULT_FERTILITY_SCENARIO, lifeKey: DEFAULT_LIFE_SCENARIO, updateFertility: true, updateLife: true });
    el.dataStatus.textContent = `${state.entities.length} places loaded.`;
    render();
    resetLayout();
  } catch (error) {
    console.error(error);
    el.dataStatus.textContent = "Could not load one or more data sources.";
  }
}

init();

window.populationVisualizer = {
  composeSeries,
  checkpointValue,
  getTfr,
  observedTfr,
  estimatedTfr,
  modelTfrFromBirths,
  state
};
