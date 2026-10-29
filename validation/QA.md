# Public release validation

Date: 29 October 2026.

- The source adapter keeps an explicit allowlist of SPAR objects.
- The compressed HTML payload contains exactly 13 SPAR tables plus metadata.
- All 13 tables match the previously validated SPAR tables byte-for-byte after
  JSON normalisation. Scores, metadata, comment text and word frequencies were
  preserved.
- The R source checks covered 47,715 score cells and 26,631 comment records.
  The same unchanged-source R references were reused for the public build.
- All 15,693 calculation and embedded-payload checks passed across 74 scenarios.
- The release audit rejects excluded datasets, unexpected data columns,
  excluded interface/code, personal filesystem paths and remote runtime
  script/style dependencies. It records the checked HTML SHA-256.
- The public interface was inspected in Chrome through a local HTTP preview:
  overview map, regional/country selection, Philippines score tables and SPAR
  comment frequencies. No console errors were reported.
- The source snapshot is retained unchanged. Annual reporting counts describe
  that snapshot and are not asserted to equal a later official publication.

The original mixed application, source RData, caches and previous Git history
are not part of this repository. The downloadable HTML includes the SPAR data
needed for offline interaction. Original public SPAR comments can mention other
assessment tools; those source words have not been rewritten.

Direct file opening, other browsers, mobile layouts and a formal accessibility
audit were not automated for this release. The build retains the previously
inspected chart behaviour. The live deployment is verified separately against
the exact audited HTML hash.
