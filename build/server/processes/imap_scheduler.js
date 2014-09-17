// Generated by CoffeeScript 1.7.1
var ImapPromised, ImapScheduler, Promise,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

ImapPromised = require('./imap_promisified');

Promise = require('bluebird');

module.exports = ImapScheduler = (function() {
  ImapScheduler.instances = {};

  ImapScheduler.instanceFor = function(account) {
    var _base, _name;
    if ((_base = this.instances)[_name = account.imapServer] == null) {
      _base[_name] = new ImapScheduler(account);
    }
    return this.instances[account.imapServer];
  };

  ImapScheduler.summary = function() {
    var instance, out, server, _ref;
    out = {};
    _ref = this.instances;
    for (server in _ref) {
      instance = _ref[server];
      out[server] = instance.tasks;
    }
    return out;
  };

  ImapScheduler.prototype.tasks = [];

  ImapScheduler.prototype.pendingTask = null;

  function ImapScheduler(account) {
    var Account;
    this.account = account;
    this._dequeue = __bind(this._dequeue, this);
    this._rejectPending = __bind(this._rejectPending, this);
    this._resolvePending = __bind(this._resolvePending, this);
    this.closeConnection = __bind(this.closeConnection, this);
    Account = require('../models/account');
    if (!(this.account instanceof Account)) {
      this.account = new Account(this.account);
    }
  }

  ImapScheduler.prototype.createNewConnection = function() {
    console.log("OPEN IMAP CONNECTION", this.account.label);
    this.imap = new ImapPromised({
      user: this.account.login,
      password: this.account.password,
      host: this.account.imapServer,
      port: parseInt(this.account.imapPort),
      tls: (this.account.imapSecure == null) || this.account.imapSecure,
      tlsOptions: {
        rejectUnauthorized: false
      }
    });
    this.imap.onTerminated = (function(_this) {
      return function() {
        _this._rejectPending(new Error('connection closed'));
        return _this.closeConnection();
      };
    })(this);
    return this.imap.waitConnected["catch"]((function(_this) {
      return function(err) {
        var task;
        console.log("FAILED TO CONNECT", err.stack);
        while (task = _this.tasks.shift()) {
          task.reject(err);
        }
        throw err;
      };
    })(this)).tap((function(_this) {
      return function() {
        return _this._dequeue();
      };
    })(this));
  };

  ImapScheduler.prototype.closeConnection = function(hard) {
    console.log("CLOSING CONNECTION");
    return this.imap.end(hard).then((function(_this) {
      return function() {
        console.log("CLOSED CONNECTION");
        _this.imap = null;
        return _this._dequeue();
      };
    })(this));
  };

  ImapScheduler.prototype.doASAP = function(gen) {
    return this.queue(gen, true);
  };

  ImapScheduler.prototype.doLater = function(gen) {
    return this.queue(gen, false);
  };

  ImapScheduler.prototype.queue = function(gen, urgent) {
    if (urgent == null) {
      urgent = false;
    }
    return new Promise((function(_this) {
      return function(resolve, reject) {
        var fn;
        fn = urgent ? 'unshift' : 'push';
        _this.tasks[fn]({
          attempts: 0,
          generator: gen,
          resolve: resolve,
          reject: reject
        });
        return _this._dequeue();
      };
    })(this));
  };

  ImapScheduler.prototype._resolvePending = function(result) {
    this.pendingTask.resolve(result);
    this.pendingTask = null;
    return setTimeout(this._dequeue, 1);
  };

  ImapScheduler.prototype._rejectPending = function(err) {
    this.pendingTask.reject(err);
    this.pendingTask = null;
    return setTimeout(this._dequeue, 1);
  };

  ImapScheduler.prototype._dequeue = function() {
    var moreTasks, _ref, _ref1, _ref2;
    if (this.pendingTask) {
      return false;
    }
    if ((_ref = this.imap) != null ? _ref.waitConnected.isPending() : void 0) {
      return false;
    }
    if ((_ref1 = this.imap) != null ? (_ref2 = _ref1.waitEnding) != null ? _ref2.isPending() : void 0 : void 0) {
      return false;
    }
    moreTasks = this.tasks.length !== 0;
    if (!moreTasks && !this.imap) {
      return false;
    }
    if (this.imap && !moreTasks) {
      this.closeConnection();
      return false;
    }
    if (moreTasks && !this.imap) {
      this.createNewConnection();
      return false;
    }
    this.pendingTask = this.tasks.shift();
    return Promise.resolve(this.pendingTask.generator(this.imap)).timeout(60000)["catch"](Promise.TimeoutError, (function(_this) {
      return function(err) {
        _this.closeConnection(true);
        throw err;
      };
    })(this)).then(this._resolvePending, this._rejectPending);
  };

  return ImapScheduler;

})();

Promise.serie = function(items, mapper) {
  return Promise.map(items, mapper, {
    concurrency: 1
  });
};
