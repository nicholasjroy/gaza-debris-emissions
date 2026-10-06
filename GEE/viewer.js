
// ---------- AOI (Gaza Strip) ---------- //

var admin0 = ee.FeatureCollection('FAO/GAUL/2015/level0');
var gaza = admin0.filter(ee.Filter.eq('ADM0_NAME', 'Gaza Strip'));
var gazaGeom = gaza.geometry();

// ---------- Clean-up Damage Point Data ---------- //

var damage_points = ee.FeatureCollection('projects/gaza-building-debris/assets/unosat_cda_20260616');
var damage_field = 'dmg_jun26';   // 16 June 2026
var damage_classes = [1, 2, 3];

var class_labels = {
  1: "Destroyed",
  2: "Severe Damage",
  3: "Moderate Damage"
};

var classColors = {
  1: 'red',
  2: 'orange',
  3: 'yellow'};
  
var filtered_points = damage_points.filter(
  ee.Filter.inList(damage_field, damage_classes));

// Sanity check: damage class counts
// var counts = filtered_points.aggregate_histogram(damage_field);
// print('Count per damage class (points):', counts);

// ---------- Load Building Dataset ---------- //

var building_data = ee.FeatureCollection('projects/gaza-building-debris/assets/Gaza_Classified_Buildings_Heights_20260616')

// ----------  Overlay GHSL Height Map ---------- //

var ghslVis = ee.Image("JRC/GHSL/P2023A/GHS_BUILT_H/2018").clip(gazaGeom);

var heightVis = {
  min: 0,
  max: 30, 
  palette: [
    '#440154',  // purple
    '#3b528b',  // blue
    '#21908d',  // cyan
    '#5dc863',  // lightgreen
    '#fde725',  // yellow
    '#fdae61',  // orange
    '#d53e4f'   // red
  ]
};

Map.centerObject(gazaGeom, 12.5);
Map.addLayer(ghslVis, heightVis, 'Building Height (GHSL 2018)', false);


// ---------- Visualize Damaged Buildings ---------- //

var styled_layer = building_data.map(function(feat) {
  var dClass = feat.getNumber('final_damage_class');
  
  var color = ee.String(
    ee.Algorithms.If(dClass.eq(1), 'red',
      ee.Algorithms.If(dClass.eq(2), 'orange',
        ee.Algorithms.If(dClass.eq(3), 'yellow',
          '#AAB6BC')))
  );
  
  return feat.set('style', {
    fillColor: color, 
    color: 'silver',  
    width: 0.4           
  });
});

Map.addLayer(styled_layer.style({styleProperty: 'style'}), {}, 'Classified Buildings (OpenBuildingMap)');


// ----------  Overlay UNOSAT Damage Points ---------- //

damage_classes.forEach(function(classId) {
  var class_i = filtered_points.filter(ee.Filter.eq(damage_field, classId));
  var color = classColors[classId] || 'grey';
  
  var styled_points = class_i.style({
    color: 'black',       
    fillColor: color,    
    pointSize: 3,        
    width: 0.75            
  });
  

    Map.addLayer(styled_points, {}, class_labels[classId] + ' (UNOSAT Jun26)',false);
  });


// ---------- Display Debris Heatmap ---------- //

var min_threshold = 0.2;

var heatVis = {
  min: min_threshold,  
  max: 5.5,  
  palette: [
    '#2c7bb6',   // deep blue
    '#00a6ca',   // light blue
    '#00ccbc',   // teal
    '#90eb9d',   // green
    '#ffff8c',   // yellow
    '#f9d057',   // orange
    '#d7191c'    // red
  ]
};

var debrisLayer = ee.Image('projects/gaza-building-debris/assets/Gaza_Debris_Heatmap_20260616')
  .clip(gazaGeom);  

var balancedGrid = debrisLayer;  

var midKernel = ee.Kernel.gaussian({
  radius: 180,      
  sigma: 60,          
  units: 'meters',
  normalize: true     
});

var smoothedDebris = balancedGrid.convolve(midKernel);
var logDebris = smoothedDebris.add(1).log();
var finalLayer = logDebris
  .updateMask(logDebris.gt(min_threshold))
  .reproject({
    crs: 'EPSG:32636',
    scale: 30
  });

Map.addLayer(finalLayer, heatVis, 'Debris Heatmap (Log)');


// ---------- UI: Inspect Individual Building ---------- //

var inspectorPanel = ui.Panel({
  style: {
    position: 'bottom-right',
    width: '175px',
    padding: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid #ddd'
  }
});
Map.add(inspectorPanel);

inspectorPanel.add(ui.Label(
  'Inspector Tool',
  {fontWeight: 'bold', fontSize: '14px', margin: '0 0 4px 1px'}
));
inspectorPanel.add(ui.Label(
  'Click on a building to see details.',
  {fontSize: '11px', color: '#555', margin: '0 0 0 1px'}
));

Map.style().set('cursor', 'crosshair');

