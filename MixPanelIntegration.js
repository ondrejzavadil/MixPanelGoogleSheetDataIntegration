function ImportMixPanelData() {
  /********************************************************************************
  * Mixpanel Segmentation Data Export
  *
  * Retrieves data from Mixpanel via the Data Export API Segmentation end point.
  * 
  * @author https://github.com/ondrejzavadil (Ondrej Zavadil)
  * 
  * For more information querying Mixpanel Data Export APIs see
  * https://mixpanel.com/docs/api-documentation/data-export-api
  * https://mixpanel.com/docs/api-documentation/exporting-raw-data-you-inserted-into-mixpanel
  *
  *********************************************************************************/
  
  /**
  * Step 1) Fill in your account's Mixpanel Information here
  */
  
  var API_SECRET = '';
  
  /**
  * Step 2) Define the sheetNames and funnel ID's of funnels you would like to get data from. you can add events from segmentation, that's optional
  * Each Sheet has list of funnels that will display on it. 
  * e.g. {sheetName:'Sheet 1', funnelIds [[1897269, 1897273], segmentationEvents: ['Landing Page Loaded'], sheetName:'Sheet 2', funnelIds [[1897269]} means Sheet 1 will have two funnels with 1,7 and 30 days convertion rations and event of Landing Page Loaded from yesterday
  */
  
  // Friendly names for segments
  var SIGN_UP = 'Sign Up';
  var UNIQUE_USERS = 'New session started';
  var NEW_VISITORS = 'Landing Page Loaded';
  var NEW_VISITORS_BRAND = '$custom_event:422472'; // High intent UTM w/ brand keywords
  var NEW_VISITORS_GENERAL = '$custom_event:422476'; // High intent UTM w/ loan purpose keywords
  
  var SHEETS = [{sheetName: 'SUMMARY', funnelIds: [1897269, 1897273, 1883201, 1863821, 1923839, 1878179, 1949129]},
                {sheetName: 'VISITORS', funnelIds: [2104254], segmentationEvents: [UNIQUE_USERS, NEW_VISITORS, NEW_VISITORS_BRAND, NEW_VISITORS_GENERAL]},
                {sheetName: 'SIGNUP', funnelIds: [], segmentationEvents: [SIGN_UP]},
                {sheetName: 'PREQUAL', funnelIds: [1856419]},
                {sheetName: 'FINDETAILS', funnelIds: [1863735, 1949129]},
                {sheetName: 'ROLLUP', funnelIds: [1940295, 1923839, 1892713, 1923841, 1923845, 1923847]},
                {sheetName: 'LOANACCEPT', funnelIds: [1853767, 1946745]},
                {sheetName: 'MISC', funnelIds: [2177478]}]
  /*
  *Step 4) Optional - define day you want report to be run for in 'yyyy-MM-dd' e.g. '2017-10-16'
  * If no date is selected, yesterdays's date will be used
  */
  var REPORT_DATE = '';
  
  /*
  * Iterates through funnels and calls each for 1, 7 and 30 days back. Add line in the google sheet to print out the results
  */
  function importMixPanelData() {
    var values = [];
    var reportDate = getReportDate();
    
    SHEETS.forEach(function(sheet, index){
      values = [];
      values.push(getMixpanelDate(reportDate));
      
      sheet.funnelIds.forEach(function(funnelId, index){
        var conversions1day = callFunnelApi(funnelId, getMixpanelDate(reportDate), getMixpanelDate(reportDate), 1);
        var conversions7day = callFunnelApi(funnelId, getMixpanelDateMinusWeek(reportDate), getMixpanelDate(reportDate), 7);
        var conversions30day = callFunnelApi(funnelId, getMixpanelDateMinusMonth(reportDate), getMixpanelDate(reportDate), 30);
        
        addValueToValues(values, conversions1day, conversions7day, conversions30day);
      });
      
      if (sheet.segmentationEvents) {
        sheet.segmentationEvents.forEach(function(event, index){
          var event1day = callSegmentationApi(event, getMixpanelDate(reportDate), getMixpanelDate(reportDate), 1);
          values.push(event1day);
        });
      }
      
      insertSheet(sheet.sheetName, values);
    });
  }
  
  /*
  * Helps format values to one line of google sheet. Goal is to format to : Funnel step 1 day 1, Funnel step 1 day 7, Funnel step 1 day 30, Funnel step 2 day 1 ....
  */
  function addValueToValues(values, conversions1day, conversions7day, conversions30day) {
    for (var i = 0; i < conversions1day.length; i++) {
        values.push(conversions1day[i]);
        values.push(conversions7day[i]);
        values.push(conversions30day[i]);
      }
  }

  /*
  * Prepares url for funnel mixpanel call
  */
  function callFunnelApi(funnelId, fromDate, toDate, interval) {
    var url = "https://mixpanel.com/api/2.0/funnels/?funnel_id="+funnelId+"&from_date="+fromDate+"&to_date="+toDate+"&interval="+interval;
    
    var dataAll = callApi(url);
    return extractConversionFromFunnel(dataAll);
  }
  
  /*
  * Prepares url for segmentation mixpanel call
  */
  function callSegmentationApi(event, fromDate, toDate, interval) {
    var url = "https://mixpanel.com/api/2.0/segmentation/?event="+event+"&from_date="+fromDate+"&to_date="+toDate+"&type=unique";
    
    var dataAll = callApi(url);
    return extractNumberFromSegmentation(dataAll);
  }
  
  /*
  * Calls mixpanel API. Set's authentication, calls api and parse the response to json
  */
  function callApi(url) {
    var headers = {
      "Authorization" : "Basic " + Utilities.base64Encode(API_SECRET)
    };
    
    var params = {
      "method":"GET",
      "headers":headers
    };

    var response = UrlFetchApp.fetch(url, params);
    var json = response.getContentText();
    return JSON.parse(json);
  }
  
  /*
  * Extracts relevant information from the api response getting conversion rates. This part is dependent to Mixpanel API
  * Reruns conversion rate in an array
  * Example data = [0.0074, 0.0072]
  */
  function extractConversionFromFunnel(dataAll) {
    var conversions = [];
    var steps = [];
    
    steps = dataAll.data[Object.keys(dataAll.data)[0]].steps;    //Get steps array from the first interval in the response. If there are multiple intervals, only 1st will be used 
    steps.shift();         //Always ignore 1st step. 1st step has always conversion 100% and is not relevant for our funnels
    for (var i = 0 ; i < steps.length; i++) {
      conversions.push(steps[i].step_conv_ratio);
    }
    
    return conversions;
  }
  
  /*
  * Extracts relevant information from the Mixpanel Segmentation api response getting numbers. This part is dependent to Mixpanel API
  * Reruns a single number
  * Example data = 1563
  */
  function extractNumberFromSegmentation(dataAll) {
    var event = dataAll.data.values[Object.keys(dataAll.data.values)[0]];      // Get object with Event and Series in it
    return eventNumber = event[Object.keys(event)[0]]     // Get the first series value - only 1 series should be ever present
  }
  
  function insertSheet(sheetName, values) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName) ||
      ss.insertSheet(sheetName, 0);
    
    sheet.appendRow(values);
  }
  
  /*
  * Date helpers
  */
  function getReportDate() {
    var today = new Date();
    var reportDate = new Date();
    reportDate.setDate(today.getDate() - 1);
    
    if (REPORT_DATE) {
      reportDate = new Date(REPORT_DATE);
    }
    
    return reportDate;
  }
  
  function getMixpanelDate(date) {    
    return toMixpanelFormat(date);
  }

  // Returns yesterday's's date string in Mixpanel date format '2013-09-11'
  function getMixpanelDateMinusOne(date) {
    var yesterday = new Date(date.getTime() - 1 * (24 * 60 * 60 * 1000));    //Creating date from time (-1 day) in miliseconds. Required because Report date is already moved back and month end needs move
    return toMixpanelFormat(yesterday);
  }
  
  function getMixpanelDateMinusWeek(date) {
    var dateMinusWeek = new Date(date.getTime() - 6 * (24 * 60 * 60 * 1000));
    return toMixpanelFormat(dateMinusWeek);
  }
  
  function getMixpanelDateMinusMonth(date) {
    var dateMinusMonth = new Date(date.getTime() - 29 * (24 * 60 * 60 * 1000))
    return toMixpanelFormat(dateMinusMonth);
  }
  
  function toMixpanelFormat(date) {
    var dd = toTwoDigits(date.getDate());
    var mm = toTwoDigits(date.getMonth() + 1);
    var yyyy = date.getFullYear();
    
    return yyyy + '-' + mm + '-' + dd
  }
  
  function toTwoDigits(dd) {
    if (dd < 10) {
      dd = '0' + dd;
    }
    return dd;
  }

  importMixPanelData();
}