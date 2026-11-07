# UK Work Visas 2027: 3D globe video (visuals only)

A vertical (9:16, 1080×1920, 30 fps) **60-second** 3D map video that follows the
user's Hindi script scene by scene. On-screen text is short English only. It has **no audio at all**: no voiceover, music or
sound effects. The voiceover is added later in editing.

**Video:** [`output/UK_Work_Visas_2027_globe_vertical.mp4`](output/UK_Work_Visas_2027_globe_vertical.mp4)

## Scenes (approximate times for the voiceover edit)
| Time | Script | Visuals |
|------|--------|---------|
| 0–4.5 s | इंग्लैंड में अब बहुत ज़्यादा वीज़े खुलने वाले हैं | Fly from space down to the UK; the UK glows gold; Union Jack on a pole and as a badge; "UNITED KINGDOM" |
| 4.5–13.6 s | बड़ी ख़ुशख़बरी… 2027… वर्क वीज़े… ग़ैर-मुल्कियों के लिए | Pull out to the globe; gold flight arcs from around the world into London; **2027 / UK WORK VISAS**; travellers with suitcases on the UK |
| 13.6–20 s | कौन-कौन से वीज़े… किसे फ़ायदा… पूरी वीडियो देखिए | Orbit around the UK; question headlines; "watch till the end" pill |
| 20–27 s | पूर्व फ़ॉरेन ऑफ़िस अफ़सर का बयान… वीज़ों पर सख़्ती | Dive to London (pin, pulse ring); the UK turns red; a 3D official in a suit; quote card; **STRICT VISA RULES** stamp |
| 27–32 s | स्टूडेंट्स और वर्कर्स मुल्क छोड़ गए | Red arcs leaving the UK; a student and a worker walking away |
| 32–41 s | डिलीवरी, वेयरहाउस, खेत, मार्केट… लोकल लोग नहीं करते | Left-to-right sweep; 3D delivery van, warehouse, farm and market stall on the UK, labelled in English |
| 41–47 s | ग़ैर-मुल्की चलाते हैं… निज़ाम नहीं चल सकता | 3D foreign workers (delivery, warehouse, farm, market) on the map |
| 47–52.5 s | छह महीने या एक साल… शदीद क़िल्लत | **6 MONTHS – 1 YEAR**; a workers & labour meter draining to red |
| 52.5–56 s | तमाम कैटेगरीज़ के वीज़े खोलने पड़ेंगे | The UK turns green; **VISAS OPEN** stamp |
| 56–60 s | हो जाइए तैयार… दरवाज़े फिर खुलेंगे | 3D golden gates on the UK swing open with light behind; flag returns |

Only numbers that appear in the script are shown (2027, 6 months, 1 year). No
countries are named except the UK; the arcs show people coming "from around the
world" without labelling any country.

## Sources
- **Earth textures:** NASA Blue Marble, topology, water mask, clouds and night sky
  from the `three-globe` npm package example images (MIT package; the NASA imagery is
  public domain). Stored in `assets/`.
- **Borders:** Natural Earth via world-atlas `countries-50m` (`data/LICENSE`).
  `src/prep_geo.mjs` extracts the UK polygons, land borders and coastlines.
- **Font:** Inter. All on-screen text is short English, with no Hindi text in the frame.

## Rebuild
```bash
npm install
node src/prep_geo.mjs                     # -> data/geo.json
node src/render.mjs --stills 3.5,23,38.5  # previews
node src/render.mjs --workers 4           # -> output/video_silent.mp4
ffmpeg -i output/video_silent.mp4 -c:v libx264 -crf 20 -preset slow -an output/UK_Work_Visas_2027_globe_vertical.mp4
```