function removeHighlightLayer() {
  var layers = Map.layers();
  for (var i = 0; i < layers.length(); i++) {
    var layer = layers.get(i);
    if (layer.getName() === 'Selected Building') {
      layers.remove(layer);
      break;
    }
  }
}

Map.onClick(function(coords) {
  if (isDrawing) return;   // don't inspect while drawing

  inspectorPanel.clear();
  inspectorPanel.add(ui.Label(
    'Fetching data...',
    {fontSize: '12px', color: 'gray', margin: '2px 0'}
  ));

  removeHighlightLayer();

  var clickPoint = ee.Geometry.Point(coords.lon, coords.lat);

  var selectedBuilding = building_data
    .filterBounds(clickPoint)
    .filter(ee.Filter.gt('height_ghsl', 0))
    .first();

  var highlightFc = ee.FeatureCollection(
    ee.Algorithms.If(
      selectedBuilding,
      ee.FeatureCollection([selectedBuilding]),
      ee.FeatureCollection([])
    )
  );

  var highlightLayer = ui.Map.Layer(
    highlightFc.style({
      color: 'magenta',
      fillColor: '00000000',
      width: 4
    }),
    {},
    'Selected Building'
  );
  Map.add(highlightLayer);

  selectedBuilding.evaluate(function(feat) {
    inspectorPanel.clear();

    if (!feat) {
      inspectorPanel.add(ui.Label(
        'No building found here.',
        {fontSize: '12px', color: 'gray', margin: '2px 0'}
      ));

      removeHighlightLayer();
      return;
    }

    var props = feat.properties;

    inspectorPanel.add(ui.Label(
      'Building Details',
      {fontWeight: 'bold', fontSize: '15px', color: '#333', margin: '0 0 1px 0'}
    ));
    inspectorPanel.add(ui.Label(
      'ID: ' + feat.id,
      {fontSize: '10px', color: 'gray', margin: '0 0 6px 0'}
    ));

    var dClass = props.final_damage_class;
    var dText = 'Unknown';
    var dColor = 'black';
    var bg = 'white';

    if (dClass === 1) { dText = 'DESTROYED';        dColor = 'white'; bg = '#d32f2f'; }
    else if (dClass === 2) { dText = 'SEVERE DAMAGE';   dColor = 'white'; bg = '#f57c00'; }
    else if (dClass === 3) { dText = 'MODERATE DAMAGE'; dColor = 'black'; bg = '#fff176'; }
    else { dText = 'NO DETECTED DAMAGE'; dColor = 'white'; bg = '#388e3c'; }

    inspectorPanel.add(ui.Label({
      value: dText,
      style: {
        fontWeight: 'bold',
        fontSize: '11px',
        color: dColor,
        backgroundColor: bg,
        padding: '2px 6px',
        margin: '0 0 8px 0',
        borderRadius: '4px'
      }
    }));

    var tableContainer = ui.Panel({layout: ui.Panel.Layout.flow('horizontal')});
    var leftCol = ui.Panel({style: {width: '110px'}});
    var rightCol = ui.Panel({style: {stretch: 'horizontal'}});

    tableContainer.add(leftCol);
    tableContainer.add(rightCol);
    inspectorPanel.add(tableContainer);

    var addRow = function(label, value) {
      leftCol.add(ui.Label(label, {
        fontSize: '12px',
        color: '#666',
        margin: '1px 0'
      }));
      rightCol.add(ui.Label(value, {
        fontSize: '12px',
        fontWeight: 'bold',
        color: '#222',
        margin: '1px 0'
      }));
    };

    addRow('Footprint Area:', Math.round(props.area_m2) + ' m²');
    addRow('GHSL Height:', (props.height_ghsl || 0).toFixed(1) + ' m');
    addRow('Est. Storeys:', props.storey_count);
    addRow('Total Living Area:', Math.round(props.total_living_area) + ' m²');
  });
});

// ---------- UI: Calculate Debris in Selected Area ---------- //

var drawingTools = Map.drawingTools();
drawingTools.setShown(false); 
var isDrawing = false;   // ignore inspector clicks while drawing

var debrisPanel = ui.Panel({
  style: {
    position: 'bottom-left',
    width: '230px', 
    padding: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid #ddd'
  }
});
Map.add(debrisPanel);

debrisPanel.add(ui.Label('Debris Calculator', {fontWeight: 'bold', fontSize: '16px', margin: '0 0 2px 0'}));
debrisPanel.add(ui.Label('Draw a box or shape to calculate total tonnage.', {fontSize: '12px', color: '#555', margin: '0 0 4px 0'}));

while (drawingTools.layers().length() > 0) {
  var layer = drawingTools.layers().get(0);
  drawingTools.layers().remove(layer);
}

var dummyGeometry = ui.Map.GeometryLayer({
  geometries: null, 
  name: 'selection', 
  color: 'magenta'
});
drawingTools.layers().add(dummyGeometry);

