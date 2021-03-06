// Generated by CoffeeScript 1.10.0
var CONCURRENT_DESTROY, ERRORMSG, LIMIT_UPDATE, MAX_RETRIES, Message, Process, RemoveAllMessagesFromMailbox, async, log, ref,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

ERRORMSG = "DS has crashed ? waiting 4s before try again";

ref = require('../utils/constants'), MAX_RETRIES = ref.MAX_RETRIES, CONCURRENT_DESTROY = ref.CONCURRENT_DESTROY, LIMIT_UPDATE = ref.LIMIT_UPDATE;

Process = require('./_base');

async = require('async');

Message = require('../models/message');

log = require('../utils/logging')('process:removebymailbox');

module.exports = RemoveAllMessagesFromMailbox = (function(superClass) {
  extend(RemoveAllMessagesFromMailbox, superClass);

  function RemoveAllMessagesFromMailbox() {
    this.destroyMessages = bind(this.destroyMessages, this);
    this.shouldDestroy = bind(this.shouldDestroy, this);
    this.fetchMessages = bind(this.fetchMessages, this);
    this.step = bind(this.step, this);
    this.notFinished = bind(this.notFinished, this);
    return RemoveAllMessagesFromMailbox.__super__.constructor.apply(this, arguments);
  }

  RemoveAllMessagesFromMailbox.prototype.code = 'remove-all-from-box';

  RemoveAllMessagesFromMailbox.prototype.initialize = function(options, callback) {
    this.mailboxID = options.mailboxID;
    this.toDestroyMailboxIDs = options.toDestroyMailboxIDs || [];
    this.retries = MAX_RETRIES;
    this.batch;
    return async.doWhilst(this.step, this.notFinished, callback);
  };

  RemoveAllMessagesFromMailbox.prototype.notFinished = function() {
    return this.batch.length > 0;
  };

  RemoveAllMessagesFromMailbox.prototype.step = function(callback) {
    return this.fetchMessages((function(_this) {
      return function(err) {
        if (err) {
          return callback(err);
        }
        if (_this.batch.length === 0) {
          return callback(null);
        }
        return _this.destroyMessages(function(err) {
          if (err && _this.retries > 0) {
            log.warn(ERRORMSG, err);
            _this.retries--;
            return setTimeout(callback, 4000);
          } else if (err) {
            return callback(err);
          } else {
            _this.retries = MAX_RETRIES;
            return callback(null);
          }
        });
      };
    })(this));
  };

  RemoveAllMessagesFromMailbox.prototype.fetchMessages = function(callback) {
    return Message.rawRequest('byMailboxRequest', {
      limit: LIMIT_UPDATE,
      startkey: ['uid', this.mailboxID, -1],
      endkey: ['uid', this.mailboxID, {}],
      include_docs: true,
      reduce: false
    }, (function(_this) {
      return function(err, rows) {
        if (err) {
          return callback(err);
        }
        _this.batch = rows.map(function(row) {
          return new Message(row.doc);
        });
        return callback(null);
      };
    })(this));
  };

  RemoveAllMessagesFromMailbox.prototype.shouldDestroy = function(message) {
    var boxID, ref1, uid;
    ref1 = message.mailboxIDs;
    for (boxID in ref1) {
      uid = ref1[boxID];
      if (indexOf.call(this.toDestroyMailboxIDs, boxID) < 0) {
        return false;
      }
    }
    return true;
  };

  RemoveAllMessagesFromMailbox.prototype.destroyMessages = function(callback) {
    return async.eachLimit(this.batch, CONCURRENT_DESTROY, (function(_this) {
      return function(message, cb) {
        if (_this.shouldDestroy(message)) {
          return message.destroy(function(err) {
            return cb(null);
          });
        } else {
          return message.removeFromMailbox({
            id: _this.mailboxID
          }, false, function(err) {
            return cb(null);
          });
        }
      };
    })(this), callback);
  };

  return RemoveAllMessagesFromMailbox;

})(Process);
