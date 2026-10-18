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
  life: "https://ourworldindata.org/grapher/life-expectancy.csv"
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
  noSocialRules: { label: "No social rules", points: [{ year: 2030, tfr: 2.0 }, { year: 2035, tfr: 1.9 }, { year: 2040, tfr: 1.6 }, { year: 2050, tfr: 1.2 }, { year: 2070, tfr: 0.9 }, { year: 2100, tfr: 0.9 }] }
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
const feelMapCache = new Map();
const LOW_ESTIMATE_DEFAULT = true;

// Every historical getter is a pure function of the loaded datasets, so results are memoized per
// (entity, year). Indexes over the raw rows replace the repeated sorts and scans the getters used to do.
const dataCaches = [];
function memoByEntityYear(fn) {
  const cache = new Map();
  dataCaches.push(cache);
  return (entity, year) => {
    const key = `${entity}\u0001${year}`;
    let value = cache.get(key);
    if (value === undefined && !cache.has(key)) {
      value = fn(entity, year);
      cache.set(key, value);
    }
    return value;
  };
}
function memoMap() {
  const cache = new Map();
  dataCaches.push(cache);
  return cache;
}
const seriesIndexCache = memoMap();
const finiteYearsCache = memoMap();
const groupMemberCache = memoMap();
const ageGroupYearsCache = memoMap();
function clearDataCaches() {
  dataCaches.forEach((cache) => cache.clear());
  tfrAnchorCache.clear();
  simulationCache.clear();
  historicalCache.clear();
}

function lowerBound(sorted, value) {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
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
  mode: "simulation",
  dynamic: true,
  dirty: false,
  activePanels: new Set(DEFAULT_ACTIVE_PANELS),
  fertilityScenario: DEFAULT_FERTILITY_SCENARIO,
  lifeScenario: DEFAULT_LIFE_SCENARIO,
  populationKeyExpanded: false,
  lifeKeyExpanded: false,
  dynamicPyramidAge: false,
  dynamicFeelPyramidAge: false,
  mortalityCurves: [
    { type: "le", value: 75 },
    { type: "year", value: START_SIM_YEAR }
  ],
  simulatorLayoutPending: false,
  scenario: [],
  historical: []
};

const el = {
  appShell: document.querySelector("#appShell"),
  explanationView: document.querySelector("#explanationView"),
  showSimulator: document.querySelector("#showSimulator"),
  showExplanation: document.querySelector("#showExplanation"),
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
  toggleLifeKey: document.querySelector("#toggleLifeKey"),
  lifeKey: document.querySelector("#lifeKey"),
  dynamicPyramidAge: document.querySelector("#dynamicPyramidAge"),
  dynamicFeelPyramidAge: document.querySelector("#dynamicFeelPyramidAge")
};

// World population (billions) when nobody dies after 2022: life expectancy 500 and caution 1 from 2023, TFR held
// at each level, no migration. Precomputed with this simulator so the guide chart needs no data download.
const CEILING_YEARS = [2022, 2025, 2030, 2035, 2040, 2045, 2050, 2055, 2060, 2065, 2070, 2075, 2080, 2085, 2090, 2095, 2100, 2105, 2110, 2115, 2120, 2125, 2130, 2135, 2140, 2145, 2150, 2155, 2160, 2165, 2170, 2175, 2180, 2185, 2190, 2195, 2200, 2205, 2210, 2215, 2220, 2225, 2230, 2235, 2240, 2245, 2250, 2255, 2260, 2265, 2270, 2275, 2280, 2285, 2290, 2295, 2300, 2305, 2310, 2315, 2320, 2325, 2330, 2335, 2340, 2345, 2350, 2355, 2360, 2365, 2370, 2375, 2380, 2385, 2390, 2395, 2400];
const CEILING_SERIES = [
  { tfr: 0.9, values: [8.021, 8.199, 8.474, 8.757, 9.048, 9.341, 9.611, 9.833, 10.003, 10.142, 10.271, 10.397, 10.513, 10.614, 10.696, 10.765, 10.826, 10.882, 10.933, 10.978, 11.017, 11.05, 11.078, 11.104, 11.127, 11.147, 11.165, 11.181, 11.194, 11.206, 11.216, 11.225, 11.234, 11.241, 11.247, 11.252, 11.257, 11.261, 11.265, 11.268, 11.271, 11.274, 11.276, 11.278, 11.28, 11.281, 11.282, 11.284, 11.285, 11.286, 11.286, 11.287, 11.288, 11.288, 11.289, 11.289, 11.289, 11.29, 11.29, 11.29, 11.29, 11.291, 11.291, 11.291, 11.291, 11.291, 11.291, 11.291, 11.291, 11.292, 11.292, 11.292, 11.292, 11.292, 11.292, 11.292, 11.292] },
  { tfr: 1.0, values: [8.021, 8.211, 8.516, 8.831, 9.155, 9.48, 9.783, 10.037, 10.237, 10.405, 10.565, 10.721, 10.866, 10.993, 11.101, 11.192, 11.275, 11.351, 11.422, 11.486, 11.542, 11.59, 11.632, 11.671, 11.707, 11.738, 11.767, 11.792, 11.814, 11.833, 11.851, 11.867, 11.882, 11.894, 11.906, 11.916, 11.925, 11.933, 11.94, 11.947, 11.953, 11.958, 11.962, 11.966, 11.97, 11.973, 11.976, 11.979, 11.981, 11.983, 11.985, 11.987, 11.988, 11.99, 11.991, 11.992, 11.993, 11.994, 11.995, 11.995, 11.996, 11.996, 11.997, 11.997, 11.998, 11.998, 11.998, 11.999, 11.999, 11.999, 11.999, 12, 12, 12, 12, 12, 12] },
  { tfr: 1.5, values: [8.021, 8.271, 8.729, 9.2, 9.687, 10.179, 10.652, 11.082, 11.467, 11.829, 12.188, 12.546, 12.892, 13.215, 13.514, 13.795, 14.065, 14.329, 14.584, 14.827, 15.054, 15.269, 15.474, 15.671, 15.861, 16.042, 16.214, 16.377, 16.532, 16.68, 16.822, 16.958, 17.087, 17.21, 17.327, 17.439, 17.546, 17.648, 17.745, 17.837, 17.926, 18.01, 18.09, 18.167, 18.24, 18.31, 18.376, 18.439, 18.5, 18.557, 18.612, 18.665, 18.715, 18.763, 18.808, 18.851, 18.893, 18.932, 18.97, 19.006, 19.04, 19.073, 19.104, 19.133, 19.162, 19.189, 19.215, 19.239, 19.263, 19.285, 19.306, 19.327, 19.346, 19.364, 19.382, 19.399, 19.415] },
  { tfr: 1.8, values: [8.021, 8.307, 8.857, 9.422, 10.006, 10.599, 11.18, 11.732, 12.256, 12.769, 13.287, 13.808, 14.322, 14.82, 15.3, 15.769, 16.234, 16.696, 17.154, 17.6, 18.035, 18.46, 18.879, 19.293, 19.702, 20.103, 20.495, 20.878, 21.256, 21.627, 21.993, 22.353, 22.706, 23.052, 23.391, 23.725, 24.054, 24.377, 24.694, 25.005, 25.311, 25.611, 25.906, 26.196, 26.481, 26.761, 27.036, 27.306, 27.572, 27.832, 28.089, 28.34, 28.587, 28.83, 29.069, 29.303, 29.533, 29.759, 29.982, 30.2, 30.414, 30.625, 30.832, 31.035, 31.235, 31.431, 31.624, 31.814, 32, 32.183, 32.362, 32.539, 32.712, 32.882, 33.049, 33.214, 33.375] },
  { tfr: 2.0, values: [8.021, 8.331, 8.942, 9.57, 10.219, 10.879, 11.536, 12.175, 12.802, 13.432, 14.072, 14.721, 15.368, 16.009, 16.642, 17.274, 17.911, 18.552, 19.194, 19.833, 20.468, 21.101, 21.736, 22.373, 23.01, 23.647, 24.281, 24.914, 25.547, 26.181, 26.815, 27.449, 28.082, 28.714, 29.345, 29.977, 30.609, 31.24, 31.871, 32.501, 33.131, 33.761, 34.39, 35.019, 35.648, 36.277, 36.904, 37.532, 38.159, 38.787, 39.413, 40.04, 40.666, 41.291, 41.917, 42.542, 43.166, 43.791, 44.415, 45.039, 45.662, 46.285, 46.908, 47.53, 48.152, 48.774, 49.395, 50.016, 50.637, 51.257, 51.877, 52.497, 53.116, 53.736, 54.354, 54.973, 55.591] }
];
const CEILING_COLORS = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"];
const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (parent) parent.appendChild(node);
  return node;
}