function calculateDebrisInBox() {
  isDrawing = false;
  var layer = drawingTools.layers().get(0);
  var geometries = layer.geometries();
  
  if (geometries.length() === 0) return;
  
  var geometry = geometries.get(geometries.length() - 1);
  
  var widgets = debrisPanel.widgets();

  while (widgets.length() > 4) { debrisPanel.remove(widgets.get(4)); } 
  debrisPanel.add(ui.Label('Calculating...', {color: 'gray', margin: '4px 0'}));

  var selected = building_data.filterBounds(geometry);
  
  var area3 = selected.filter(ee.Filter.eq('final_damage_class', 3)).aggregate_sum('total_living_area');
  var area2 = selected.filter(ee.Filter.eq('final_damage_class', 2)).aggregate_sum('total_living_area');
  var area1 = selected.filter(ee.Filter.eq('final_damage_class', 1)).aggregate_sum('total_living_area');
  var count = selected.size();

  var stats = ee.Dictionary({
    'area3': area3, 'area2': area2, 'area1': area1, 'count': count
  });

  stats.evaluate(function(result) {
    var w = debrisPanel.widgets();
    if (w.length() > 4) debrisPanel.remove(w.get(w.length()-1)); 

    var w1 = 1.0; var w2 = 0.75; var w3 = 0.3;

    var t3 = (result.area3 || 0) * w3;
    var t2 = (result.area2 || 0) * w2;
    var t1 = (result.area1 || 0) * w1;
    var totalTonnes = t3 + t2 + t1;

    debrisPanel.add(ui.Label('Total Estimated Debris:', {fontSize: '12px', fontWeight: 'bold', margin: '6px 0 0 0'}));
    debrisPanel.add(ui.Label({
      value: Math.round(totalTonnes).toLocaleString() + ' t',
      style: {fontSize: '28px', color: '#d32f2f', fontWeight: 'bold', margin: '0 0 8px 0'}
    }));

    debrisPanel.add(ui.Label('Breakdown by Damage Class:', {fontSize: '11px', color: 'gray', margin: '0 0 2px 0'}));
    
    var addRow = function(color, label, val) {
      var row = ui.Panel({layout: ui.Panel.Layout.flow('horizontal'), style: {margin: '1px 0'}});
      row.add(ui.Label('█ ', {color: color, fontSize: '10px', margin: '3px 4px 0 0'}));
      row.add(ui.Label(label + ': ', {fontSize: '12px', color: '#333', width: '65px', margin: '1px 0'}));
      row.add(ui.Label(Math.round(val).toLocaleString() + ' t', {fontSize: '12px', fontWeight: 'bold', margin: '1px 0'}));
      debrisPanel.add(row);
    };

    addRow('red', 'Destroyed', t1);
    addRow('orange', 'Severe', t2);
    addRow('gold', 'Moderate', t3);
    
    debrisPanel.add(ui.Label('Buildings Selected: ' + result.count, {fontSize: '11px', color: '#999', margin: '8px 0 2px 0'}));
    debrisPanel.add(ui.Label('*Assumes 1 t of debris per m² of living area, weighted 1.0, 0.75 and 0.3 for destroyed, severely damaged and moderately damaged buildings, respectively.', {fontSize: '9px', color: '#bbb', margin: '2px 0 0 0'}));
  });
  
  if (geometries.length() > 1) {
    layer.geometries().remove(geometries.get(0));
  }
}

drawingTools.onDraw(ui.util.debounce(calculateDebrisInBox, 500));
drawingTools.onEdit(ui.util.debounce(calculateDebrisInBox, 500));

function startDrawing(shape) {
  isDrawing = true;
  drawingTools.setSelected(dummyGeometry);
  drawingTools.setShape(shape);
  drawingTools.draw();
}

var boxBtn = ui.Button({
  label: '▭ Draw Box',
  onClick: function() { startDrawing('rectangle'); },
  style: {stretch: 'horizontal', margin: '4px 2px 4px 0'}
});

var shapeBtn = ui.Button({
  label: '⬠️ Draw Shape',
  onClick: function() { startDrawing('polygon'); },
  style: {stretch: 'horizontal', margin: '4px 0 4px 2px'}
});

debrisPanel.add(ui.Panel([boxBtn, shapeBtn], ui.Panel.Layout.flow('horizontal'), {stretch: 'horizontal'}));

var clearBtn = ui.Button({
  label: 'Clear',
  onClick: function() {
    var layer = drawingTools.layers().get(0);
    while (layer.geometries().length() > 0) {
      layer.geometries().remove(layer.geometries().get(0));
    }
    var widgets = debrisPanel.widgets();
    while (widgets.length() > 4) { debrisPanel.remove(widgets.get(4)); }
    drawingTools.stop();
    isDrawing = false;
  },
  style: {stretch: 'horizontal', color: '#d32f2f', margin: '0'}
});

debrisPanel.add(clearBtn);
