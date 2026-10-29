# SPAR Insights

An independent explorer of publicly available SPAR self-assessment data for 2021-2025, built and maintained by Shanlong Ding.

[Open the dashboard](https://shanlong-who.github.io/spar-insights/)

You can also download `index.html` and open it in a current desktop browser. All data and browser libraries are embedded; no R installation, sign-in or internet connection is needed for offline use.

## Features

- Filter by year, WHO region and State Party.
- Explore maps, regional distributions and country capacity/indicator scores.
- Compare annual results and inspect high/low score tables.
- Search SPAR comments and explore word frequencies.
- Search score tables and download selected observations as CSV.
- Inspect submissions and reporting-process charts.

## Data and interpretation

Only SPAR-derived datasets are included. SPAR comments are retained verbatim; references to other tools within a public SPAR comment remain part of that SPAR source text. No other assessment datasets or cross-tool score mappings are distributed.

SPAR is a self-assessment. Country coverage may change between years, and this snapshot can differ from later official releases. Missing observations and zero scores remain distinct. The existing complete-case exclusions for 2024 and 2025 are retained in score tables; submission counts use source rows before those exclusions. Non-submission percentages are not calculated without verified annual denominators.

- [WHO SPAR information and data](https://www.who.int/data/gho/data/themes/international-health-regulations-%282005%29-monitoring-framework)
- [e-SPAR platform](https://extranet.who.int/e-spar)

This is an independent data exploration tool and is not an official WHO publication. Consult the original documentation before interpreting results. The data remain subject to their applicable source terms.

## Validation

All 15,693 calculation and packaging checks passed across 74 filter scenarios. The compressed HTML was inspected to confirm that only SPAR datasets are included. The deployed HTML matches the audited local release exactly.

Build and validation scripts are maintained locally and are not distributed in this publication repository.
