# SPAR Insights

An independent, browser-based explorer of publicly available SPAR
(States Parties Self-Assessment Annual Reporting) data for 2021-2025.
Built and maintained by Shanlong Ding.

Open the published GitHub Pages site, or download `index.html` and open it in
a current desktop browser. All data and browser libraries are embedded.

## Included

- Year, WHO region and State Party filters.
- Overall and capacity score maps with adjustable thresholds.
- Regional distributions, capacity heatmaps and score levels.
- Country capacity and indicator scores and ranking tables.
- Annual score comparisons.
- SPAR comment keyword search and word frequencies.
- Searchable score tables and CSV downloads.
- Submission and reporting-process charts.

Only SPAR-derived datasets are included. No external assessment datasets,
cross-tool score mappings, model credentials or report-generation services are
distributed. The original mixed application and its history are not included.
SPAR comments are retained verbatim; references to other assessment tools in a
public SPAR comment remain part of that SPAR source text.

## Data and interpretation

SPAR is a self-assessment. Results do not constitute an independent assessment
or establish readiness for a specific emergency. Country coverage may change
between years. This snapshot is preserved and can differ from later official
data releases. Consult the original documentation before interpreting trends.

The existing complete-case exclusions for 2024 and 2025 are retained in score
tables. Submission counts use source rows before those exclusions. Verified
annual denominators are not supplied, so non-submission percentages are not
calculated. Missing observations and zero scores remain distinct.

- [WHO SPAR information and data](https://www.who.int/data/gho/data/themes/international-health-regulations-%282005%29-monitoring-framework)
- [e-SPAR platform](https://extranet.who.int/e-spar)

This is an independent data exploration tool and is not an official WHO
publication. The original data remain subject to their applicable source terms;
this repository does not grant a separate licence to those data.

## Rebuild with R

The raw local input file is not distributed. Provide a compatible SPAR snapshot
using `SPAR_SOURCE_FILE`, then run from this repository in RStudio:

```r
Sys.setenv(SPAR_SOURCE_FILE = "/path/to/spar_snapshot.RData")
source("build.R")
```

The source adapter requires the SPAR score tables `cap_2021` through `cap_2025`
and `ind_2021` through `ind_2025`, SPAR code lookups, tokenised SPAR comments,
lower-case SPAR comments, the stop-word list and SPAR submission metadata.
`R/prepare_data.R` explicitly selects those source objects before exporting.
Quarto is required for building, but no R or Quarto installation is needed for
viewing. Intermediate build files are excluded from the repository.

## Validation

`validation/check_public_release.cjs` decompresses the actual published HTML
and rejects unexpected datasets, excluded interface/code references, personal
filesystem paths and external runtime dependencies. Calculation checks compare
the client calculations against independent R references in 74 scenarios.

`validation/public_release_checks.json` identifies the checked HTML by SHA-256.
`.nojekyll` permits direct static publication from the repository root.
