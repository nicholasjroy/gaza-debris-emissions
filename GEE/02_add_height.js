// ==========================================
// 1. INPUTS
// ==========================================

var classified_buildings = ee.FeatureCollection('projects/gaza-building-debris/assets/Gaza_Classified_Buildings_20260616');
var admin0 = ee.FeatureCollection('FAO/GAUL/2015/level0');
var gazaGeom = admin0.filter(ee.Filter.eq('ADM0_NAME', 'Gaza Strip')).geometry();

// Load GHSL Height (2018)
var ghsl = ee.Image("JRC/GHSL/P2023A/GHS_BUILT_H/2018");

// ==========================================
// 2. Sample GHLS at Centroids
// ==========================================

var centroids = classified_buildings.map(function(feat) {
  return feat.centroid(1); // 1m error margin is fine for finding a center
});

var height_points = ghsl.reduceRegions({
  collection: centroids,
  reducer: ee.Reducer.first().setOutputs(['height_ghsl']), 
  scale: 100,
  crs: ghsl.projection()
});

// ==========================================
// 3. Merge Data Back to Polygons
// ==========================================

var filter = ee.Filter.equals({
  leftField: 'system:index',
  rightField: 'system:index'
});

var saveFirst = ee.Join.saveFirst({
  matchKey: 'height_match' 
});

var joined_buildings = saveFirst.apply(classified_buildings, height_points, filter);

// Estimate Storeys and Living Area
var final_dataset = joined_buildings.map(function(feat) {
  
  var match = ee.Feature(feat.get('height_match'));
  
  var h = match.getNumber('height_ghsl');
  var safeHeight = ee.Algorithms.If(h, h, 0); 
  
  var storeys = ee.Number(safeHeight).divide(3).round();
  
  var footprint = feat.getNumber('area_m2');
  
  var totalLivingArea = storeys.multiply(footprint);
  
  return feat.set('height_ghsl', safeHeight)
             .set('storey_count', storeys)
             .set('total_living_area', totalLivingArea)
             .set('height_match', null); 
});

// ==========================================
// 4. EXPORT
// ==========================================

Export.table.toAsset({
  collection: final_dataset,
  description: 'Gaza_Classified_Buildings_Heights_20260616',
  assetId: 'projects/gaza-building-debris/assets/Gaza_Classified_Buildings_Heights_20260616'
});