// The guide's "population ceiling" chart: plain SVG with direct labels, a legend, and a crosshair tooltip.
function renderCeilingChart() {
  const host = document.querySelector("[data-ceiling-chart]");
  if (!host || !host.offsetParent) return;
  const width = Math.max(300, Math.round(host.clientWidth));
  if (host.dataset.renderedWidth === String(width)) return;
  host.dataset.renderedWidth = String(width);
  host.textContent = "";

  const legend = document.createElement("div");
  legend.className = "guide-chart-legend";
  CEILING_SERIES.forEach((series, i) => {
    const item = document.createElement("span");
    const key = document.createElement("i");
    key.style.background = CEILING_COLORS[i];
    item.append(key, document.createTextNode(`TFR ${series.tfr.toFixed(1)}`));
    legend.appendChild(item);
  });
  host.appendChild(legend);

  const narrow = width < 560;
  const height = narrow ? 300 : 360;
  const m = { top: 14, right: narrow ? 64 : 84, bottom: 30, left: 44 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  const x0 = CEILING_YEARS[0];
  const x1 = CEILING_YEARS[CEILING_YEARS.length - 1];
  const yMax = 60;
  const sx = (year) => m.left + (year - x0) / (x1 - x0) * plotW;
  const sy = (value) => m.top + (1 - value / yMax) * plotH;

  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, width, height, class: "guide-chart-svg" }, host);
  const grid = svgEl("g", { class: "guide-chart-grid" }, svg);
  for (let v = 0; v <= yMax; v += 10) {
    svgEl("line", { x1: m.left, x2: m.left + plotW, y1: sy(v), y2: sy(v), class: v === 0 ? "axis" : "" }, grid);
    svgEl("text", { x: m.left - 8, y: sy(v) + 4, "text-anchor": "end" }, grid).textContent = v === 0 ? "0" : `${v}B`;
  }
  const yearStep = narrow ? 100 : 50;
  for (let year = 2050; year <= x1; year += yearStep) {
    svgEl("text", { x: sx(year), y: m.top + plotH + 20, "text-anchor": "middle" }, grid).textContent = String(year);
  }
  svgEl("line", { x1: m.left, x2: m.left + plotW, y1: sy(8.02), y2: sy(8.02), class: "guide-chart-today" }, svg);
  svgEl("text", { x: m.left + plotW - 4, y: sy(8.02) + 15, "text-anchor": "end", class: "guide-chart-note" }, svg).textContent = "2022: 8.0 billion";

  const labels = [];
  CEILING_SERIES.forEach((series, i) => {
    const d = series.values.map((v, j) => `${j ? "L" : "M"}${sx(CEILING_YEARS[j]).toFixed(1)},${sy(v).toFixed(1)}`).join("");
    svgEl("path", { d, fill: "none", stroke: CEILING_COLORS[i], "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    labels.push({ y: sy(series.values[series.values.length - 1]), text: `TFR ${series.tfr.toFixed(1)}`, color: CEILING_COLORS[i] });
  });
  // Direct labels at the line ends, nudged apart where lines finish close together.
  labels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i += 1) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 13);
  labels.forEach((label) => {
    svgEl("text", { x: m.left + plotW + 8, y: label.y + 4, class: "guide-chart-label" }, svg).textContent = label.text;
  });

  const cross = svgEl("line", { y1: m.top, y2: m.top + plotH, class: "guide-chart-cross", visibility: "hidden" }, svg);
  const dots = CEILING_SERIES.map((_, i) => svgEl("circle", { r: 4, fill: CEILING_COLORS[i], stroke: "#ffffff", "stroke-width": 2, visibility: "hidden" }, svg));
  const hit = svgEl("rect", { x: m.left, y: m.top, width: plotW, height: plotH, fill: "transparent", tabindex: 0, "aria-label": "Population by year; use the arrow keys to read values" }, svg);
  const tip = document.createElement("div");
  tip.className = "guide-chart-tip";
  tip.hidden = true;
  host.appendChild(tip);

  let index = CEILING_YEARS.length - 1;
  const show = (j) => {
    index = clamp(j, 0, CEILING_YEARS.length - 1);
    const year = CEILING_YEARS[index];
    const x = sx(year);
    cross.setAttribute("x1", x);
    cross.setAttribute("x2", x);
    cross.setAttribute("visibility", "visible");
    tip.textContent = "";
    const title = document.createElement("strong");
    title.textContent = String(year);
    tip.appendChild(title);
    CEILING_SERIES.slice().reverse().forEach((series) => {
      const i = CEILING_SERIES.indexOf(series);
      const value = series.values[index];
      dots[i].setAttribute("cx", x);
      dots[i].setAttribute("cy", sy(value));
      dots[i].setAttribute("visibility", "visible");
      const row = document.createElement("span");
      const key = document.createElement("i");
      key.style.background = CEILING_COLORS[i];
      const number = document.createElement("b");
      number.textContent = `${value.toFixed(1)} billion`;
      row.append(key, number, document.createTextNode(` TFR ${series.tfr.toFixed(1)}`));
      tip.appendChild(row);
    });
    tip.hidden = false;
    const left = x + 14 + 170 > width ? x - 14 - 170 : x + 14;
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${legend.offsetHeight + m.top}px`;
  };
  const hide = () => {
    cross.setAttribute("visibility", "hidden");
    dots.forEach((dot) => dot.setAttribute("visibility", "hidden"));
    tip.hidden = true;
  };
  const nearest = (clientX) => {
    const rect = svg.getBoundingClientRect();
    const year = x0 + (clientX - rect.left - m.left) / plotW * (x1 - x0);
    let best = 0;
    CEILING_YEARS.forEach((y, j) => { if (Math.abs(y - year) < Math.abs(CEILING_YEARS[best] - year)) best = j; });
    return best;
  };
  hit.addEventListener("pointermove", (event) => show(nearest(event.clientX)));
  hit.addEventListener("pointerleave", hide);
  hit.addEventListener("focus", () => show(index));
  hit.addEventListener("blur", hide);
  hit.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") show(index + 1);
    else if (event.key === "ArrowLeft") show(index - 1);
    else return;
    event.preventDefault();
  });
}

function primaryViewFromHash() {
  const hash = window.location.hash || "";
  return hash === "#explanation" || hash.startsWith("#guide-") ? "explanation" : "simulator";
}

function setPrimaryView(view, { scrollToTop = false } = {}) {
  const showExplanation = view === "explanation";
  if (el.appShell) el.appShell.hidden = showExplanation;
  if (el.explanationView) el.explanationView.hidden = !showExplanation;
  document.body.classList.toggle("explanation-open", showExplanation);
  el.showSimulator?.classList.toggle("active", !showExplanation);
  el.showExplanation?.classList.toggle("active", showExplanation);
  el.showSimulator?.setAttribute("aria-selected", String(!showExplanation));
  el.showExplanation?.setAttribute("aria-selected", String(showExplanation));

  if (showExplanation) {
    if (scrollToTop) el.explanationView?.scrollTo({ top: 0, behavior: "smooth" });
    window.requestAnimationFrame(renderCeilingChart);
    return;
  }

  window.requestAnimationFrame(() => {
    if (state.simulatorLayoutPending) {
      resetLayout();
      state.simulatorLayoutPending = false;
    } else {
      fitDashboardHeight();
    }
    document.querySelectorAll(".chart").forEach((chart) => {
      if (chart.offsetParent) Plotly.Plots.resize(chart).catch(() => {});
    });
  });
}

function navigatePrimaryView(view) {
  const hash = view === "explanation" ? "#explanation" : "#simulator";
  if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  setPrimaryView(view, { scrollToTop: true });
}

function setupPrimaryViews() {
  el.showSimulator?.addEventListener("click", () => navigatePrimaryView("simulator"));
  el.showExplanation?.addEventListener("click", () => navigatePrimaryView("explanation"));
  document.querySelectorAll("[data-open-simulator]").forEach((button) => {
    button.addEventListener("click", () => navigatePrimaryView("simulator"));
  });
  window.addEventListener("hashchange", () => {
    const view = primaryViewFromHash();
    setPrimaryView(view);
    if (view === "explanation" && window.location.hash.startsWith("#guide-")) {
      window.requestAnimationFrame(() => document.querySelector(window.location.hash)?.scrollIntoView({ block: "start" }));
    }
  });
  window.addEventListener("popstate", () => setPrimaryView(primaryViewFromHash()));
  setPrimaryView(primaryViewFromHash());
}

// OWID grapher CSVs are one record per line and rarely quoted, so lines are split directly and only lines that
// contain quotes go through the full quote-aware tokenizer.
function parseCsv(text) {
  const lines = text.split("\n");
  const headers = splitCsvLine(stripCarriageReturns(lines[0] || ""));
  const keep = headers.map((h) => h !== "Code" && h !== "Entity");
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    if (line.includes('"') && !quotesBalanced(line)) return parseCsvQuoted(text);
    const cells = line.includes('"') ? splitCsvLine(stripCarriageReturns(line)) : stripCarriageReturns(line).split(",");
    if (cells.length !== headers.length) continue;
    const obj = {};
    for (let c = 0; c < headers.length; c += 1) {
      const value = cells[c];
      if (keep[c] && value !== "") {
        const number = Number(value);
        obj[headers[c]] = Number.isNaN(number) ? value : number;
      } else {
        obj[headers[c]] = value;
      }
    }
    rows.push(obj);
  }
  return rows;
}

function stripCarriageReturns(line) {
  return line.includes("\r") ? line.replace(/\r/g, "") : line;
}

function quotesBalanced(line) {
  let count = 0;
  for (let i = 0; i < line.length; i += 1) if (line[i] === '"') count += 1;
  return count % 2 === 0;
}

function splitCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
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
      cells.push(cell);
      cell = "";
    } else {
      cell += c;
    }
  }
  cells.push(cell);
  return cells;
}

// Fallback for files with quoted line breaks: the original character-by-character parser.
function parseCsvQuoted(text) {
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
  let members = groupMemberCache.get(entity);
  if (!members) {
    members = (GROUPS[entity] || []).filter((member) => state.byEntity.population?.has(member) || state.byEntity.populationHistoric?.has(member));
    groupMemberCache.set(entity, members);
  }
  return members;
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
  const key = `${dataset}\u0001${entity}\u0001${cols.join("\u0002")}`;
  const cached = finiteYearsCache.get(key);
  if (cached) return cached;
  const years = [];
  for (const candidate of entityCandidates(entity)) {
    const entityMap = state.byEntity[dataset]?.get(candidate);
    if (!entityMap) continue;
    for (const [year, row] of entityMap.entries()) {
      if (cols.some((col) => Number.isFinite(row?.[col]))) years.push(year);
    }
  }
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  finiteYearsCache.set(key, sorted);
  return sorted;
}

// Sorted (year, first-finite-column value) pairs for one entity of one dataset, used for interpolation.
function seriesIndex(dataset, entity, cols) {
  const key = `${dataset}\u0001${entity}\u0001${cols.join("\u0002")}`;
  let index = seriesIndexCache.get(key);
  if (index) return index;
  const entityMap = state.byEntity[dataset]?.get(entity);
  const years = [];
  const values = [];
  if (entityMap) {
    const sortedYears = [...entityMap.keys()].sort((a, b) => a - b);
    for (const y of sortedYears) {
      const value = firstFinite(entityMap.get(y), cols);
      if (value !== null) {
        years.push(y);
        values.push(value);
      }
    }
  }
  index = { years, values, present: Boolean(entityMap) };
  seriesIndexCache.set(key, index);
  return index;
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

  const { years, values, present } = seriesIndex(dataset, entity, cols);
  if (!present || !years.length) return null;
  // The exact year had no finite value, so the bracketing points are strictly before and after it.
  const i = lowerBound(years, year);
  const afterIndex = years[i] === year ? i + 1 : i;
  const beforeIndex = i - 1;
  const hasBefore = beforeIndex >= 0;
  const hasAfter = afterIndex < years.length;
  if (!hasBefore && !hasAfter) return null;
  if (!hasBefore) return values[afterIndex];
  if (!hasAfter) return values[beforeIndex];
  const before = years[beforeIndex];
  const after = years[afterIndex];
  const a = values[beforeIndex];
  const b = values[afterIndex];
  const t = (year - before) / (after - before);
  return a + (b - a) * t;
}

function firstFinite(row, cols) {
  for (const col of cols) {
    if (Number.isFinite(row?.[col])) return row[col];
  }
  return null;
}

// Building an Intl.NumberFormat is expensive and the pyramids format one value per bar, so formatters are reused.
const numberFormatters = new Map();
function formatNumber(n, compact = true) {
  if (!Number.isFinite(n)) return "";
  const key = `${compact ? "c" : "s"}${n >= 10 ? 1 : 2}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en", {
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: n >= 10 ? 1 : 2
    });
    numberFormatters.set(key, formatter);
  }
  return formatter.format(n);
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

