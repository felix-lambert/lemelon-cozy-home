// Generated by CoffeeScript 1.10.0
var Album, async, cache, clearance, clearanceCtl, cozydb, getDisplayName, localizationManager;

async = require('async');

clearance = require('cozy-clearance');

cozydb = require('cozydb');

Album = require('../models/album');

localizationManager = require('../helpers/localization_manager');

getDisplayName = function(callback) {
  return cozydb.api.getCozyUser(function(err, user) {
    if ((user != null ? user.public_name : void 0) && user.public_name.length > 0) {
      return callback(null, user.public_name);
    } else {
      return localizationManager.ensureReady(function(err) {
        return callback(null, localizationManager.t('default user name'));
      });
    }
  });
};

clearanceCtl = clearance.controller({
  mailTemplate: function(options, callback) {
    return getDisplayName(function(err, displayName) {
      options.displayName = displayName;
      return localizationManager.render('sharemail', options, callback);
    });
  },
  mailSubject: function(options, callback) {
    return getDisplayName(function(err, displayName) {
      return callback(null, localizationManager.t('email sharing subject', {
        displayName: displayName,
        name: options.doc.title
      }));
    });
  }
});

module.exports.fetch = function(req, res, next, id) {
  return Album.find(id, function(err, album) {
    if (album) {
      req.doc = album;
      return next();
    } else {
      err = new Error('bad usage');
      err.status = 400;
      return next(err);
    }
  });
};

module.exports.markPublicRequests = function(req, res, next) {
  if (req.url.match(/^\/public/)) {
    req["public"] = true;
  }
  return next();
};

module.exports.checkPermissions = function(album, req, callback) {
  if (!req["public"]) {
    return callback(null, true);
  }
  if (album.clearance === 'hidden') {
    album.clearance = 'public';
  }
  if (album.clearance === 'private') {
    album.clearance = [];
  }
  return clearance.check(album, 'r', req, callback);
};

cache = {};

module.exports.checkPermissionsPhoto = function(photo, perm, req, callback) {
  var albumid, incache;
  if (!req["public"]) {
    return callback(null, true);
  }
  albumid = photo.albumid;
  incache = cache[albumid];
  if (incache) {
    return clearance.check({
      clearance: incache
    }, perm, req, callback);
  } else {
    return Album.find(albumid, function(err, album) {
      if (err || !album) {
        return callback(null, false);
      }
      if (album.clearance === 'hidden') {
        album.clearance = 'public';
      }
      if (album.clearance === 'private') {
        album.clearance = [];
      }
      cache[albumid] = album.clearance;
      return clearance.check(album, perm, req, callback);
    });
  }
};

module.exports.change = function(req, res, next) {
  cache[req.params.shareid] = null;
  return clearanceCtl.change(req, res, next);
};

module.exports.sendAll = clearanceCtl.sendAll;

module.exports.contactList = clearanceCtl.contactList;

module.exports.contact = clearanceCtl.contact;

module.exports.contactPicture = clearanceCtl.contactPicture;