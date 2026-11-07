// countries-50m (world-atlas, Natural Earth) -> data/geo.json: UK polygons, land borders, coastlines
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const topojson = require('topojson-client');
const world = JSON.parse(fs.readFileSync(new URL('../data/countries-50m.json', import.meta.url)));
const countries = topojson.feature(world, world.objects.countries).features;
const uk = countries.find((f) => f.id === '826');
const polys = uk.geometry.type === 'Polygon' ? [uk.geometry.coordinates] : uk.geometry.coordinates;
const borders = topojson.mesh(world, world.objects.countries, (a, b) => a !== b).coordinates;
const coasts = topojson.mesh(world, world.objects.countries, (a, b) => a === b).coordinates;
const r = (l) => l.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
fs.writeFileSync(new URL('../data/geo.json', import.meta.url), JSON.stringify({ uk: polys.map((p) => p.map(r)), borders: borders.map(r), coasts: coasts.map(r) }));
console.log('uk polygons', polys.length, 'borders', borders.length, 'coasts', coasts.length, 'name', uk.properties.name);
