// ==========================================
// 1. SETUP
// ==========================================

var admin0 = ee.FeatureCollection('FAO/GAUL/2015/level0');
var gazaGeom = admin0.filter(ee.Filter.eq('ADM0_NAME', 'Gaza Strip')).geometry();

// Load Buildings
var tileId = 'building_122130'; 
var path = 'projects/sat-io/open-datasets/OPEN-BUILDING-MAPS/tiles/' + tileId;
var gazaBuildings = ee.FeatureCollection(path).filterBounds(gazaGeom); 

 // Load Damage Points
var damage_points = ee.FeatureCollection('projects/gaza-building-debris/assets/unosat_cda_20260616');
var damage_field = 'dmg_jun26';   // 16 June 2026; use 'dmg_oct25' for 11 Oct 2025
var filtered_points = damage_points.filter(ee.Filter.inList(damage_field, [1, 2, 3]));
print('Total damage points (classes 1-3):', filtered_points.size());   // expect 176,366

// ==========================================
// 2. MATCH EACH POINT TO NEAREST BUILDING
// ==========================================

// Pre-calculate Area, and drop broken shapes (one footprint covers the whole globe)
var buildingsWithArea = gazaBuildings.map(function(f) {
  return f.set('area_m2', f.geometry().area(1));
}).filter(ee.Filter.lt('area_m2', 1e5));   // largest real footprint is ~17,000 m²

// Each point keeps only its closest building within 10 m
var nearest = ee.Join.saveBest({matchKey: 'bld', measureKey: 'dist'}).apply(
  filtered_points,
  buildingsWithArea,
  ee.Filter.withinDistance({distance: 10, leftField: '.geo', rightField: '.geo', maxError: 1})
);

// Keep just each point's building ID and damage class
var pointsWithId = nearest.map(function(p) {
  return ee.Feature(null, {
    bld_id: ee.Feature(p.get('bld')).id(),
    dmg: p.get(damage_field)
  });
});

// ==========================================
// 3. ASSIGN VALUES TO BUILDINGS
// ==========================================

// Most severe class per building (lowest UNOSAT code)
var groups = ee.List(pointsWithId.reduceColumns({
  selectors: ['dmg', 'bld_id'],
  reducer: ee.Reducer.min().group({groupField: 1, groupName: 'bld_id'})
}).get('groups'));

var classTable = ee.FeatureCollection(groups.map(function(g) {
  g = ee.Dictionary(g);
  return ee.Feature(null, {bld_id: g.get('bld_id'), cls: g.get('min')});
}));

// Attach the class to each building; 0 = no damage
var joined = ee.Join.saveFirst({matchKey: 'match', outer: true}).apply(
  buildingsWithArea,
  classTable,
  ee.Filter.equals({leftField: 'system:index', rightField: 'bld_id'})
);

var final_export = joined.map(function(f) {
  var match = f.get('match');
  var finalClass = ee.Algorithms.If(match, ee.Feature(match).get('cls'), 0);
  return f.select(['.geo', 'area_m2'])
          .set('final_damage_class', finalClass);
});

// ==========================================
// 4. EXPORT
// ==========================================

Export.table.toAsset({
  collection: final_export,
  description: 'Gaza_Classified_Buildings_20260616',
  assetId: 'projects/gaza-building-debris/assets/Gaza_Classified_Buildings_20260616'
});