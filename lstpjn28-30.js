// Define the region of interest
Map.addLayer(mysore);
Map.centerObject(mysore, 12);

// Define a function to calculate monthly means for a given year
function calculateMonthlyMeans(year) {
  var modis = ee.ImageCollection("MODIS/061/MOD11A1")
    .filterDate(ee.Date.fromYMD(year, 1, 1), ee.Date.fromYMD(year, 12, 31))
    .select('LST_Day_1km');

  // Convert from Kelvin to Celsius
  var modcel = modis.map(function(img) {
    return img.multiply(0.02).subtract(273.15)
      .copyProperties(img, ['system:time_start']);
  });

  // Calculate monthly mean temperatures
  return ee.List.sequence(1, 12).map(function(month) {
    var monthlyMean = modcel.filter(ee.Filter.calendarRange(month, month, 'month')).mean();
    return monthlyMean.set('month', month).set('year', year)
      .set('system:time_start', ee.Date.fromYMD(year, month, 1).millis()); // Convert date to milliseconds
  });
}

// Aggregate all years for each period into a single collection
var years2001_2020 = ee.List.sequence(2001, 2020);
var allMonthlyMeans = ee.ImageCollection.fromImages(
  years2001_2020.map(function(y) { return ee.ImageCollection(calculateMonthlyMeans(y)).toList(12); }).flatten()
);

// Add a time band as a numerical timestamp in years since 2000
var addTimeBand = function(image) {
  // Convert time to years since 2000 as an Image and cast to float
  var timeInYears = ee.Image(ee.Number(image.get('system:time_start')).subtract(ee.Date.fromYMD(2000, 1, 1).millis())
    .divide(1000 * 60 * 60 * 24 * 365))
    .rename('time')
    .toFloat(); // Explicitly cast to float
  return image.addBands(timeInYears);
};

// Apply the time band to the combined collection
var allMonthlyMeansWithTime = allMonthlyMeans.map(addTimeBand);

// Calculate monthly trends using linear regression for each month
var monthlyTrends = ee.ImageCollection.fromImages(
  ee.List.sequence(1, 12).map(function(month) {
    var monthlyImages = allMonthlyMeansWithTime.filter(ee.Filter.eq('month', month));
    var monthlyTrend = monthlyImages.select(['time', 'LST_Day_1km']).reduce(ee.Reducer.linearFit());
    return monthlyTrend.select('scale').rename('slope').set('month', month);
  })
);

// Forecast temperatures for 2028, 2029, and 2030 based on the monthly trends
var projectionYears = [2028, 2029, 2030];
var monthlyProjections = ee.ImageCollection.fromImages(
  ee.List(projectionYears).map(function(year) {
    return ee.List.sequence(1, 12).map(function(month) {
      // Get the historical monthly mean for the last year (2020) and apply the monthly trend
      var baseMean = allMonthlyMeans.filter(ee.Filter.and(
        ee.Filter.eq('year', 2020),
        ee.Filter.eq('month', month)
      )).first();
      
      var slope = monthlyTrends.filter(ee.Filter.eq('month', month)).first().select('slope');
      var yearsAhead = ee.Image(ee.Number(year).subtract(2020)).toFloat(); // Cast to float for consistency
      var projectedTemp = baseMean.add(slope.multiply(yearsAhead));
      
      return projectedTemp.set('month', month).set('year', year)
        .set('system:time_start', ee.Date.fromYMD(year, month, 1).millis());
    });
  }).flatten()
);

// Generate the chart for the projections (2028–2030)
var monthlyProjectionChart = ui.Chart.image.seriesByRegion({
  imageCollection: monthlyProjections,
  regions: mysore,
  reducer: ee.Reducer.mean(),
  band: 'LST_Day_1km',
  scale: 1000,
  xProperty: 'system:time_start',
  seriesProperty: 'year'
}).setOptions({
  title: 'Projected Monthly Mean Land Surface Temperature (2028-2030)',
  hAxis: { title: 'Time (Months)' },
  vAxis: { title: 'Temperature (°C)' },
  lineWidth: 1,
  pointSize: 3
});

// Print projection chart
print(monthlyProjectionChart);