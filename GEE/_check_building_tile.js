
// Check which Open Building Maps tiles cover Gaza

var admin0 = ee.FeatureCollection('FAO/GAUL/2015/level0');
var gazaGeom = admin0.filter(ee.Filter.eq('ADM0_NAME', 'Gaza Strip')).geometry();

// Tiles intersecting Gaza
var grid = ee.FeatureCollection('projects/sat-io/open-datasets/OPEN-BUILDING-MAPS/open_buildings_grid');
var gazaTiles = grid.filterBounds(gazaGeom);
print('Tile IDs (quadkeys):', gazaTiles.aggregate_array('quadkey'));

Map.centerObject(gazaGeom, 11);
Map.addLayer(gazaGeom, {color: 'red'}, 'Gaza boundary');
Map.addLayer(gazaTiles, {color: 'cyan'}, 'Open Building Maps tiles');

// Footprints in the tile used by 01_classify_buildings
var tileId = 'building_122130';
var path = 'projects/sat-io/open-datasets/OPEN-BUILDING-MAPS/tiles/' + tileId;
var gazaBuildings = ee.FeatureCollection(path).filterBounds(gazaGeom);
print('Buildings in ' + tileId + ' within Gaza:', gazaBuildings.size());
Map.addLayer(gazaBuildings, {color: 'grey'}, 'Footprints (' + tileId + ')', false);