# Population Scenario Visualizer

Open `index.html` through a local web server. The current Codex server URL is:

http://127.0.0.1:8766/index.html

## What it does

- Loads public demographic CSVs live from Our World in Data grapher endpoints.
- Covers world, regions, and countries where the source series exist.
- Uses historical estimates through 2022. Years 2023 onward are treated as simulation/projection years because recent source columns are inconsistent across places.
- Computes births, deaths, TFR, modeled under-15-survival-adjusted TFR, population, percentage growth, absolute growth, absolute migration, migration per mille, life expectancy, selected age share, median/percentile age, health-adjusted percentile age, a normal population pyramid, and a feel-age comparison pyramid.
- Simulates from 2022 onward with editable and reorderable checkpoints for TFR, life expectancy, net migration per mille, and a caution factor that subtracts deaths per 1,000 from the mortality curve.
- Uses the actual 2022 value as the baseline for forward interpolation, then interpolates toward later checkpoints.
- Default history range is 1950-2022. Default simulation range is 2022-2100.
- Age/mortality arrays are finite-capped at 500. Pyramid displays use the age where mortality reaches 990 per 1,000 when it occurs earlier.
- Mortality curves start with LE 75 and the selected comparison year. Additional year or life-expectancy curves can be added inside the mortality panel, up to 10 total.
- The 2022 simulation handoff is anchored to observed births, deaths, TFR, and life expectancy before simulated years continue forward.
- Direct annual birth counts are preferred whenever present; crude-rate/model estimates are used only as fallbacks.
- Age-share, pyramid, feel-age comparison, and health-age controls live inside their own panels.
- Historical age-share and percentile-age rows use annual cohort distributions when age-group data is available, so the 2022 simulation handoff does not switch from a modeled age share to a different cohort method.
- The feel-age comparison pyramid scales each half independently while keeping hover values in real people counts.
- Population pyramid panels accept historical years before 2022 and use horizontal age hover behavior.
- Default panels show population, births/deaths, TFR, life expectancy, growth rate, mortality, and median/percentile age; migration, absolute growth, pyramids, age share, and health/feel age start hidden.
- Supports staged editing with `Dynamic` off and manual recomputation with `Update`.
- Reset restores the default place, ranges, checkpoints, panels, panel controls, and curve selections. Export downloads the current scenario as JSON.
- Export also copies the scenario JSON to the clipboard when the browser blocks direct downloads.
- Major line charts include an optional `Y starts at 0` checkbox inside the panel.
- Separates generalized mortality curves from disease-only curves for feel-age calculations.

## Important assumptions

- Pre-1950 births are estimated from long-run birth rates and population where direct annual birth counts are unavailable.
- Pre-1950 deaths are derived from births minus annual population change when direct annual death counts are unavailable, with a modeled mortality fallback from life expectancy.
- Pre-1950 TFR is inferred from births, population, growth, and the modeled survival schedule, then smoothly calibrated to the first observed TFR for that place.
- Under-15 survival-adjusted TFR is derived from the generalized mortality curve implied by that place's life expectancy in that year.
- Historical net migration is a residual: population change minus births plus deaths. Forward migration uses the checkpoint per-mille assumption.
- World historical migration is forced to zero. Forward world migration remains adjustable for hypothetical scenarios.
- Five-year age groups are smoothed into single-year ages with interpolation before pyramid rendering.
- Mortality curves beyond observed modern life expectancies are extrapolations. They are useful for scenario exploration, not forecasts.
- The low-estimate switch chooses the lowest available machine-readable source among loaded birth and fertility series. It does not scrape Wikipedia tables automatically.
