import fs from 'fs';
import * as topo from 'topojson-client';
const t = JSON.parse(fs.readFileSync(new URL('../data/countries-50m.json', import.meta.url)));
const fc = topo.feature(t, t.objects.countries);
// region: lon -25..95, lat 0..72
const keep = fc.features.filter(f => {
  let ok = false;
  const walk = c => { if (typeof c[0] === 'number') { if (c[0] > -25 && c[0] < 95 && c[1] > 0 && c[1] < 72) ok = true; } else c.forEach(walk); };
  walk(f.geometry.coordinates); return ok;
}).map(f => ({ name: f.properties.name, geometry: f.geometry }));
fs.writeFileSync(new URL('../data/region.json', import.meta.url), JSON.stringify(keep));
console.log(keep.length, keep.filter(k=>/Kingdom|Pakistan/.test(k.name)).map(k=>k.name));
