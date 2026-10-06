// Summary statistics for classified buildings

var building_data = ee.FeatureCollection('projects/gaza-building-debris/assets/Gaza_Classified_Buildings_Heights_20260616');
var class_field = 'final_damage_class';

// Debris weights (tonnes per m² of living area)
var weights = {1: 1.0, 2: 0.75, 3: 0.3};
var names = {1: 'Destroyed', 2: 'Severe', 3: 'Moderate'};

// Counts and checks
print('Buildings per class:', building_data.aggregate_histogram(class_field));

var damaged = building_data.filter(ee.Filter.gt(class_field, 0));
print('Damaged buildings:', damaged.size());   // compare with 176,366 UNOSAT points
print('Damaged with 0 storeys:', damaged.filter(ee.Filter.eq('storey_count', 0)).size());
print('Damaged living area (m²):', damaged.aggregate_sum('total_living_area').format('%,.1f'));

// Debris per class and total
var total = ee.Number(0);
[1, 2, 3].forEach(function(c) {
  var area = ee.Number(building_data.filter(ee.Filter.eq(class_field, c)).aggregate_sum('total_living_area'));
  var debris = area.multiply(weights[c]);
  print('Debris, ' + names[c] + ' (t):', debris.format('%,.1f'));
  total = total.add(debris);
});
print('TOTAL debris (t):', total.format('%,.1f'));