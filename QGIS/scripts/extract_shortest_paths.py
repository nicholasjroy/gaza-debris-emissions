# Python script that extacts the shortest paths from the OD Shortest Distances Matrix generated using the QNEAT3 plugin

from qgis.core import QgsProject, QgsVectorLayer, QgsFeature, QgsField, QgsGeometry

# Load your layer
layer_path = r'C:\Users\...'
shortest_paths_layer = QgsVectorLayer(layer_path, 'shortest_paths_layer', 'ogr')
if not shortest_paths_layer.isValid():
    print("Layer failed to load!")

# Prepare a dictionary to hold minimum distances for each building
min_distances = {}

# Iterate over features to find the minimum distance for each building
for feature in shortest_paths_layer.getFeatures():
    origin_id = feature['origin_id']
    total_cost = feature['total_cost']
    
    if origin_id not in min_distances:
        min_distances[origin_id] = feature
    else:
        if total_cost < min_distances[origin_id]['total_cost']:
            min_distances[origin_id] = feature

# Create a new memory layer to hold the result
fields = shortest_paths_layer.fields()
crs = shortest_paths_layer.crs().authid()
min_distance_layer = QgsVectorLayer(f"LineString?crs={crs}", "min_distances", "memory")
min_distance_layer.dataProvider().addAttributes(fields)
min_distance_layer.updateFields()

# Add the minimum distance features to the new layer
min_distance_layer.startEditing()
for origin_id, feature in min_distances.items():
    new_feature = QgsFeature(fields)
    new_feature.setAttributes(feature.attributes())
    new_feature.setGeometry(feature.geometry())
    min_distance_layer.addFeature(new_feature)
min_distance_layer.commitChanges()

# Add the new layer to the QGIS project
QgsProject.instance().addMapLayer(min_distance_layer)
