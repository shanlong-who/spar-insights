# Build and validate SPAR Insights

The published `index.html` is standalone. These instructions are for rebuilding
or inspecting its implementation; they are not required to view the dashboard.

## Source files

- `build.R`: prepares SPAR data, embeds the compressed payload and browser
  dependencies, knits the dashboard and renders it with Quarto.
- `dashboard.qmd`: page structure, explanatory text and linked score widgets.
- `R/prepare_data.R`: explicit source-object allowlist and SPAR transformations.
- `assets/dashboard-core.js`: pure client-side data operations.
- `assets/dashboard.js`: browser controls and chart rendering.
- `assets/dashboard.css`: layout and styling.
- `validation/`: independent R reference calculations, browser calculation
  checks, publication audits and validation results.

## Dependencies

Use R and Quarto. The R scripts declare their package imports explicitly:
`knitr`, `jsonlite`, `htmltools`, `data.table`, `tidyverse`, `crosstalk`,
`plotly`, `reactable`, `echarts4r`, `RColorBrewer` and `stringr`.
The source disclosure audit also uses `openssl`.

The current build uses the ECharts resources installed with `echarts4r`, under
`htmlwidgets/lib/echarts-6.0.0`. If the package changes that directory in a
future release, review the resource path in `build.R` before rebuilding.
Package versions used for the published artifact are recorded in
`validation/build_manifest.json`.

The builder finds Quarto on PATH, with the standard Windows RStudio bundle
as a fallback. No packages or software are installed by these scripts.

## Local SPAR input

Input data are not included as a separate RData file. Provide a compatible
local SPAR snapshot and set `SPAR_SOURCE_FILE` to its path. It must contain:

| Object | Required structure |
| --- | --- |
| `cap_2021` through `cap_2025` | `year`, `region`, `country`, `iso`, and capacity columns `C1` through `C15` |
| `ind_2021` through `ind_2025` | The same identifying fields and the SPAR indicator columns |
| `spar_cap` | Capacity code and description: `capacity`, `detail` |
| `spar_ind` | Indicator code and description: `indicator`, `detail` |
| `spar_comment_lower` | `year`, `region`, `country`, `cap_id`, `comment` |
| `spar_comment_word` | `year`, `region`, `country`, `cap_id`, `words` |
| `stop_words_all` | Stop words in `word` |
| `raw_data` | SPAR submission metadata, `approach`, `consultative`, `sector`, and indicator implementation/area fields |

The adapter retains only those named SPAR objects after loading the input.
The output payload contains a second explicit allowlist of SPAR tables.
Other assessment data and cross-tool mappings are not exported.

The existing snapshot and transformations are preserved: 2024/2025 score
tables use complete-case exclusions, zero remains zero, and submission counts
use source rows before those exclusions. Do not replace missing data with zero.

## Rebuild in RStudio

Open the repository as the working directory, then run:

```r
Sys.setenv(SPAR_SOURCE_FILE = "/path/to/local/spar_snapshot.RData")
source("build.R")
```

The default local fallback is `../data/app_data.RData`. That file is not part
of this repository. Use the environment variable for another location.

The script writes intermediate files to the ignored `build/` directory and
replaces `index.html` only when rendering runs. For data/widget preparation
without compilation, set `SPAR_SKIP_RENDER=true`; this does not establish a
successful HTML build. Unset that variable for a normal complete rebuild.

The current interface and adapter cover 2021-2025. Adding a new reporting year
requires updating the year ranges, defaults and validation references; it is
not achieved merely by supplying another table in the input file. Changes of
SPAR edition require reviewing the indicator schema and interpretation first.

## Validate

From the repository directory, prepare independent R references:

```r
source("validation/prepare_checks.R")
```

That script reads the local SPAR snapshot, compares exported score cells and
comments, and generates the ignored `validation/reference_values.json`.

Then run the browser calculation checks with an installed Node.js runtime:

```text
node validation/check_browser_math.cjs
node validation/check_public_release.cjs
```

The first executes pure browser calculations against the independent R
references. The second decompresses the actual HTML and verifies its dataset
allowlist, interface, runtime dependencies and publication scope. When the
original local baseline is available, it also checks unchanged SPAR tables.
Neither script automates a browser. Visual and interaction checks are recorded
separately in `validation/QA.md`.

Audit the source publication list in R:

```r
source("validation/check_source_release.R")
```

This scans only the explicitly listed publication files, checks for common
credential/key patterns and personal paths, rejects data archives and private
configuration files, and records file hashes. It complements manual review;
pattern matching alone cannot prove the absence of all sensitive information.

Do not upload local input files, the original mixed application, environment
files, build caches or the locally generated source-path integrity report.
