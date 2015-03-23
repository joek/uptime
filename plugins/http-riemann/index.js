/**
 * Http-Riemann plugin for the uptime project - https://github.com/fzaninotto/uptime
 * *
 * This index.js file goes to a directory `plugins/http-riemann` in your installation of uptime.
 *
 * Notifies all events (up, down) to Riemann through http-riemann gateway.
 *
 * To enable the plugin, add the following line to the plugins section of your config default.yml file
 * plugins:
 *  - ./plugins/http-riemann
 *
 * Example configuration:
 *
 *   http-riemann:
 *     endpoint: https://<user>:<password>@<http-riemann host>/
 *
 */
var CheckEvent = require('../../models/checkEvent');
var spore = require('spore');
var fs         = require('fs');
var ejs        = require('ejs');

var template = fs.readFileSync(__dirname + '/views/_detailsEdit.ejs', 'utf8');


exports.initWebApp = function(options) {

  var config = options.config.statuspage;
  var status = spore.createClient({
    "base_url" : config.endpoint,
    "methods" : {
      "event" : {
        "path" : "/",
        "method" : "POST",
      }
    }
  });

  var dashboard = options.dashboard;
  //responsible for persistance
  dashboard.on('populateFromDirtyCheck', function(checkDocument, dirtyCheck, type) {
    checkDocument.setPollerParam('riemannServiceId', dirtyCheck.riemannServiceId);
  });

  //responsible to display check edit page with our view and a proper value
  dashboard.on('checkEdit', function(type, check, partial) {
    check.setPollerParam('riemannServiceId', check.getPollerParam('riemannServiceId'));
    partial.push(ejs.render(template, { locals: { check: check } }));
  });

	CheckEvent.on('afterInsert', function (checkEvent) {
		checkEvent.findCheck(function (err, check) {
      componentStatusHandler = {
        down: function(check, checkEvent) {
          return "component[status]=major_outage"
        },
        up: function(check, checkEvent) {
          return "component[status]="
      }
    }
    //we should react only on up and down message, and only if check has a status id provided
    var statusId = check.getPollerParam('statusPageId');
    if (checkEvent.message=="up" || checkEvent.message=="down" && statusId){
      var statusChange = componentStatusHandler[checkEvent.message](check, checkEvent);
      status.availability({
          serviceId: statusId
      }, statusChange,
      function(err, result) {
        if(result != null && result.status == "200") {
          console.log('StatusPage: service status changed');
        } else {
          console.error('StatusPage: error changing service status. \nResponse: ' + JSON.stringify(result));
        }
      });
    }
		});
	});

	console.log('Enabled StatusPage notifications');
};
