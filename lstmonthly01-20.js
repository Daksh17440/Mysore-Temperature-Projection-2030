// Define the region of interest
Map.addLayer(mysore);
Map.centerObject(mysore, 12);

// Define a function to calculate yearly monthly mean temperatures
function calculateYearlyMonthlyMean(year) {
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
      .set('system:time_start', ee.Date.fromYMD(year, month, 1));
  });
}

// Aggregate all years for each period into separate collections
var years2001_2010 = ee.List.sequence(2001, 2010);
var years2011_2020 = ee.List.sequence(2011, 2020);

var monthlyMeans2001_2010 = ee.ImageCollection.fromImages(
  years2001_2010.map(function(y) { return calculateYearlyMonthlyMean(y); }).flatten()
);

var monthlyMeans2011_2020 = ee.ImageCollection.fromImages(
  years2011_2020.map(function(y) { return calculateYearlyMonthlyMean(y); }).flatten()
);

// Generate the chart for 2001–2010
var monthlyMeanChart1 = ui.Chart.image.seriesByRegion({
  imageCollection: monthlyMeans2001_2010,
  regions: mysore,
  reducer: ee.Reducer.mean(),
  band: 'LST_Day_1km',
  scale: 1000,
  xProperty: 'system:time_start',
  seriesProperty: 'year'
}).setOptions({
  title: 'Monthly Mean Land Surface Temperature (2001-2010)',
  hAxis: { title: 'Time (Months)' },
  vAxis: { title: 'Temperature (°C)' },
  lineWidth: 1,
  pointSize: 3
});

// Generate the chart for 2011–2020
var monthlyMeanChart2 = ui.Chart.image.seriesByRegion({
  imageCollection: monthlyMeans2011_2020,
  regions: mysore,
  reducer: ee.Reducer.mean(),
  band: 'LST_Day_1km',
  scale: 1000,
  xProperty: 'system:time_start',
  seriesProperty: 'year'
}).setOptions({
  title: 'Monthly Mean Land Surface Temperature (2011-2020)',
  hAxis: { title: 'Time (Months)' },
  vAxis: { title: 'Temperature (°C)' },
  lineWidth: 1,
  pointSize: 3
});

// Print both charts
print(monthlyMeanChart1);
print(monthlyMeanChart2);