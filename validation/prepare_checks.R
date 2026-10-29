library(data.table)
library(jsonlite)
library(stringr)

# Independent references read the original data, not the browser aggregates.
load(Sys.getenv("SPAR_SOURCE_FILE", unset = "../data/app_data.RData"))
years <- 2021:2025
bind_source <- function(prefix) rbindlist(lapply(years, function(y) {
  x <- copy(get(paste0(prefix, y)))
  if (y >= 2024) x <- na.omit(x)
  x
}))
cap_source <- bind_source("cap_")
ind_source <- bind_source("ind_")
cap_codes <- spar_cap$capacity
ind_codes <- spar_ind$indicator
payload <- fromJSON("build/data.json", simplifyVector = TRUE)
unpack <- function(x) {
  as.data.table(x$data)
}
export_cap <- unpack(payload$cap)
export_ind <- unpack(payload$ind)
stopifnot(nrow(export_cap) == nrow(cap_source), nrow(export_ind) == nrow(ind_source))
for (code in cap_codes) stopifnot(isTRUE(all.equal(export_cap[[code]], cap_source[[code]], check.attributes = FALSE)))
for (code in ind_codes) stopifnot(isTRUE(all.equal(export_ind[[code]], ind_source[[code]], check.attributes = FALSE)))
for (field in c("year", "region", "country", "iso")) {
  stopifnot(identical(as.character(export_cap[[field]]), as.character(cap_source[[field]])))
  stopifnot(identical(as.character(export_ind[[field]]), as.character(ind_source[[field]])))
}
stopifnot(identical(as.character(unpack(payload$comments)$comment), spar_comment_lower$comment))
stopifnot(any(unlist(export_ind[, ..ind_codes]) == 0, na.rm = TRUE))

regions <- c("Total", "AFRO", "AMRO", "EMRO", "EURO", "SEARO", "WPRO")
states <- rbindlist(lapply(years, function(y) data.table(year = y, region = regions, country = "Total")))
country_states <- cap_source[iso %in% c("PHL", "FJI", "VNM", "CHN", "USA", "CIV", "DEU", "MNG"), .(year, region, country)]
states <- rbindlist(list(states, country_states))
references <- lapply(seq_len(nrow(states)), function(i) {
  state <- states[i]
  select_rows <- function(x) x[year == state$year &
    (state$region == "Total" | region == state$region) &
    (state$country == "Total" | country == state$country)]
  caps <- select_rows(cap_source)
  inds <- select_rows(ind_source)
  comments <- select_rows(as.data.table(spar_comment_lower))
  words <- select_rows(as.data.table(spar_comment_word))[!is.na(words) & !words %in% stop_words_all$word]
  cases <- list(c("training", "capacity building"), "(", character(), "training,", c("training", "training"))
  keyword_refs <- lapply(cases, function(kw) list(terms = kw,
    counts = comments[, .(value = sum(vapply(kw, function(term) sum(str_count(comment, fixed(term))), numeric(1)))), by = .(name = as.character(cap_id))]))
  top_refs <- lapply(c("Total", "C4", "C9"), function(capacity) {
    counts <- words[capacity == "Total" | as.character(cap_id) == capacity, .(n = .N), by = words][order(-n)]
    list(capacity = capacity, total = sum(counts$n), cutoff = if (nrow(counts)) counts$n[min(15, nrow(counts))] else 0,
         counts = setNames(as.list(counts$n), counts$words))
  })
  list(state = as.list(state), count = nrow(caps), indicator_count = nrow(inds),
    means = as.list(caps[, lapply(.SD, mean, na.rm = TRUE), .SDcols = cap_codes]),
    ind_means = as.list(inds[, lapply(.SD, mean, na.rm = TRUE), .SDcols = ind_codes]),
    thresholds = lapply(c(0, 20, 60, 100), function(t) list(threshold = t, above = sum(rowMeans(caps[, ..cap_codes], na.rm = TRUE) >= t))),
    keywords = keyword_refs, top_words = top_refs)
})
write_json(references, "validation/reference_values.json", auto_unbox = TRUE, null = "null", na = "null", digits = NA)
write_json(list(capacity_rows = nrow(cap_source), indicator_rows = nrow(ind_source),
  score_cells = nrow(cap_source) * length(cap_codes) + nrow(ind_source) * length(ind_codes),
  comments_checked = nrow(spar_comment_lower), filter_scenarios = nrow(states),
  source_values_preserved = TRUE), "validation/r_checks.json", auto_unbox = TRUE, pretty = TRUE)
cat("R source and JSON round-trip checks passed\n")

