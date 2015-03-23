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
  var BasicAuth = spore.middlewares.basic(config.username, config.password)
  var status = spore.createClient(BasicAuth, {
    "base_url" : config.endpoint,
    "methods" : {
      "sendEvent" : {
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
          return "error"
        },
        up: function(check, checkEvent) {
          return "ok"
      }
    }
    //we should react only on up and down message, and only if check has a status id provided
    var riemannServiceId = check.getPollerParam('riemannServiceId');
    if (checkEvent.message=="up" || checkEvent.message=="down" && statusId){
      var statusChange = componentStatusHandler[checkEvent.message](check, checkEvent);
      // Send Status
      console.log('Send Riemann alert');
      var payload = '{';
        payload += '"host": "web3", "service": "uptime",';
        payload += '"state": "' + statusChange + '",';
        payload += '"description": "UPTIME: Service offline",}';
      status.sendEvent(payload, function(err, result) {
        if(result != null && result.status == "200") {
          console.log('Riemann: service status changed');
        } else {
          console.error('Riemann: error sending riemann message. \nResponse: ' + JSON.stringify(result));
        }
      });
    }
		});
	});

	console.log('Enabled Riemann notifications');
};
