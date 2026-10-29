library(jsonlite)
library(openssl)

# Run from the repository root. Never scan or print credential file contents.
release_files <- c(
  "README.md", "BUILDING.md", ".gitignore", "build.R", "dashboard.qmd",
  "R/prepare_data.R", "assets/dashboard.js", "assets/dashboard-core.js",
  "assets/dashboard.css", "validation/prepare_checks.R",
  "validation/check_browser_math.cjs", "validation/check_public_release.cjs",
  "validation/check_source_release.R", "validation/QA.md",
  "validation/build_manifest.json", "validation/r_checks.json",
  "validation/browser_math_checks.json", "validation/public_release_checks.json"
)
stopifnot(all(file.exists(release_files)))
stopifnot(!any(grepl("\\.(RData|rdata|rds|zip|pem|key|p12|pfx)$", release_files)))
stopifnot(!any(grepl("(^|/)(build|data|data-raw|\\.git|\\.Renviron|\\.env)(/|$)", release_files)))

# Pattern labels are reported, never a matching value or line.
patterns <- list(
  private_key = "-----BEGIN [A-Z ]*PRIVATE KEY-----",
  github_classic_token = "gh[pousr]_[A-Za-z0-9]{30,}",
  github_fine_grained_token = "github_pat_[A-Za-z0-9_]{40,}",
  provider_key = "sk-[A-Za-z0-9_-]{20,}",
  aws_access_key = "AKIA[A-Z0-9]{16}",
  assigned_credential = "(?i)(api[_-]?key|access[_-]?token|password|secret)\\s*(<-|=|:)\\s*['\"][A-Za-z0-9_./+=-]{12,}['\"]"
)
findings <- list()
hashes <- setNames(vector("list", length(release_files)), release_files)
for (path in release_files) {
  bytes <- readBin(path, "raw", n = file.info(path)$size)
  text <- rawToChar(bytes)
  stopifnot(validUTF8(text))
  hashes[[path]] <- paste(sha256(bytes))
  # Regex definitions in this audit deliberately describe secret formats.
  # They do not include any credential. Scan other source files for matches.
  if (path != "validation/check_source_release.R") {
    for (label in names(patterns)) {
      if (grepl(patterns[[label]], text, perl = TRUE)) {
        findings[[length(findings) + 1L]] <- list(file = path, category = label)
      }
    }
  }
  if (grepl("[A-Za-z]:[/\\\\]Users[/\\\\][A-Za-z0-9_.-]+", text, perl = TRUE)) {
    findings[[length(findings) + 1L]] <- list(file = path, category = "personal_path")
  }
}

# Application and source adapter must not refer to excluded assessment inputs.
excluded_references <- "(?i)jee3|jee_rec|jee_detail|jee_ta|jee_ind|spar_jee|d\\.overlap|d\\.recommendations"
for (path in c("R/prepare_data.R", "assets/dashboard.js", "dashboard.qmd")) {
  text <- paste(readLines(path, encoding = "UTF-8", warn = FALSE), collapse = "\n")
  if (grepl(excluded_references, text, perl = TRUE)) {
    findings[[length(findings) + 1L]] <- list(file = path, category = "excluded_assessment_reference")
  }
}
report <- list(status = if (length(findings)) "failed" else "passed",
  files_checked = release_files, findings = findings, sha256 = hashes,
  scope = "Explicit source and validation file allowlist; no input datasets or caches")
write_json(report, "validation/source_release_checks.json", pretty = TRUE, auto_unbox = TRUE)
stopifnot(length(findings) == 0L)
cat("SOURCE_RELEASE_AUDIT_PASS", length(release_files), "files\n")
