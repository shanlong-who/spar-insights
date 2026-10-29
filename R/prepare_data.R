library(data.table)
library(tidyverse)
library(jsonlite)
library(htmltools)
library(crosstalk)
library(plotly)
library(reactable)

# Preserve source values. Match the complete-case rule in app.R for 2024/25.
prepare_data <- function(source_file) {
  message("Loading source snapshot")
  source_env <- new.env(parent = globalenv())
  load(source_file, envir = source_env)
  allowed_source_objects <- c(paste0("cap_", 2021:2025), paste0("ind_", 2021:2025),
    "spar_cap", "spar_ind", "spar_comment_word", "spar_comment_lower", "stop_words_all", "raw_data")
  source_env <- list2env(mget(allowed_source_objects, envir = source_env), parent = globalenv())
  message("Preparing score and text tables")
  years <- 2021:2025
  bind_scores <- function(prefix) {
    rbindlist(lapply(years, function(year) {
      x <- copy(get(paste0(prefix, year), envir = source_env))
      if (year >= 2024) x <- na.omit(x)
      x[, key := paste(year, iso, sep = "|")]
      x
    }), use.names = TRUE)
  }
  cap <- bind_scores("cap_")
  ind <- bind_scores("ind_")
  cap_codes <- source_env$spar_cap$capacity
  ind_codes <- source_env$spar_ind$indicator
  cap[, overall := rowMeans(.SD, na.rm = TRUE), .SDcols = cap_codes]
  region_means <- cap[, lapply(.SD, mean, na.rm = TRUE),
                      by = .(year, region), .SDcols = cap_codes]
  global_means <- cap[, lapply(.SD, mean, na.rm = TRUE),
                      by = year, .SDcols = cap_codes][, region := "Total"]
  comparisons <- rbindlist(list(region_means, global_means), use.names = TRUE)
  comparisons[, overall := rowMeans(.SD), .SDcols = cap_codes]
  ind_means <- rbindlist(list(
    ind[, lapply(.SD, mean, na.rm = TRUE), by = .(year, region), .SDcols = ind_codes],
    ind[, lapply(.SD, mean, na.rm = TRUE), by = year, .SDcols = ind_codes][, region := "Total"]
  ), use.names = TRUE)

  # Store the exact word frequencies, rather than a truncated country top-N.
  # This allows exact regrouping for every supported year/region/country/capacity.
  tokens <- as.data.table(source_env$spar_comment_word)
  words <- tokens[!is.na(words) & !words %in% source_env$stop_words_all$word,
                  .(n = .N), by = .(year, region, country, cap_id, word = words)]
  message("Prepared word frequencies: ", nrow(words), " rows")
  comments <- as.data.table(source_env$spar_comment_lower)[,
    .(year, region, country, cap_id, comment)]
  raw <- as.data.table(source_env$raw_data)
  imp_cols <- grep("_imp$", names(raw), value = TRUE)
  area_cols <- grep("_area$", names(raw), value = TRUE)
  imp <- melt(raw, id.vars = c("year", "region", "country"),
              measure.vars = imp_cols, variable.name = "indicator", value.name = "status")
  imp <- as.data.table(separate_longer_delim(imp, status, "\r\n"))
  imp <- imp[!is.na(status)]
  imp[, indicator := sub("_imp$", "", indicator)]
  imp[!status %in% c("Ongoing", "Challenges/gaps", "Planned", "Achieved",
                     "Strength/best practice", "Other"), status := "Other"]
  imp <- imp[, .(n = .N), by = .(year, region, country, indicator, status)]
  areas <- melt(raw, id.vars = c("year", "region", "country"),
                measure.vars = area_cols, variable.name = "indicator", value.name = "area")
  areas <- separate_longer_delim(areas, area, "/")
  areas <- as.data.table(separate_longer_delim(areas, area, "\r\n"))
  areas <- areas[!is.na(area), .(n = .N), by = .(year, region, country, area)]

  # Compact tables retain the original column names and all values.
  pack <- function(x) {
    cols <- lapply(x, function(v) I(if (is.factor(v)) as.character(v) else v))
    list(columns = names(x), data = cols)
  }
  map_names <- echarts4r::e_country_names(as.data.frame(unique(cap[, .(iso)])), iso, map_name, type = "iso3c")
  map_names$map_name[map_names$iso == "CIV"] <- "Côte d'Ivoire"
  message("Prepared country-map names")
  original_counts <- lapply(years, function(year) {
    original <- get(paste0("cap_", year), envir = source_env)
    data.table(year = year, region = as.character(original$region))[, .(n = .N), by = .(year, region)]
  })
  payload <- list(
    meta = list(years = years, regions = c("AFRO", "AMRO", "EMRO", "EURO", "SEARO", "WPRO"),
      source_md5 = unname(tools::md5sum(source_file)), source = "SPAR self-assessment snapshot",
      build_date = "2026-10-29", status = "SPAR public explorer"),
    capacities = pack(as.data.table(source_env$spar_cap)),
    indicators = pack(as.data.table(source_env$spar_ind)),
    cap = pack(cap), ind = pack(ind), comparisons = pack(comparisons), ind_means = pack(ind_means),
    comments = pack(comments), words = pack(words), implementation = pack(imp), areas = pack(areas),
    raw = pack(raw[, .(year, region, country, approach, consultative, sector)]),
    submissions = pack(rbindlist(original_counts)),
    map_names = pack(as.data.table(map_names))
  )
  message("Prepared packed tables")
  list(payload = payload, cap = cap, ind = ind, source_env = source_env)
}

score_table <- function(data, codes, group, labels) {
  shared <- SharedData$new(as.data.frame(data), key = ~key, group = group)
  defs <- list(key = colDef(show = FALSE), year = colDef(name = "Year", width = 75),
    region = colDef(name = "Region", width = 85), country = colDef(name = "State Party", minWidth = 220),
    iso = colDef(name = "ISO", width = 70))
  for (code in codes) defs[[code]] <- colDef(name = code, minWidth = 78,
    header = tags$span(title = labels[match(code, codes)], code),
    format = colFormat(digits = 1))
  if ("overall" %in% names(data)) defs$overall <- colDef(name = "Overall", format = colFormat(digits = 1))
  reactable(shared, columns = defs, searchable = TRUE, filterable = TRUE,
    defaultPageSize = 12, showPageSizeOptions = TRUE, highlight = TRUE,
    striped = FALSE, bordered = FALSE, wrap = FALSE, height = 540,
    elementId = paste0(group, "-table"))
}

