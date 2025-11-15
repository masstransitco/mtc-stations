# Special Traffic News Feed – Findings

## Source

- Endpoint: Transport Department “Special Traffic News” XML feed (`http://data.one.gov.hk/td` namespace, schema `http://data.one.gov.hk/xsd/td/specialtrafficnews.xsd`).
- Sample pulled from `specialtrafficnews.xml` (15 Nov 2025 snapshot).

## Structure

- Root `<body>` contains repeating `<message>` elements.
- Each `<message>` includes:
  - `msgID` – unique identifier.
  - `CurrentStatus` – numeric alert status (`2` = active/ongoing, `3` = cleared/information).
  - `ChinText` / `ChinShort`, `EngText` / `EngShort` – bilingual long/short narratives. Content often spans multiple paragraphs and may embed HTML entities (e.g., `&#034;`).
  - `ReferenceDate` – localized timestamp string such as `2025/11/15 下午 02:09:46` (Chinese AM/PM markers); requires conversion to ISO/UTC before storing.
  - `IncidentRefNo`, `CountofDistricts`, `ListOfDistrict` – present but empty in the current dump.

## Content Observations

- Snapshot held 8 messages covering carpark saturation notices, lane closures, event-related diversions, and public transport adjustments.
- Messages are cohesive in time (all `ReferenceDate` values within the same minute), implying batch publishing rather than incremental streaming.
- No explicit coordinates or structured addresses; only narrative descriptions mention roads/areas. `ListOfDistrict` is empty, so consumers must infer locations themselves.

## Integration Notes

- Poll frequency: 2–5 minutes is sufficient for near-real-time updates; each fetch downloads ~30–50 KB and the upstream API has no auth or quota hints.
- XML uses the default TD namespace; parsers must respect `xmlns="http://data.one.gov.hk/td"` or tag lookups will fail.
- Because `CurrentStatus` distinguishes active vs. cleared events, ingestion logic should retain history and mark resolved alerts when status switches from `2` to `3`.
- Handle multiline text and newline characters in `<ChinText>/<EngText>`; avoid stripping them if you plan to render paragraphs.