// The 2022 starting point of every checkpoint path. Groups without their own fertility series (the EU, ASEAN,
// UN regions) use the TFR estimated from their combined births, the same value the 2022 handoff row shows.
function checkpointBaseline(entity) {
  return {
    year: START_SIM_YEAR,
    tfr: getTfr(entity, START_SIM_YEAR) ?? getTfr(entity, START_SIM_YEAR - 1) ?? 2.2,
    life: getLife(entity, START_SIM_YEAR) ?? getLife(entity, START_SIM_YEAR - 1) ?? 73,
    migration: 0,
    caution: 0
  };
}

function valueFromCheckpoints(checkpoints, year, key, entity = el.entitySelect.value || "World") {
  const baseline = checkpointBaseline(entity);
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

function childExternalHazard(age, targetLife) {
  const lowLife = clamp((82 - targetLife) / 45, 0, 1);
  const highLife = clamp((targetLife - 85) / 70, 0, 1);
  const infant = (0.003 + 0.14 * lowLife) * Math.exp(-age / 1.65);
  const child = 0.00012 + 0.012 * lowLife * Math.exp(-Math.max(age - 1, 0) / 7);
  const external = (0.00034 + 0.0018 * lowLife) * Math.exp(-Math.pow((age - 24) / 17, 2));
  const senescenceFloor = highLife * 0.00003;
  return infant + child + external + senescenceFloor;
}

// exp(0.088 * (age - 45)) for every age, so a Gompertz shift becomes one scalar factor per curve.
const GOMPERTZ_AGE_FACTOR = Float64Array.from({ length: MAX_AGE + 1 }, (_, age) => Math.exp(0.088 * (age - 45)));

function buildMortalityCurve(targetLife, kind = "general") {
  const cacheKey = `${kind}:${Number(targetLife).toFixed(2)}`;
  const cached = mortalityCache.get(cacheKey);
  if (cached) return cached;
  // The non-disease components depend on the target life expectancy but not on the shift being searched.
  const external = new Float64Array(MAX_AGE + 1);
  if (kind !== "disease") {
    for (let age = 0; age <= MAX_AGE; age += 1) external[age] = childExternalHazard(age, targetLife);
  }
  let lo = -120;
  let hi = 650;
  for (let i = 0; i < 46; i += 1) {
    const mid = (lo + hi) / 2;
    const life = lifeExpectancyForShift(external, mid);
    if (life < targetLife) lo = mid;
    else hi = mid;
  }
  const rates = ratesForShift(external, (lo + hi) / 2);
  mortalityCache.set(cacheKey, rates);
  return rates;
}

function annualDeathProbability(age, external, shiftFactor) {
  const disease = age < 20 ? 0.00004 : 0.00018 + 0.00022 * GOMPERTZ_AGE_FACTOR[age] * shiftFactor;
  const q = 1 - Math.exp(-(disease + external[age]));
  return q < 0.000001 ? 0.000001 : q > 0.995 ? 0.995 : q;
}

function lifeExpectancyForShift(external, shift) {
  const shiftFactor = Math.exp(-0.088 * shift);
  let survivors = 1;
  let years = 0;
  for (let age = 0; age < MAX_AGE; age += 1) {
    years += survivors;
    survivors *= 1 - annualDeathProbability(age, external, shiftFactor);
    // Past this point the remaining terms add less than 1e-13 years.
    if (survivors < 1e-16) return years + survivors;
  }
  return years + survivors;
}

function ratesForShift(external, shift) {
  const shiftFactor = Math.exp(-0.088 * shift);
  const rates = new Array(MAX_AGE + 1);
  for (let age = 0; age < MAX_AGE; age += 1) rates[age] = annualDeathProbability(age, external, shiftFactor);
  rates[MAX_AGE] = 0.995;
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

function survivalToAge(qx, ageLimit) {
  let s = 1;
  for (let age = 0; age < ageLimit; age += 1) {
    s *= 1 - qx[age];
  }
  return s;
}

function feelAgeFor(actualAge, life) {
  if (actualAge < 20) return actualAge;
  return feelAgeMap(life)[Math.round(clamp(actualAge, 0, MAX_AGE))];
}

// Feel age for every whole age under one life expectancy. The LE-75 disease curve is non-decreasing from
// age 20, so the first bracketing interval is found by binary search instead of a linear scan per age.
function feelAgeMap(life) {
  const key = Number(life).toFixed(2);
  const cached = feelMapCache.get(key);
  if (cached) return cached;
  const scenario = buildMortalityCurve(life, "disease");
  const baseline = buildMortalityCurve(75, "disease");
  const map = new Float64Array(MAX_AGE + 1);
  for (let actual = 0; actual <= MAX_AGE; actual += 1) {
    if (actual < 20) {
      map[actual] = actual;
      continue;
    }
    const target = scenario[actual];
    if (target < baseline[20]) {
      map[actual] = 20;
      continue;
    }
    let lo = 20;
    let hi = MAX_AGE - 1;
    if (baseline[MAX_AGE] < target) {
      map[actual] = MAX_AGE;
      continue;
    }
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (baseline[mid + 1] >= target) hi = mid;
      else lo = mid + 1;
    }
    const a = baseline[lo];
    const b = baseline[lo + 1];
    map[actual] = b > a ? lo + (target - a) / (b - a) : lo;
  }
  feelMapCache.set(key, map);
  return map;
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

function ageGroupYears(entity) {
  let unique = ageGroupYearsCache.get(entity);
  if (unique) return unique;
  const years = [];
  for (const candidate of entityCandidates(entity)) {
    const entityMap = state.byEntity.ageGroups?.get(candidate);
    if (!entityMap) continue;
    for (const [candidateYear, row] of entityMap.entries()) {
      if (rowHasAgeGroups(row)) years.push(candidateYear);
    }
  }
  unique = [...new Set(years)].sort((a, b) => a - b);
  ageGroupYearsCache.set(entity, unique);
  return unique;
}

function nearestAgeGroupYear(entity, year) {
  const unique = ageGroupYears(entity);
  if (!unique.length) return null;
  const i = lowerBound(unique, year);
  if (unique[i] === year) return year;
  return i > 0 ? unique[i - 1] : null;
}

function fiveYearToSingleAgeRaw(entity, year) {
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

function cohortsForYearRaw(entity, year, population = getPopulation(entity, year)) {
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

// Migrants by age: a young-adult peak, children who move with their parents, and a small background that fades
// after 60, so that net migration lands at the ages people actually migrate (not spread out to age 500).
const MIGRATION_PROFILE = Array.from({ length: MAX_AGE + 1 }, (_, age) => {
  const workingAge = Math.exp(-Math.pow((age - 29) / 18, 2));
  const family = 0.45 * Math.exp(-Math.pow((age - 7) / 9, 2));
  const background = 0.2 * (age <= 60 ? 1 : Math.exp(-(age - 60) / 8));
  return background + workingAge + family;
});
const MIGRATION_PROFILE_TOTAL = MIGRATION_PROFILE.reduce((a, b) => a + b, 0);

function distributeMigration(cohorts, totalMigration) {
  const out = new Array(cohorts.length);
  for (let age = 0; age < cohorts.length; age += 1) {
    out[age] = Math.max(0, cohorts[age] + totalMigration * MIGRATION_PROFILE[age] / MIGRATION_PROFILE_TOTAL);
  }
  return out;
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

function getPopulationRaw(entity, year) {
  if (isGroupEntity(entity)) return aggregateSum(entity, year, getPopulation);
  return valueForAny("population", entity, year, ["Population", "Population (projections) (Projected)"])
    ?? valueForAny("populationHistoric", entity, year, "Population");
}

function getBirthsRaw(entity, year) {
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

function getDeathsRaw(entity, year) {
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

function observedTfrRaw(entity, year) {
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

function populationGrowthFractionRaw(entity, year) {
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

function modelTfrFromBirthsRaw(entity, year) {
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

function getTfrRaw(entity, year) {
  return observedTfr(entity, year) ?? estimatedTfr(entity, year);
}

function getLifeRaw(entity, year) {
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

const fiveYearToSingleAge = memoByEntityYear(fiveYearToSingleAgeRaw);
const cohortsForYear = memoByEntityYear((entity, year) => cohortsForYearRaw(entity, year));
const getPopulation = memoByEntityYear(getPopulationRaw);
const getBirths = memoByEntityYear(getBirthsRaw);
const getDeaths = memoByEntityYear(getDeathsRaw);
const observedTfr = memoByEntityYear(observedTfrRaw);
const populationGrowthFraction = memoByEntityYear(populationGrowthFractionRaw);
const modelTfrFromBirths = memoByEntityYear(modelTfrFromBirthsRaw);
const getTfr = memoByEntityYear(getTfrRaw);
const getLife = memoByEntityYear(getLifeRaw);

function getChildMortality(entity, year, life) {
  const qx = buildMortalityCurve(life || 73, "general");
  return (1 - survivalToAge(qx, 15)) * 100;
}

function lifeWithRateSchedule(baseLife, targetYear, schedule, capped = true) {
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
  return capped ? clamp(life, 1, MAX_AGE) : life;
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
    // Checkpoints also go in the years the path reaches 85 and 95, so its two changes of pace are kept.
    const reach85 = baseLife < 85 ? START_SIM_YEAR + Math.round((85 - baseLife) / 0.25) : null;
    const reach95 = START_SIM_YEAR + Math.round(Math.max(0, 85 - baseLife) / 0.25 + (95 - Math.max(baseLife, 85)) / 0.1);
    const years = [...new Set([2030, 2050, 2100, 2400, reach85, reach95])]
      .filter((year) => Number.isFinite(year) && year > START_SIM_YEAR && year <= 2400)
      .sort((a, b) => a - b);
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
    return withCeilingPoint([2030, 2035, 2040, 2050, 2100, 2400], (year) => lifeWithRateSchedule(baseLife, year, schedule, false), point);
  }
  if (key === "fastLev") {
    // A deployment jump: the usual early gains, then 150 by 2050, then 1.5 years per year until the model ceiling.
    const early = {
      2030: baseLife + (2030 - START_SIM_YEAR) * 0.25,
      2035: baseLife + 8 * 0.25 + 5 * 0.8,
      2040: baseLife + 8 * 0.25 + 5 * 0.8 + 5 * 1.5
    };
    return withCeilingPoint([2030, 2035, 2040, 2050, 2100, 2400], (year) => early[year] ?? 150 + (year - 2050) * 1.5, point);
  }
  const schedule = [{ until: 2030, rate: 0.25 }, { until: 2035, rate: 0.5 }, { until: 2040, rate: 1.0 }, { until: 2400, rate: 1.5 }];
  return withCeilingPoint([2030, 2035, 2040, 2050, 2100, 2400], (year) => lifeWithRateSchedule(baseLife, year, schedule, false), point);
}

// When a preset's annual gains would carry it past the age-500 ceiling before 2400, add a checkpoint in the year
// it gets there, so the path keeps its stated slope instead of being stretched linearly out to 2400.
function withCeilingPoint(years, lifeAt, point) {
  const points = years.map((year) => point(year, lifeAt(year)));
  const last = years[years.length - 1];
  if (lifeAt(last) <= MAX_AGE) return points;
  let lo = years[0];
  let hi = last;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (lifeAt(mid) >= MAX_AGE) hi = mid;
    else lo = mid + 1;
  }
  if (!years.includes(lo)) points.push(point(lo, MAX_AGE));
  return points.sort((a, b) => a.year - b.year);
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
    life: roundHalf(updateLife
      ? valueFromScenarioPoints(lifePoints, year, "life", valueFromCheckpoints(previous, year, "life", entity))
      : valueFromCheckpoints(previous, year, "life", entity)),
    migration: valueFromCheckpoints(previous, year, "migration", entity),
    caution: valueFromCheckpoints(previous, year, "caution", entity)
  }));
  if (updateFertility) state.fertilityScenario = fertilityKey;
  if (updateLife) {
    state.lifeScenario = lifeKey;
    state.lifeEdited = false;
    state.presetEntity = entity;
  }
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
    rows.push({ year, population, births, deaths, tfr, adjustedTfr, life, childMortality, growth, absoluteGrowth, migration, migrationAbsolute, cohorts, source: year > START_SIM_YEAR ? "projection" : "estimate" });
  }
  return rows;
}

// Piecewise-linear checkpoint paths, anchored on the observed 2022 values, evaluated once per simulation.
function checkpointInterpolator(checkpoints, entity) {
  const baseline = checkpointBaseline(entity);
  const points = [baseline, ...checkpoints.filter((p) => p.year > START_SIM_YEAR)].sort((a, b) => a.year - b.year);
  return (year, key) => {
    if (year <= points[0].year) return points[0][key];
    if (year >= points[points.length - 1].year) return points[points.length - 1][key];
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      if (year >= a.year && year <= b.year) return lerp(a[key], b[key], (year - a.year) / (b.year - a.year));
    }
    return points[points.length - 1][key];
  };
}

// The forward simulation depends only on the place and the checkpoints, and each simulated year depends only
// on earlier years, so one run is cached per configuration and extended on demand when a later year is needed.
const simulationCache = new Map();

function simulationKey(entity, checkpoints) {
  return `${entity}\u0001${JSON.stringify(checkpoints.map((p) => [p.year, p.tfr, p.life, p.migration, p.caution ?? 0]))}`;
}

function buildScenario(entity, start, end, checkpoints = state.checkpoints) {
  const key = simulationKey(entity, checkpoints);
  let sim = simulationCache.get(key);
  if (!sim) {
    if (simulationCache.size > 24) simulationCache.delete(simulationCache.keys().next().value);
    sim = { rows: [], cohorts: null, value: checkpointInterpolator(checkpoints, entity) };
    simulationCache.set(key, sim);
  }
  extendSimulation(entity, sim, end);
  const lastIndex = Math.min(sim.rows.length, end - START_SIM_YEAR + 1);
  return sim.rows.slice(Math.max(0, start - START_SIM_YEAR), lastIndex);
}

function extendSimulation(entity, sim, end) {
  const { rows, value } = sim;
  let cohorts = sim.cohorts;
  for (let year = START_SIM_YEAR + rows.length; year <= end; year += 1) {
    if (year === START_SIM_YEAR) {
      cohorts = cohortsForYear(entity, year, getPopulation(entity, year));
      const population = getPopulation(entity, year) || cohorts.reduce((a, b) => a + b, 0);
      const cohortTotal = cohorts.reduce((a, b) => a + b, 0);
      if (population > 0 && cohortTotal > 0) cohorts = cohorts.map((v) => v * population / cohortTotal);
      const births = getBirths(entity, year);
      const deaths = getDeaths(entity, year);
      const tfr = getTfr(entity, year) ?? value(year, "tfr");
      const life = getLife(entity, year);
      const childMortality = getChildMortality(entity, year, life);
      const migration = value(year, "migration");
      const caution = value(year, "caution");
      rows.push({
        year,
        population,
        births,
        deaths,
        tfr,
        adjustedTfr: tfr * (1 - childMortality / 100),
        life,
        childMortality,
        growth: population ? ((births - deaths) / population + (entity === "World" ? 0 : migration) / 1000) * 100 : 0,
        absoluteGrowth: births - deaths + (entity === "World" ? 0 : population * migration / 1000),
        migration: entity === "World" ? 0 : migration,
        migrationAbsolute: entity === "World" ? 0 : population * migration / 1000,
        caution,
        cohorts: cohorts.slice(),
        source: "anchor"
      });
      // Observed 2022 deaths are kept; the curve only decides how they are distributed across ages.
      const qx = applyCaution(buildMortalityCurve(life, "general"), caution);
      cohorts = advanceCohorts(cohorts, births, qx, migration, { targetDeaths: deaths }).cohorts;
      continue;
    }
    const tfr = value(year, "tfr");
    const life = value(year, "life");
    const migration = value(year, "migration");
    const caution = value(year, "caution");
    const qx = applyCaution(buildMortalityCurve(life, "general"), caution);
    const births = simulateBirths(cohorts, tfr);
    const childMortality = (1 - survivalToAge(qx, 15)) * 100;
    let population = 0;
    for (let age = 0; age <= MAX_AGE; age += 1) population += cohorts[age];
    const advanced = advanceCohorts(cohorts, births, qx, migration);
    const previous = rows[rows.length - 1];
    rows.push({
      year,
      population,
      births,
      deaths: advanced.deaths,
      tfr,
      adjustedTfr: tfr * (1 - childMortality / 100),
      life,
      childMortality,
      growth: (population / previous.population - 1) * 100,
      absoluteGrowth: population - previous.population,
      migration,
      migrationAbsolute: population * migration / 1000,
      caution,
      cohorts,
      source: "scenario"
    });
    cohorts = advanced.cohorts;
  }
  sim.cohorts = cohorts;
}

function ageIntervalShare(cohorts, startAge, endAge) {
  let total = 0;
  let selected = 0;
  const lo = Math.floor(startAge);
  const hi = Math.floor(endAge);
  for (let age = 0; age <= MAX_AGE; age += 1) {
    const value = cohorts[age] || 0;
    total += value;
    if (age >= lo && age <= hi) selected += value;
  }
  return total ? selected / total * 100 : 0;
}

function ageMetricSettings() {
  const start = clamp(Number(el.ageShareStart.value) || 0, 0, MAX_AGE);
  const end = clamp(Number(el.ageShareEnd.value) || MAX_AGE, start, MAX_AGE);
  return { start, end, percentile: selectedPercentile() };
}

// Age share and (feel-)percentile ages depend on panel-level settings, so they are attached to the cached rows
// lazily and only recomputed for a row when those settings change.
const AGE_METRICS_KEY = Symbol("ageMetricsKey");
function attachAgeMetrics(rows) {
  const settings = ageMetricSettings();
  const key = `${settings.start}|${settings.end}|${settings.percentile}`;
  for (const row of rows) {
    if (!row || row[AGE_METRICS_KEY] === key) continue;
    row.ageShare = ageIntervalShare(row.cohorts, settings.start, settings.end);
    row.percentileAge = percentileAge(row.cohorts, settings.percentile);
    row.adjustedPercentileAge = percentileAge(feelDistribution(row.cohorts, row.life || 75), settings.percentile);
    row[AGE_METRICS_KEY] = key;
  }
  return rows;
}

const historicalCache = new Map();
function cachedHistorical(entity, start, end) {
  const key = `${entity}\u0001${start}\u0001${end}`;
  let rows = historicalCache.get(key);
  if (!rows) {
    if (historicalCache.size > 24) historicalCache.delete(historicalCache.keys().next().value);
    rows = buildHistorical(entity, start, end);
    historicalCache.set(key, rows);
  }
  return rows;
}

function seriesSettings() {
  return {
    entity: el.entitySelect.value || "World",
    start: Number(el.yearStart.value) || 1800,
    end: Number(el.yearEnd.value) || 2200
  };
}

function composeSeries({ entity, start, end } = seriesSettings(), checkpoints = state.checkpoints) {
  state.historical = cachedHistorical(entity, start, Math.min(end, START_SIM_YEAR));
  state.scenario = end >= START_SIM_YEAR ? buildScenario(entity, START_SIM_YEAR, end, checkpoints) : [];
  const combined = [];
  for (const row of state.historical) {
    if (row.year < START_SIM_YEAR || !state.scenario.length) combined.push(row);
  }
  for (const row of state.scenario) {
    if (row.year >= start && row.year <= end) combined.push(row);
  }
  return attachAgeMetrics(combined);
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
  { min: 2, label: "> 2%", color: "#9f201f" },
  { min: 1.5, max: 2, label: "1.5-2%", color: "#c85b16" },
  { min: 1, max: 1.5, label: "1-1.5%", color: "#d4921e" },
  { min: 0.75, max: 1, label: "0.75-1%", color: "#dfc33a" },
  { min: 0.5, max: 0.75, label: "0.5-0.75%", color: "#9bc93a" },
  { min: 0.25, max: 0.5, label: "0.25-0.5%", color: "#3f9e4b" },
  { min: 0.1, max: 0.25, label: "0.1-0.25%", color: "#176b3a" },
  { min: 0, max: 0.1, label: "0-0.1%", color: "#17838c" },
  { min: -0.25, max: 0, label: "-0.25-0%", color: "#36b8ff" },
  { min: -0.5, max: -0.25, label: "-0.5--0.25%", color: "#1d65f2" },
  { min: -1, max: -0.5, label: "-1--0.5%", color: "#7c45c4" },
  { max: -1, label: "< -1%", color: "#8b145a" }
];

const LIFE_CHANGE_COLORS = [
  { max: 0, label: "decrease", color: "#9f201f" },
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

// One trace per colour band (runs separated by gaps) instead of one trace per year: the picture is the same,
// but Plotly draws about a dozen traces instead of several hundred.
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
  const runs = new Map();
  let firstColor = null;
  for (let i = 1; i < years.length; i += 1) {
    const metric = Number.isFinite(metricValues[i]) ? metricValues[i] : metricValues[i - 1];
    const color = colorForValue(metric, bands);
    if (firstColor === null) firstColor = color;
    let run = runs.get(color);
    if (!run) {
      run = { x: [], y: [] };
      runs.set(color, run);
    }
    if (run.x.length && run.x[run.x.length - 1] === years[i - 1]) {
      run.x.push(years[i]);
      run.y.push(values[i]);
    } else {
      if (run.x.length) {
        run.x.push(null);
        run.y.push(null);
      }
      run.x.push(years[i - 1], years[i]);
      run.y.push(values[i - 1], values[i]);
    }
  }
  const segments = [outline];
  for (const [color, run] of runs) {
    segments.push({
      x: run.x,
      y: run.y,
      name,
      type: "scatter",
      mode: "lines",
      line: { color, width: 3 },
      connectgaps: false,
      legendgroup: name,
      showlegend: color === firstColor,
      hoverinfo: "skip"
    });
  }
  segments.push({
    x: years,
    y: values,
    name,
    type: "scatter",
    mode: "markers",
    marker: { color: "rgba(0,0,0,0)", size: 10 },
    showlegend: false,
    hovertemplate: "Year %{x}<br>%{y:" + hoverFormat + "}<extra>" + name + "</extra>"
  });
  return segments;
}

function renderColorKey(container, bands) {
  if (!container) return;
  container.innerHTML = bands.map((band) => `
    <span class="key-item"><span class="key-swatch" style="background:${band.color}"></span>${band.label}</span>
  `).join("");
}

// Rendering has two halves: computing the series (only when the place, the year window or the checkpoints change)
// and drawing panels from the last computed series. Requests made in the same frame are coalesced into one.
const pendingRender = { compute: false, panels: new Set(), frame: 0, timer: 0, waiters: [] };

function scheduleRender({ force = false, panels = null, debounce = 0 } = {}) {
  const viewOnly = Array.isArray(panels);
  if (!viewOnly && !force && !state.dynamic) {
    state.dirty = true;
    el.updateCharts?.classList.add("dirty");
    return;
  }
  if (viewOnly) panels.forEach((panel) => pendingRender.panels.add(panel));
  else pendingRender.compute = true;
  window.clearTimeout(pendingRender.timer);
  pendingRender.timer = 0;
  if (debounce > 0) {
    pendingRender.timer = window.setTimeout(() => {
      pendingRender.timer = 0;
      requestRenderFrame();
    }, debounce);
    return;
  }
  requestRenderFrame();
}

function requestRenderFrame() {
  if (!pendingRender.frame) pendingRender.frame = window.requestAnimationFrame(flushRender);
}

function flushRender() {
  pendingRender.frame = 0;
  const compute = pendingRender.compute;
  const panels = [...pendingRender.panels];
  pendingRender.compute = false;
  pendingRender.panels.clear();
  if (compute || !state.series) render();
  else if (panels.length) drawPanels(panels);
  if (!pendingRender.timer && !pendingRender.frame) {
    pendingRender.waiters.splice(0).forEach((resolve) => resolve());
  }
}

// Runs any scheduled render immediately, skipping the debounce (used by tests and automation).
function renderNow() {
  window.clearTimeout(pendingRender.timer);
  pendingRender.timer = 0;
  if (pendingRender.frame) window.cancelAnimationFrame(pendingRender.frame);
  pendingRender.frame = 0;
  if (pendingRender.compute || pendingRender.panels.size) flushRender();
}

// Resolves once every scheduled render has been drawn (used by tests and automation).
function whenRendered() {
  if (!pendingRender.timer && !pendingRender.frame) return Promise.resolve();
  return new Promise((resolve) => pendingRender.waiters.push(resolve));
}

function render() {
  if (!state.entities.length) return;
  state.dirty = false;
  el.updateCharts?.classList.remove("dirty");
  // A full render covers everything already queued.
  pendingRender.compute = false;
  pendingRender.panels.clear();
  updatePlaceFlag();
  state.renderedCheckpoints = structuredClone(state.checkpoints);
  state.renderedSettings = seriesSettings();
  state.series = composeSeries(state.renderedSettings, state.renderedCheckpoints);
  updatePanelVisibility();
  renderCharts(state.series);
  scheduleDashboardFit();
}

function drawPanels(panels) {
  if (!state.series) {
    render();
    return;
  }
  attachAgeMetrics(state.series);
  renderCharts(state.series, new Set(panels));
  scheduleDashboardFit();
}

function resetZoomAllGraphs() {
  if (!state.series) return;
  attachAgeMetrics(state.series);
  renderCharts(state.series, null, { force: true });
  scheduleDashboardFit();
}

function dynamicAgeLimitForCohorts(cohorts, buffer = 5) {
  const p = percentileAge(cohorts, 99.9);
  return clamp(Math.ceil((Number.isFinite(p) ? p : 120) + buffer), 20, MAX_AGE);
}

function roundHalf(value) {
  return Math.round((Number(value) || 0) * 2) / 2;
}

// Panels that do not depend on the whole series (pyramids of a given year, the feel-age map, death curves) are
// redrawn only when their own inputs change; a checkpoint edit leaves, say, the 2022 pyramid untouched.
const panelSignatures = new Map();
function unchangedPanel(key, signature, force) {
  const chart = document.getElementById(`${key}Chart`);
  if (!force && chart?.data && panelSignatures.get(key) === signature) return true;
  panelSignatures.set(key, signature);
  return false;
}

function renderCharts(rows, only = null, { force = false } = {}) {
  const years = rows.map((r) => r.year);
  const draw = (key) => state.activePanels.has(key) && (!only || only.has(key));
  if (draw("population")) {
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

  if (draw("vitals")) {
    plotLine("vitalsChart", [
      { x: years, y: rows.map((r) => r.births), name: "Births", type: "scatter", mode: "lines", line: { color: "#365f91", width: 3 } },
      { x: years, y: rows.map((r) => r.deaths), name: "Deaths", type: "scatter", mode: "lines", line: { color: "#bf4b3f", width: 3 } }
    ], "people / year", { zeroY: el.zeroVitals.checked });
  }

  if (draw("fertility")) {
    plotLine("fertilityChart", [
      { x: years, y: rows.map((r) => r.tfr), name: "TFR", type: "scatter", mode: "lines", line: { color: "#365f91", width: 3 } },
      { x: years, y: rows.map((r) => r.adjustedTfr), name: "Survival-adjusted", type: "scatter", mode: "lines", line: { color: "#bf4b3f", width: 3 } }
    ], "births per woman", { zeroY: el.zeroFertility.checked });
  }

  if (draw("life")) {
    renderColorKey(el.lifeKey, LIFE_CHANGE_COLORS);
    if (el.lifeKey) el.lifeKey.hidden = !state.lifeKeyExpanded;
    const lifeValues = rows.map((r) => r.life);
    const lifeChanges = rows.map((r, i) => i === 0 ? 0 : (r.life ?? 0) - (rows[i - 1]?.life ?? r.life ?? 0));
    plotLine("lifeChart", segmentedLineTraces(years, lifeValues, lifeChanges, LIFE_CHANGE_COLORS, "Life expectancy", ".1f"), "years", { zeroY: el.zeroLife.checked });
  }

  if (draw("growth")) {
    plotLine("growthChart", [
      { x: years, y: rows.map((r) => r.growth), name: "Growth", type: "scatter", mode: "lines", line: { color: "#80662c", width: 3 } }
    ], "% / year");
  }

  if (draw("absoluteGrowth")) {
    plotLine("absoluteGrowthChart", [
      { x: years, y: rows.map((r) => r.absoluteGrowth), name: "Absolute growth", type: "scatter", mode: "lines", line: { color: "#2e757f", width: 3 } }
    ], "people / year", { zeroY: el.zeroAbsoluteGrowth.checked });
  }

  if (draw("migrationAbsolute")) {
    plotLine("migrationAbsoluteChart", [
      { x: years, y: rows.map((r) => r.migrationAbsolute), name: "Net migration", type: "scatter", mode: "lines", line: { color: "#59466b", width: 3 } }
    ], "people / year", { zeroY: el.zeroMigrationAbsolute.checked });
  }

  if (draw("migrationRate")) {
    plotLine("migrationRateChart", [
      { x: years, y: rows.map((r) => r.migration), name: "Migration", type: "scatter", mode: "lines", line: { color: "#bf4b3f", width: 3 } }
    ], "per mille", { zeroY: el.zeroMigrationRate.checked });
  }

  if (draw("ageShare")) {
    plotLine("ageShareChart", [
      { x: years, y: rows.map((r) => r.ageShare), name: "Selected ages", type: "scatter", mode: "lines", fill: "tozeroy", line: { color: "#277a68", width: 3 } }
    ], "% of population");
  }

  if (draw("agePercentile")) {
    const percentile = selectedPercentile();
    plotLine("agePercentileChart", [
      { x: years, y: rows.map((r) => r.percentileAge), name: `${percentileLabel(percentile)}% actual age`, type: "scatter", mode: "lines", line: { color: "#365f91", width: 3 } },
      { x: years, y: rows.map((r) => r.adjustedPercentileAge), name: `${percentileLabel(percentile)}% feel age`, type: "scatter", mode: "lines", line: { color: "#277a68", width: 3 } }
    ], "age", { zeroY: el.zeroAgePercentile?.checked ?? true });
  }

  if (draw("mortality")) renderMortalityChart(rows, force);
  if (draw("pyramid")) renderPyramid(rows, force);
  if (draw("feelPyramid")) renderFeelPyramid(rows, force);
  if (draw("healthAge")) renderHealthAge(force);
}

function rowForMortalityCurve(rows, item) {
  if (item.type !== "year") return null;
  const year = Number(item.value);
  const visible = rows.find((r) => r.year === year);
  if (visible) return visible;
  const scenario = state.scenario.find((r) => r.year === year);
  if (scenario) return scenario;
  if (year > START_SIM_YEAR) {
    const entity = renderedEntity();
    const checkpoints = state.renderedCheckpoints || state.checkpoints;
    return {
      year,
      life: valueFromCheckpoints(checkpoints, year, "life", entity),
      caution: valueFromCheckpoints(checkpoints, year, "caution", entity)
    };
  }
  return null;
}

function renderedEntity() {
  return state.renderedSettings?.entity || el.entitySelect.value || "World";
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

function renderMortalityChart(rows, force = false) {
  renderMortalityCurveList();
  const curveItems = state.mortalityCurves.slice(0, 10);
  const colors = ["#80662c", "#277a68", "#365f91", "#bf4b3f", "#59466b", "#2e757f"];
  const traceModels = curveItems.map((item, i) => {
    const row = rowForMortalityCurve(rows, item);
    const life = item.type === "year" ? (row?.life ?? getLife(renderedEntity(), item.value)) : item.value;
    const caution = item.type === "year" ? (row?.caution ?? 0) : 0;
    const qx = applyCaution(buildMortalityCurve(life, "general"), caution);
    const label = item.type === "year" ? `${item.value} LE ${life.toFixed(1)}${caution ? ` c${caution}` : ""}` : `LE ${life}`;
    return { qx, label, life, caution, color: colors[i % colors.length], width: item.type === "le" && Number(item.value) === 75 ? 4 : 2 };
  });
  if (unchangedPanel("mortality", traceModels.map((m) => `${m.label}|${m.life}|${m.caution}`).join(";"), force)) return;
  // Caution lowers the whole curve, so its top is 995 minus the caution; the range ends where each curve tops out.
  const maxAge = Math.max(20, ...traceModels.map((model) => ageAtRate(model.qx, Math.min(0.995, Math.max(...model.qx)) - 1e-9)));
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
  const entity = renderedEntity();
  if (targetYear < START_SIM_YEAR || !state.scenario.length) return cachedHistorical(entity, targetYear, targetYear)[0] || null;
  const existing = state.scenario.find((r) => r.year === targetYear && r.cohorts);
  if (existing) return existing;
  return buildScenario(entity, START_SIM_YEAR, targetYear, state.renderedCheckpoints || state.checkpoints)
    .find((r) => r.year === targetYear) || null;
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

function renderPyramid(rows, force = false) {
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
  if (unchangedPanel("pyramid", `${renderedEntity()}|${targetYear}|${row.population}|${row.life}|${ageLimit}`, force)) return;
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

function renderFeelPyramid(rows, force = false) {
  const targetYear = clamp(Number(el.feelPyramidYear.value) || START_SIM_YEAR, 1800, 2400);
  const row = rowForPyramidYear(rows, targetYear);
  if (!row) {
    Plotly.react("feelPyramidChart", [], baseLayout("people"), { responsive: true, displayModeBar: false, doubleClick: "reset" });
    return;
  }
  const signature = `${renderedEntity()}|${targetYear}|${row.population}|${row.life}|${state.dynamicFeelPyramidAge}|${el.feelPyramidMaxAge.value}`;
  if (unchangedPanel("feelPyramid", signature, force)) return;
  const feelDistributionValues = feelDistribution(row.cohorts, row.life);
  const ageLimit = state.dynamicFeelPyramidAge
    ? dynamicAgeLimitForCohorts(feelDistributionValues)
    : clamp(Number(el.feelPyramidMaxAge.value) || mortalityAgeLimit(row.life, 20, "disease"), 20, MAX_AGE);
  if (state.dynamicFeelPyramidAge && el.feelPyramidMaxAge) el.feelPyramidMaxAge.value = ageLimit;
  const ages = Array.from({ length: ageLimit - 19 }, (_, i) => i + 20);
  // Unlike the sex pyramid, each side here is the whole population, by actual age and by feel age.
  const actualHalf = ages.map((age) => row.cohorts[age] || 0);
  const feelHalf = ages.map((age) => feelDistributionValues[age] || 0);
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
  const map = feelAgeMap(life);
  for (let age = 0; age <= MAX_AGE; age += 1) {
    const mapped = map[age];
    if (age >= 20 && mapped <= 20.02) {
      distributeExponentialFeel(out, cohorts[age]);
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

// People whose mortality-equivalent age falls to the age-20 floor are spread over 20-40 with a five-year half-life.
const FEEL_FLOOR_WEIGHTS = (() => {
  const weights = Array.from({ length: 21 }, (_, i) => Math.pow(0.5, i / 5));
  const denom = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / denom);
})();

function distributeExponentialFeel(out, amount) {
  for (let i = 0; i < FEEL_FLOOR_WEIGHTS.length; i += 1) out[20 + i] += amount * FEEL_FLOOR_WEIGHTS[i];
}

function renderHealthAge(force = false) {
  const selectedLife = Number(el.healthLifeExpectancy.value) || 85;
  const limit = clamp(Number(el.healthMaxAge.value) || mortalityAgeLimit(selectedLife, 20, "disease"), 20, MAX_AGE);
  if (unchangedPanel("healthAge", `${selectedLife}|${limit}`, force)) return;
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
  const columns = layoutColumnsFor(width);
  const colWidth = Math.floor((width - pad * 2 - gap * (columns - 1)) / columns);
  state.layoutColumns = columns;
  state.layoutCustomized = false;
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
  window.requestAnimationFrame(resizeVisibleCharts);
}

function layoutColumnsFor(width) {
  return width > 1260 ? 3 : width > 760 ? 2 : 1;
}

let dashboardFitFrame = 0;
function scheduleDashboardFit() {
  if (dashboardFitFrame) return;
  dashboardFitFrame = window.requestAnimationFrame(() => {
    dashboardFitFrame = 0;
    fitDashboardHeight();
  });
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

// Pushes overlapping panels down, then pulls every panel up into any gap above it. All geometry is read once and
// worked out in memory, so the browser lays the page out once instead of after every individual move.
function settlePanelLayout(activePanel = null, { resizeCharts = false } = {}) {
  const gap = 16;
  const panels = visiblePanels();
  if (!panels.length) return;
  panels.forEach(materializePanelTransform);
  const boxes = new Map(panels.map((panel) => [panel, panelBox(panel)]));
  const place = (box, left, top) => {
    box.left = Math.max(16, left);
    box.top = Math.max(16, top);
    box.right = box.left + box.width;
    box.bottom = box.top + box.height;
  };
  const byPosition = (a, b) => boxes.get(a).top - boxes.get(b).top || boxes.get(a).left - boxes.get(b).left;
  if (activePanel && boxes.has(activePanel)) {
    const box = boxes.get(activePanel);
    place(box, box.left, box.top);
  }

  const placed = [];
  if (activePanel && boxes.has(activePanel)) placed.push(boxes.get(activePanel));
  for (const panel of panels.filter((p) => p !== activePanel).sort(byPosition)) {
    const box = boxes.get(panel);
    for (let guard = 0; guard < 100; guard += 1) {
      const blockers = placed.filter((other) => boxesOverlap(box, other, gap));
      if (!blockers.length) break;
      box.top = Math.max(...blockers.map((other) => other.bottom + gap));
      box.bottom = box.top + box.height;
    }
    place(box, box.left, box.top);
    placed.push(box);
  }

  for (const panel of panels.slice().sort(byPosition)) {
    if (panel === activePanel) continue;
    const box = boxes.get(panel);
    let top = 16;
    for (const other of panels) {
      if (other === panel) continue;
      const otherBox = boxes.get(other);
      const horizontalOverlap = box.left < otherBox.right + gap && box.right + gap > otherBox.left;
      if (horizontalOverlap && otherBox.bottom + gap <= box.top) top = Math.max(top, otherBox.bottom + gap);
    }
    if (top < box.top) place(box, box.left, top);
  }

  for (const [panel, box] of boxes) movePanelTo(panel, box.left, box.top);
  scheduleDashboardFit();
  if (resizeCharts) resizeVisibleCharts();
}

function resizeChartIn(panel) {
  const chart = panel?.querySelector(".chart");
  if (chart?.offsetParent && chart.data) Plotly.Plots.resize(chart).catch(() => {});
}

function resizeVisibleCharts() {
  document.querySelectorAll(".panel").forEach((panel) => {
    if (panel.style.display !== "none") resizeChartIn(panel);
  });
}

// Live resizing redraws the chart at most once per frame rather than on every pointer event.
const chartResizeQueue = new Set();
let chartResizeFrame = 0;
function scheduleChartResize(panel) {
  chartResizeQueue.add(panel);
  if (chartResizeFrame) return;
  chartResizeFrame = window.requestAnimationFrame(() => {
    chartResizeFrame = 0;
    chartResizeQueue.forEach(resizeChartIn);
    chartResizeQueue.clear();
  });
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
          scheduleDashboardFit();
        },
        end(event) {
          state.layoutCustomized = true;
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
          scheduleChartResize(target);
          scheduleDashboardFit();
        },
        end(event) {
          state.layoutCustomized = true;
          settlePanelLayout(event.target);
          resizeChartIn(event.target);
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
  if (persist) safeStorage("set", "populationVisualizer.sidebarWidth", String(next));
}

// Browser storage can be unavailable (private windows, blocked site data); the sidebar width is only a convenience.
function safeStorage(action, key, value) {
  try {
    if (action === "get") return window.localStorage.getItem(key);
    if (action === "set") window.localStorage.setItem(key, value);
    if (action === "remove") window.localStorage.removeItem(key);
  } catch (error) {
    return null;
  }
  return null;
}

function setupSidebarResize() {
  if (!el.sidebarResize || !el.appShell) return;
  const stored = safeStorage("get", "populationVisualizer.sidebarWidth");
  const saved = stored === null ? NaN : Number(stored);
  if (Number.isFinite(saved) && saved > 0) setSidebarWidth(saved, false);

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
  });

  const finishResize = (event) => {
    if (!el.sidebarResize.hasPointerCapture(event.pointerId)) return;
    el.sidebarResize.releasePointerCapture(event.pointerId);
    document.body.classList.remove("resizing-sidebar");
    refitLayoutToWidth();
  };
  el.sidebarResize.addEventListener("pointerup", finishResize);
  el.sidebarResize.addEventListener("pointercancel", finishResize);
}

// Controls that change the simulated series, and view controls that only redraw their own panel.
const VIEW_CONTROLS = {
  zeroPopulation: ["population"],
  zeroVitals: ["vitals"],
  zeroFertility: ["fertility"],
  zeroLife: ["life"],
  zeroAbsoluteGrowth: ["absoluteGrowth"],
  zeroMigrationAbsolute: ["migrationAbsolute"],
  zeroMigrationRate: ["migrationRate"],
  zeroAgePercentile: ["agePercentile"],
  ageShareStart: ["ageShare"],
  ageShareEnd: ["ageShare"],
  agePercentile: ["agePercentile"],
  pyramidYear: ["pyramid"],
  pyramidMaxAge: ["pyramid"],
  feelPyramidYear: ["feelPyramid"],
  feelPyramidMaxAge: ["feelPyramid"],
  healthLifeExpectancy: ["healthAge"],
  healthMaxAge: ["healthAge"]
};
const TYPING_DEBOUNCE_MS = 140;

function refitLayoutToWidth() {
  const columns = layoutColumnsFor(Math.max(320, el.dashboard.clientWidth || 960));
  if (!state.layoutCustomized || columns !== state.layoutColumns) resetLayout();
  else settlePanelLayout();
}

// Life-expectancy presets are defined as annual gains from the place's own 2022 value, so when the place
// changes the active preset is recomputed for it, unless life expectancies have been edited by hand.
function onPlaceChange() {
  const entity = el.entitySelect.value || "World";
  if (entity === state.presetEntity) return;
  state.presetEntity = entity;
  if (state.lifeScenario && !state.lifeEdited) {
    applyCheckpointScenario({ updateFertility: false, updateLife: true });
  }
}

function setupEvents() {
  el.entitySelect.addEventListener("input", onPlaceChange);
  el.entitySelect.addEventListener("change", onPlaceChange);
  [el.entitySelect, el.yearStart, el.yearEnd].filter(Boolean).forEach((control) => {
    const typed = control.tagName === "INPUT";
    control.addEventListener("input", () => scheduleRender({ debounce: typed ? TYPING_DEBOUNCE_MS : 0 }));
    control.addEventListener("change", () => scheduleRender());
  });

  Object.entries(VIEW_CONTROLS).forEach(([id, panels]) => {
    const control = el[id];
    if (!control) return;
    const typed = control.type === "number";
    control.addEventListener("input", () => scheduleRender({ panels, debounce: typed ? TYPING_DEBOUNCE_MS : 0 }));
    control.addEventListener("change", () => scheduleRender({ panels }));
  });

  el.addMortalityCurve?.addEventListener("click", () => {
    if (state.mortalityCurves.length >= 10) return;
    const type = el.mortalityCurveType.value;
    const raw = Number(el.mortalityCurveValue.value);
    if (!Number.isFinite(raw)) return;
    const value = type === "year" ? Math.round(clamp(raw, 1800, 2400)) : clamp(raw, 1, 500);
    const exists = state.mortalityCurves.some((item) => item.type === type && Number(item.value) === Number(value));
    if (!exists) state.mortalityCurves.push({ type, value });
    scheduleRender({ panels: ["mortality"] });
  });

  el.mortalityCurveList?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-curve-remove]");
    if (!button) return;
    state.mortalityCurves.splice(Number(button.dataset.curveRemove), 1);
    scheduleRender({ panels: ["mortality"] });
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
    state.lifeEdited = true;
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
    if (key === "life") state.lifeEdited = true;
    if (key === "year") {
      window.clearTimeout(state.checkpointSortTimer);
      const yearValue = Number(input.value);
      const completeYear = input.value.length >= 4 && Number.isFinite(yearValue) && yearValue >= START_SIM_YEAR;
      if (!completeYear) return;
      state.checkpointSortTimer = window.setTimeout(() => {
        commitCheckpointEdit(input);
      }, 700);
      return;
    }
    scheduleRender({ debounce: TYPING_DEBOUNCE_MS });
  });

  // Re-sorting rebuilds the checkpoint rows, so it only happens when the order actually changes.
  const commitCheckpointEdit = (input) => {
    window.clearTimeout(state.checkpointSortTimer);
    const index = Number(input.dataset.index);
    const key = input.dataset.key;
    if (!state.checkpoints[index]) return;
    state.checkpoints[index][key] = Number(input.value);
    const before = state.checkpoints.slice();
    sortCheckpointsByYear();
    if (state.checkpoints.some((point, i) => point !== before[i])) setupCheckpoints();
    scheduleRender();
  };

  el.checkpointList.addEventListener("change", (event) => {
    const input = event.target.closest("input[data-key]");
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
    state.lifeEdited = true;
    sortCheckpointsByYear();
    setupCheckpoints();
    scheduleRender();
  });

  el.panelToggles.addEventListener("input", (event) => {
    const input = event.target.closest("input[data-panel-toggle]");
    if (!input) return;
    const key = input.dataset.panelToggle;
    if (input.checked) state.activePanels.add(key);
    else state.activePanels.delete(key);
    updatePanelVisibility();
    resetLayout();
    if (input.checked) scheduleRender({ panels: [key] });
  });

  document.querySelectorAll(".collapse").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const panel = button.closest(".panel");
      panel.classList.toggle("collapsed");
      state.layoutCustomized = true;
      window.requestAnimationFrame(() => {
        settlePanelLayout(panel);
        resizeChartIn(panel);
      });
    });
  });

  // History shows only the observed record (through 2022); Simulation shows it together with the projection.
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
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
    resetZoomAllGraphs();
  });
  el.resetZoomAll?.addEventListener("click", resetZoomAllGraphs);
  el.togglePopulationKey?.addEventListener("click", () => {
    state.populationKeyExpanded = !state.populationKeyExpanded;
    el.togglePopulationKey.textContent = state.populationKeyExpanded ? "Hide key" : "Expand key";
    el.togglePopulationKey.setAttribute("aria-expanded", String(state.populationKeyExpanded));
    if (el.populationKey) el.populationKey.hidden = !state.populationKeyExpanded;
    window.requestAnimationFrame(() => resizeChartIn(el.populationKey?.closest(".panel")));
  });
  el.toggleLifeKey?.addEventListener("click", () => {
    state.lifeKeyExpanded = !state.lifeKeyExpanded;
    el.toggleLifeKey.textContent = state.lifeKeyExpanded ? "Hide key" : "Expand key";
    el.toggleLifeKey.setAttribute("aria-expanded", String(state.lifeKeyExpanded));
    if (el.lifeKey) el.lifeKey.hidden = !state.lifeKeyExpanded;
    window.requestAnimationFrame(() => resizeChartIn(el.lifeKey?.closest(".panel")));
  });
  el.dynamicPyramidAge?.addEventListener("click", () => {
    state.dynamicPyramidAge = !state.dynamicPyramidAge;
    el.dynamicPyramidAge.classList.toggle("active", state.dynamicPyramidAge);
    el.dynamicPyramidAge.setAttribute("aria-pressed", String(state.dynamicPyramidAge));
    scheduleRender({ panels: ["pyramid"] });
  });
  el.dynamicFeelPyramidAge?.addEventListener("click", () => {
    state.dynamicFeelPyramidAge = !state.dynamicFeelPyramidAge;
    el.dynamicFeelPyramidAge.classList.toggle("active", state.dynamicFeelPyramidAge);
    el.dynamicFeelPyramidAge.setAttribute("aria-pressed", String(state.dynamicFeelPyramidAge));
    scheduleRender({ panels: ["feelPyramid"] });
  });
  el.exportScenario.addEventListener("click", exportScenario);
  // Plotly's responsive mode already resizes each chart with the window; this only refits the panel grid.
  window.addEventListener("resize", () => {
    window.clearTimeout(state.resizeTimer);
    state.resizeTimer = window.setTimeout(() => {
      if (el.appShell?.hidden) {
        state.simulatorLayoutPending = true;
        renderCeilingChart();
        return;
      }
      if (state.sidebarWidth) setSidebarWidth(state.sidebarWidth, false);
      refitLayoutToWidth();
    }, 150);
  });
}

