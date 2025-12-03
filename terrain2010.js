// Load Landsat 5 imagery
var image = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2")
    .filterBounds(roi)
    .filterDate("2010-01-01", "2010-12-31")
    .filterMetadata('CLOUD_COVER', 'less_than', 5)
    .median()
    .clip(roi);
print(image, 'Landsat Image');
Map.centerObject(roi, 10);

// Visualization parameters for true color image
var visParamsTrue = {
    bands: ['SR_B3', 'SR_B2', 'SR_B1'], // Green, Red, Blue bands
    gamma: [1.5, 1.5, 1.0]
};
Map.addLayer(image, visParamsTrue, 'Landsat 2010');

// Merge the training data
var training = water.merge(open_space).merge(greenery).merge(built_up);
print(training, 'Training Data');

// Define the label and bands for classification
var label = 'class';
var bands = ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7']; // Include NIR and SWIR bands

// Sample regions to create training data
var trainImage = image.select(bands).sampleRegions({
    collection: training,
    properties: [label],
    scale: 30
});
print(trainImage, 'Training Image');

// Split the data into training and testing sets
var trainingData = trainImage.randomColumn();
var trainSet = trainingData.filter(ee.Filter.lessThan('random', 0.8));
var testSet = trainingData.filter(ee.Filter.greaterThanOrEquals('random', 0.8));

// Train the Random Forest classifier
var classifier = ee.Classifier.smileRandomForest(100).train(trainSet, label, bands);

// Classify the image
var classified = image.select(bands).classify(classifier);

// Define a palette for the classification
var landcoverPalette = [
    'blue',   // Water (1)
    'yellow', // Open space (2)
    'green',  // Greenery (3)
    'red'     // Built-up (4)
];

// Add the classified image to the map
Map.addLayer(classified.clip(roi), {palette: landcoverPalette, min: 1, max: 4}, 'Land Cover Classification');

// Accuracy Assessment
var classifiedTest = testSet.classify(classifier); // Use the classifier on the test set
var confusionMatrix = ee.ConfusionMatrix(classifiedTest.errorMatrix({
    actual: 'class',
    predicted: 'classification'
}));
print('Confusion Matrix:', confusionMatrix);
print('Overall Accuracy:', confusionMatrix.accuracy());
print('Kappa Statistic:', confusionMatrix.kappa());

// Calculate the number of pixels in each class
var classPixelCount = classified.reduceRegion({
    reducer: ee.Reducer.frequencyHistogram(),
    geometry: roi,
    scale: 30,
    maxPixels: 1e13
});
print('Class Pixel Count:', classPixelCount);

// Export the classified image to Google Drive
Export.image.toDrive({
    image: classified.clip(roi),
    description: '2010_Mysuru_RF_Classification', // Ensure this name is unique and valid
    folder: 'GEE',
    region: roi,
    crs: 'EPSG:32643',
    scale: 30,
    maxPixels: 1e13
});

// Set the map view to satellite
Map.setOptions('SATELLITE');

// Convert the dictionary to a list of [key, value] pairs for charting
classPixelCount.get('classification').evaluate(function(counts) {
    var classNames = [
        'Water',      // class 1
        'Open Space', // class 2
        'Greenery',   // class 3
        'Built Up'    // class 4
    ];
    var data = [];
    for (var key in counts) {
        if (counts.hasOwnProperty(key)) { // Check if the key is a property of counts
            data.push([classNames[parseInt(key) - 1], counts[key]]);
        }
    }
    var chart = ui.Chart.array.values({
        array: data.map(function(d) { return d[1]; }),
        axis: 0,
        xLabels: data.map(function(d) { return d[0]; })
    })
    .setChartType('PieChart')
    .setOptions({
        title: 'Land Cover Classification',
        slices: {
            0: {color: 'blue'},   // class 1
            1: {color: 'yellow'}, // class 2
            2: {color: 'green'},  // class 3
            3: {color: 'red'}     // class 4
        }
    });
    print(chart);
});