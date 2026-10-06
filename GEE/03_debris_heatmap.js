// ==========================================
// 1. SETUP
// ==========================================

// Input Data
var building_data = ee.FeatureCollection('projects/gaza-building-debris/assets/Gaza_Classified_Buildings_Heights_20260616');
var admin0 = ee.FeatureCollection('FAO/GAUL/2015/level0');
var gazaGeom = admin0.filter(ee.Filter.eq('ADM0_NAME', 'Gaza Strip')).geometry();

// Debris Weights
var w1 = 1.0;   // Destroyed (UNOSAT code 1)
var w2 = 0.75;  // Severe    (UNOSAT code 2)
var w3 = 0.3;   // Moderate  (UNOSAT code 3)

var exportScale = 10; 

// ==========================================
// 2. CALCULATE DEBRIS 
// ==========================================

var debris_features = building_data.map(function(feat) {
  var dClass = feat.getNumber('final_damage_class');
  var livingArea = feat.getNumber('total_living_area');
  
  // Determine Weight based on Class
  var weight = ee.Algorithms.If(dClass.eq(3), w3,
                 ee.Algorithms.If(dClass.eq(2), w2,
                   ee.Algorithms.If(dClass.eq(1), w1, 
                     0.0))); // Undamaged = 0
  
  var debrisTonnes = livingArea.multiply(weight);
  
  // Convert to Centroid
  return feat.centroid(1) 
             .set('debris_tonnes', debrisTonnes);
});

// Filter out 0 debris points
var active_debris = debris_features.filter(ee.Filter.gt('debris_tonnes', 0));

// ==========================================
// 3. RASTERIZE
// ==========================================

// Reduce the points into an image.
// If multiple buildings fall into one pixel, sum their debris together.
var debris_raster = active_debris.reduceToImage({
  properties: ['debris_tonnes'],
  reducer: ee.Reducer.sum()
});

var final_heatmap = debris_raster.clip(gazaGeom);

// ==========================================
// 4. EXPORT
// ==========================================

// Pixel Value = Total Metric Tonnes of Debris in that pixel.

Export.image.toAsset({
  image: final_heatmap,
  description: 'Gaza_Debris_Heatmap_20260616',
  assetId: 'projects/gaza-building-debris/assets/Gaza_Debris_Heatmap_20260616',
  region: gazaGeom,
  scale: exportScale,
  maxPixels: 1e9,
  crs: 'EPSG:32636'
});
