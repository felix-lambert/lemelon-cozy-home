// Generated by CoffeeScript 1.10.0
var AlarmManager, Event, RRule, cozydb, localization, log, moment, oneDay,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

cozydb = require('cozydb');

RRule = require('rrule').RRule;

moment = require('moment-timezone');

log = require('printit')({
  prefix: 'alarm-manager'
});

localization = require('./localization_manager');

Event = require('../models/event');

oneDay = 24 * 60 * 60 * 1000;

module.exports = AlarmManager = (function() {
  AlarmManager.prototype.dailytimer = null;

  AlarmManager.prototype.timeouts = {};

  function AlarmManager(options) {
    this.handleNotification = bind(this.handleNotification, this);
    this.handleAlarm = bind(this.handleAlarm, this);
    this.fetchAlarms = bind(this.fetchAlarms, this);
    this.timezone = options.timezone || 'UTC';
    this.notificationHelper = options.notificationHelper;
    this.fetchAlarms();
  }

  AlarmManager.prototype.fetchAlarms = function() {
    this.dailytimer = setTimeout(this.fetchAlarms, oneDay);
    return Event.all((function(_this) {
      return function(err, events) {
        var event, i, len, results;
        results = [];
        for (i = 0, len = events.length; i < len; i++) {
          event = events[i];
          results.push(_this.addEventCounters(event));
        }
        return results;
      };
    })(this));
  };

  AlarmManager.prototype.clearTimeouts = function(id) {
    var i, len, ref, timeout;
    if (this.timeouts[id] != null) {
      log.info("Remove notification " + id);
      ref = this.timeouts[id];
      for (i = 0, len = ref.length; i < len; i++) {
        timeout = ref[i];
        clearTimeout(timeout);
      }
      return delete this.timeouts[id];
    }
  };

  AlarmManager.prototype.handleAlarm = function(event, msg) {
    switch (event) {
      case "event.create":
      case "event.update":
        return Event.find(msg, (function(_this) {
          return function(err, event) {
            if (event != null) {
              return _this.addEventCounters(event);
            }
          };
        })(this));
      case "event.delete":
        return this.clearTimeouts(msg);
    }
  };

  AlarmManager.prototype.addEventCounters = function(event) {
    var cozyAlarm, cozyAlarms, i, len, results;
    if ((event.alarms != null) && event.alarms.length > 0) {
      cozyAlarms = event.getAlarms(this.timezone);
      results = [];
      for (i = 0, len = cozyAlarms.length; i < len; i++) {
        cozyAlarm = cozyAlarms[i];
        results.push(this.addAlarmCounters(cozyAlarm));
      }
      return results;
    }
  };

  AlarmManager.prototype.addAlarmCounters = function(alarm) {
    var base, delta, in24h, name, now, ref, timeout, timezone, triggerDate;
    this.clearTimeouts(alarm._id);
    timezone = alarm.timezone || this.timezone;
    triggerDate = moment.tz(alarm.trigg, 'UTC');
    triggerDate.tz(timezone);
    now = moment().tz(timezone);
    in24h = moment(now).add(1, 'days');
    if ((now.unix() <= (ref = triggerDate.unix()) && ref < in24h.unix())) {
      delta = triggerDate.valueOf() - now.valueOf();
      log.info("Notification in " + (delta / 1000) + " seconds.");
      if ((base = this.timeouts)[name = alarm._id] == null) {
        base[name] = [];
      }
      timeout = setTimeout(this.handleNotification.bind(this), delta, alarm);
      return this.timeouts[alarm._id].push(timeout);
    }
  };

  AlarmManager.prototype.handleNotification = function(alarm) {
    var agenda, contentKey, contentOptions, data, event, message, ref, ref1, ref2, resource, timezone, titleKey, titleOptions;
    if ((ref = alarm.action) === 'DISPLAY' || ref === 'BOTH') {
      resource = alarm.related != null ? alarm.related : {
        app: 'calendar',
        url: "/#list"
      };
      message = alarm.description || '';
      this.notificationHelper.createTemporary({
        text: localization.t('reminder message', {
          message: message
        }),
        resource: resource
      });
    }
    if ((ref1 = alarm.action) === 'EMAIL' || ref1 === 'BOTH') {
      if (alarm.event != null) {
        timezone = alarm.timezone || this.timezone;
        event = alarm.event;
        agenda = event.tags[0] || '';
        titleKey = 'reminder title email expanded';
        titleOptions = {
          description: event.description,
          date: event.start.format('llll'),
          calendarName: agenda
        };
        contentKey = 'reminder message expanded';
        contentOptions = {
          description: event.description,
          start: event.start.format('LLLL'),
          end: event.end.format('LLLL'),
          place: event.place,
          details: event.details,
          timezone: timezone
        };
        data = {
          from: 'Cozy Calendar <no-reply@cozycloud.cc>',
          subject: localization.t(titleKey, titleOptions),
          content: localization.t(contentKey, contentOptions)
        };
      } else {
        data = {
          from: "Cozy Calendar <no-reply@cozycloud.cc>",
          subject: localization.t('reminder title email'),
          content: localization.t('reminder message', {
            message: message
          })
        };
      }
      cozydb.api.sendMailToUser(data, function(error, response) {
        if (error != null) {
          return log.error("Error while sending email -- " + error);
        }
      });
    }
    if ((ref2 = alarm.action) !== 'EMAIL' && ref2 !== 'DISPLAY' && ref2 !== 'BOTH') {
      return log.error("UNKNOWN ACTION TYPE (" + alarm.action + ")");
    }
  };

  AlarmManager.prototype.iCalDurationToUnitValue = function(s) {
    var m, o;
    m = s.match(/(\d+)(W|D|H|M|S)/);
    o = {};
    o[m[2].toLowerCase()] = parseInt(m[1]);
    return o;
  };

  return AlarmManager;

})();