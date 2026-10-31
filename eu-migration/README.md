# Which European Country Has the Most Immigrants? (2021–2025)

Vertical 9:16, 1080×1920, 30 fps, **63 s**. A flat 2D explainer covering immigration, growth, inflation and the crime-statistics caveat.

**Status: draft.** The economy scene (real GDP growth and HICP inflation) needs the official
Eurostat series, and this session cannot reach `ec.europa.eu`. Until `data/eurostat_econ.json`
exists, that scene shows an "EUROSTAT DATA PENDING" card. No values are invented.

`data/eurostat_econ.json` format (annual %, from Eurostat tec00115 and prc_hicp_aind):
```json
{"vintage": "Eurostat, extracted YYYY-MM-DD",
 "gdp_growth": {"DE": {"2021": 0.0, "2022": 0.0, "2023": 0.0, "2024": 0.0, "2025": 0.0}, "FR": {}, "ES": {}, "IT": {}, "NL": {}, "SE": {}},
 "hicp_rate":  {"DE": {"2021": 0.0, "...": 0.0}, "FR": {}, "ES": {}, "IT": {}, "NL": {}, "SE": {}}}
```
The renderer compounds the annual GDP rates into cumulative 2021–2025 growth. It also builds a price index (2021 = 100) from the HICP rates for 2022–2025.

Foreign-born residents (1 Jan 2025) and the 2024 arrivals come from the brief and are stored in `data/stats.json`.

## Audio
- **Narration:** one ElevenLabs file (`eleven_v4`, voice *Russell – Dramatic British TV*). It was 76 s raw. `src/prep_voice.py` caps pauses at 0.22 s and applies a 1.16× tempo with pitch kept, giving 62.1 s.
- **Music and SFX:** original, synthesised in `src/build_audio.py`.

## Rebuild
```bash
python3 src/prep_voice.py && python3 src/build_audio.py && python3 src/render.py
```
