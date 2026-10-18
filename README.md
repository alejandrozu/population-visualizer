# Population Scenario Visualizer

Live at https://alejandrozu.github.io/population-visualizer/ (the guide is at `#explanation`).

To run it locally, serve the folder with any static web server, for example `python -m http.server 8766`, and open http://127.0.0.1:8766/index.html.

The project explores two claims about population under longevity escape velocity (LEV):

1. With fertility below replacement, population approaches a ceiling a small multiple of today's, even if nobody ever dies. Fertility sets the height of the ceiling; longevity decides whether there is a ceiling or a decline.
2. Under LEV, a population with a very high median age is not old in health terms. The feel-age measures make this visible.

## What it does

- Provides two top-level views: the interactive Simulator and an Explanation that sets out the argument, the rationale for every lever and preset, the methodology, the original concepts (feel age, survival-adjusted TFR, caution), sources and limitations. The explanation can be linked directly with `#explanation`.
- Loads public demographic CSVs live from Our World in Data grapher endpoints.
- Covers world, regions, and countries where the source series exist.
- Uses historical estimates through 2022. Years 2023 onward are treated as simulation/projection years because recent source columns are inconsistent across places.
- Computes births, deaths, TFR, modeled under-15-survival-adjusted TFR, population, percentage growth, absolute growth, absolute migration, migration per mille, life expectancy, selected age share, median/percentile age, health-adjusted percentile age, a normal population pyramid, and a feel-age comparison pyramid.
- Simulates from 2022 onward with editable and reorderable checkpoints for TFR, life expectancy, net migration per mille, and a caution factor that subtracts deaths per 1,000 from the mortality curve.
- Uses the actual 2022 value as the baseline for forward interpolation, then interpolates toward later checkpoints.
- Default displayed range is 1950-2100, with 2022 as the historical anchor and 2023 onward simulated.
- Age/mortality arrays are finite-capped at 500. Pyramid displays use the age where mortality reaches 990 per 1,000 when it occurs earlier.
- Mortality curves start with LE 75 and the selected comparison year. Additional year or life-expectancy curves can be added inside the mortality panel, up to 10 total.
- The 2022 simulation handoff is anchored to observed births, deaths, TFR, and life expectancy before simulated years continue forward.
- Direct annual birth counts are preferred whenever present; crude-rate/model estimates are used only as fallbacks.
- Age-share, pyramid, feel-age comparison, and health-age controls live inside their own panels.
- Historical age-share and percentile-age rows use annual cohort distributions when age-group data is available, so the 2022 simulation handoff does not switch from a modeled age share to a different cohort method.
- The feel-age comparison pyramid scales each half independently while keeping hover values in real people counts.
- Population pyramid panels accept historical years before 2022 and use horizontal age hover behavior.
- Default panels show population, births/deaths, TFR, life expectancy, growth rate, mortality, and median/percentile age; migration, absolute growth, pyramids, age share, and health/feel age start hidden.
- Supports staged editing with `Dynamic` off and manual recomputation with `Update`. Chart-only settings (Y starts at 0, pyramid year and height, age-share range, percentile, mortality curves) redraw only their own panel and apply immediately.
- The Simulation tab shows 1950-2100; the History tab shows only the observed record, 1950-2022. Switching tabs keeps the panel layout.
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
- Where two loaded birth or fertility series disagree, the lower is used, because UN estimates have tended to run above registered counts. It does not scrape Wikipedia tables automatically.
- LEV presets keep their stated annual gain until the model ceiling of life expectancy 500 and add a checkpoint in the year it is reached.

## Performance notes

- Historical getters are memoized per place and year, and interpolation uses sorted per-series indexes instead of re-sorting rows on every lookup.
- Mortality curves are fitted with a precomputed Gompertz age factor, and feel-age maps are computed once per life expectancy.
- The forward simulation is cached per place and checkpoint set and extended on demand (for example, for a pyramid year beyond the chart window).
- Three datasets that were downloaded but never used (under-15 mortality, death rates by age, growth rate; about 2.9 MB) are no longer loaded.
- Renders are coalesced into one animation frame, typing is debounced, and color-banded lines use one Plotly trace per color instead of one per year.
