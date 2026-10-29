library(knitr)
library(jsonlite)
library(htmltools)

# Run from RStudio with source("spar-public/build.R") or with Rscript.
args <- commandArgs(trailingOnly = FALSE)
script <- sub("^--file=", "", args[grepl("^--file=", args)])
project_dir <- if (length(script)) dirname(normalizePath(script)) else if (file.exists("dashboard.qmd")) getwd() else normalizePath("spar-public")
old_dir <- setwd(project_dir)
dir.create("build", showWarnings = FALSE)
dir.create("validation", showWarnings = FALSE)

# Hash hydrated source inputs only; cloud-only unrelated modules are not needed.
# Reading every OneDrive placeholder can block while waiting for a remote recall.
source_file <- Sys.getenv("SPAR_SOURCE_FILE", unset = "../data/app_data.RData")
originals <- source_file
before <- tools::md5sum(originals)
message("Preparing dashboard data")
source("R/prepare_data.R")
data.table::setDTthreads(2)
bundle <- prepare_data(source_file)
payload <- toJSON(bundle$payload, auto_unbox = TRUE, null = "null", na = "null", digits = NA)
writeLines(payload, "build/data.json", useBytes = TRUE)
message("Prepared browser data")

echarts_dir <- system.file("htmlwidgets/lib/echarts-6.0.0", package = "echarts4r")
stopifnot(nzchar(echarts_dir))
script_tag <- function(file) paste0("<script>\n", paste(readLines(file, warn = FALSE, encoding = "UTF-8"), collapse = "\n"), "\n</script>")
header <- c("<style>", readLines("assets/dashboard.css", warn = FALSE), "</style>",
  script_tag(file.path(echarts_dir, "echarts.min.js")),
  script_tag(file.path(echarts_dir, "world.js")), script_tag("assets/dashboard-core.js"))
writeLines(header, "build/header.html", useBytes = TRUE)
# Gzip keeps the standalone HTML small without removing any source text.
gzip_file <- gzfile("build/data.json.gz", "wb")
writeBin(charToRaw(enc2utf8(payload)), gzip_file)
close(gzip_file)
compressed <- readBin("build/data.json.gz", "raw", n = file.info("build/data.json.gz")$size)
writeLines(c(paste0('<script type="application/octet-stream" data-encoding="gzip" id="spar-data">',
                     jsonlite::base64_enc(compressed), '</script>'),
             script_tag("assets/dashboard.js")), "build/client.html", useBytes = TRUE)

# Knit in R, then let Quarto compile the markdown without starting a second R.
knitr::opts_knit$set(rmarkdown.pandoc.to = "html")
knitr::opts_chunk$set(echo = FALSE, warning = FALSE, message = FALSE, error = FALSE, screenshot.force = FALSE)
invisible(knitr::knit_meta(clean = TRUE))
knitr::knit("dashboard.qmd", output = "dashboard.knit.md", quiet = TRUE)
widget_deps <- htmltools::resolveDependencies(knitr::knit_meta(class = "html_dependency"))
widget_deps <- lapply(widget_deps, function(dep) {
  copied <- htmltools::copyDependencyToDir(dep, "build/widget-libs", mustWork = TRUE)
  htmltools::makeDependencyRelative(copied, getwd())
})
writeLines(c(header, htmltools::renderDependencies(widget_deps, srcType = "file")), "build/header.html", useBytes = TRUE)
quarto_bin <- Sys.which("quarto")
if (!nzchar(quarto_bin)) quarto_bin <- "C:/Program Files/RStudio/resources/app/bin/quarto/bin/quarto.exe"
stopifnot(file.exists(quarto_bin))
if (!identical(Sys.getenv("SPAR_SKIP_RENDER"), "true")) {
  status <- system2(quarto_bin, c("render", "dashboard.knit.md", "--output", "index.html", "--no-clean"))
  if (status != 0L) stop("Quarto did not complete. Prepared inputs are preserved in build/.")
  stopifnot(file.exists("index.html"))
}
after <- tools::md5sum(originals)
stopifnot(identical(before, after))
write.csv(data.frame(file = names(before), md5_before = unname(before), md5_after = unname(after), unchanged = before == after),
          "validation/source_integrity.csv", row.names = FALSE)
package_names <- c("quarto", "knitr", "jsonlite", "crosstalk", "plotly", "reactable", "echarts4r")
package_versions <- setNames(lapply(package_names, function(p) as.character(packageVersion(p))), package_names)
write_json(list(source_md5 = unname(before[1]),
  years = bundle$payload$meta$years,
  capacity_rows = nrow(bundle$cap), indicator_rows = nrow(bundle$ind),
  html_bytes = file.info("index.html")$size,
  packages = package_versions),
  "validation/build_manifest.json", auto_unbox = TRUE, pretty = TRUE)
message(if (identical(Sys.getenv("SPAR_SKIP_RENDER"), "true")) "Prepared inputs for " else "Built ", normalizePath("index.html"))
setwd(old_dir)

