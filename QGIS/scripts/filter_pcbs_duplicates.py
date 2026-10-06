# Python script that filters building footprints that are matched to several, overlapping PCBS storey count points by computing their average

import math

# Get the original layer
original_layer = QgsProject.instance().mapLayersByName("Matching features")[0]

# Duplicate the layer
duplicated_layer = original_layer.clone()
duplicated_layer.setName("Collapsed Matching Features")
QgsProject.instance().addMapLayer(duplicated_layer)

# Start an edit session
duplicated_layer.startEditing()

# Dictionary to store data by FID
fid_dict = {}

# Iterate over features in the duplicated layer
for feature in duplicated_layer.getFeatures():
    fid = feature['FID']
    pcbs_floor = feature['pcbs_floor']
    
    if fid not in fid_dict:
        # Initialize entry for this FID
        fid_dict[fid] = {
            'pcbs_floor_values': [],
            'feature_ids': [feature.id()]
        }
    else:
        # Add feature ID to list for potential deletion later
        fid_dict[fid]['feature_ids'].append(feature.id())
    
    # Add non-null pcbs_floor values to the list, cast to int if necessary
    if pcbs_floor is not None:
        # If pcbs_floor is a QVariant, extract its value first
        if isinstance(pcbs_floor, QVariant):
            pcbs_floor = pcbs_floor.value()
        
        # Ensure pcbs_floor is a Python integer
        if isinstance(pcbs_floor, int) or isinstance(pcbs_floor, float):
            fid_dict[fid]['pcbs_floor_values'].append(int(pcbs_floor))

# Iterate over the FID dictionary to update features
for fid, data in fid_dict.items():
    pcbs_floor_values = data['pcbs_floor_values']
    feature_ids = data['feature_ids']
    
    if len(feature_ids) > 1:
        if len(pcbs_floor_values) > 0:
            # Calculate the average
            average = sum(pcbs_floor_values) / len(pcbs_floor_values)
            
            # Round down if the decimal part is exactly 0.5, otherwise round normally
            if average % 1 == 0.5:
                avg_pcbs_floor = math.floor(average)
            else:
                avg_pcbs_floor = round(average)
        else:
            avg_pcbs_floor = None  # or set to 0 or another default value
        
        # Update the first feature with the average value
        first_feature = duplicated_layer.getFeature(feature_ids[0])
        duplicated_layer.changeAttributeValue(first_feature.id(), duplicated_layer.fields().indexFromName('pcbs_floor'), avg_pcbs_floor)
        
        # Delete all but the first feature
        duplicated_layer.deleteFeatures(feature_ids[1:])

# Commit changes to the duplicated layer
duplicated_layer.commitChanges()

# Rename the layer
duplicated_layer.setName("Final Collapsed Layer")

# Refresh the map view
iface.layerTreeView().refreshLayerSymbology(duplicated_layer.id())