function setMode(mode) {
  state.mode = mode === "history" ? "history" : "simulation";
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === state.mode));
  el.yearStart.value = 1950;
  el.yearEnd.value = state.mode === "history" ? START_SIM_YEAR : 2100;
  scheduleRender({ force: true });
}

function resetAll() {
  state.checkpoints = structuredClone(DEFAULT_CHECKPOINTS);
  state.mode = "simulation";
  state.dynamic = true;
  state.dirty = false;
  state.fertilityScenario = DEFAULT_FERTILITY_SCENARIO;
  state.lifeScenario = DEFAULT_LIFE_SCENARIO;
  state.populationKeyExpanded = false;
  state.lifeKeyExpanded = false;
  state.dynamicPyramidAge = false;
  state.dynamicFeelPyramidAge = false;
  if (state.entities.length) el.dataStatus.textContent = `${state.entities.length} places loaded.`;
  state.activePanels = new Set(DEFAULT_ACTIVE_PANELS);
  state.mortalityCurves = [{ type: "le", value: 75 }, { type: "year", value: START_SIM_YEAR }];
  el.entitySelect.value = state.entities.includes("World") ? "World" : state.entities[0];
  el.yearStart.value = 1950;
  el.yearEnd.value = 2100;
  el.dynamicMode.classList.add("active");
  el.dynamicMode.setAttribute("aria-pressed", "true");
  if (el.togglePopulationKey) {
    el.togglePopulationKey.textContent = "Expand key";
    el.togglePopulationKey.setAttribute("aria-expanded", "false");
  }
  if (el.populationKey) el.populationKey.hidden = true;
  if (el.toggleLifeKey) {
    el.toggleLifeKey.textContent = "Expand key";
    el.toggleLifeKey.setAttribute("aria-expanded", "false");
  }
  if (el.lifeKey) el.lifeKey.hidden = true;
  [el.dynamicPyramidAge, el.dynamicFeelPyramidAge].forEach((button) => {
    if (!button) return;
    button.classList.remove("active");
    button.setAttribute("aria-pressed", "false");
  });
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === "simulation"));
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
  safeStorage("remove", "populationVisualizer.sidebarWidth");
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
  setupPrimaryViews();
  setupCheckpoints();
  renderScenarioButtons();
  renderPanelToggles();
  setupEvents();
  setupDragging();
  setupSidebarResize();
  lucide.createIcons();

  try {
    const entries = Object.entries(DATA_URLS);
    let done = 0;
    const loaded = await Promise.all(entries.map(([name, url]) => loadDataset(name, url).then((rows) => {
      done += 1;
      el.dataStatus.textContent = `Loading demographic sources (${done}/${entries.length})...`;
      return [name, rows];
    })));
    for (const [name, rows] of loaded) {
      state.rows[name] = rows;
      state.byEntity[name] = indexRows(rows);
    }
    clearDataCaches();
    populateEntities();
    applyCheckpointScenario({ fertilityKey: DEFAULT_FERTILITY_SCENARIO, lifeKey: DEFAULT_LIFE_SCENARIO, updateFertility: true, updateLife: true });
    if (el.appShell?.hidden) state.simulatorLayoutPending = true;
    else resetLayout();
    render();
    el.dataStatus.textContent = `${state.entities.length} places loaded.`;
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
  whenRendered,
  renderNow,
  state
};
