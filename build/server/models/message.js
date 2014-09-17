// Generated by CoffeeScript 1.7.1
var GUID, Message, Promise, americano, mailutils;

americano = require('americano-cozy');

mailutils = require('../utils/jwz_tools');

GUID = require('guid');

Promise = require('bluebird');

module.exports = Message = americano.getModel('Message', {
  accountID: String,
  messageID: String,
  normSubject: String,
  conversationID: String,
  mailboxIDs: function(x) {
    return x;
  },
  headers: function(x) {
    return x;
  },
  from: function(x) {
    return x;
  },
  to: function(x) {
    return x;
  },
  cc: function(x) {
    return x;
  },
  bcc: function(x) {
    return x;
  },
  replyTo: function(x) {
    return x;
  },
  subject: String,
  inReplyTo: function(x) {
    return x;
  },
  references: function(x) {
    return x;
  },
  text: String,
  html: String,
  date: Date,
  priority: String,
  attachments: function(x) {
    return x;
  }
});

Message.getByMailboxAndDate = function(mailboxID, params) {
  var options;
  options = {
    startkey: [mailboxID, {}],
    endkey: [mailboxID],
    include_docs: true,
    descending: true,
    reduce: false
  };
  if (params) {
    if (params.numByPage) {
      options.limit = params.numByPage;
    }
    if (params.numPage) {
      options.skip = params.numByPage * params.numPage;
    }
  }
  return Message.rawRequestPromised('byMailboxAndDate', options).map(function(row) {
    return new Message(row.doc);
  });
};

Message.countByMailbox = function(mailboxID) {
  return Message.rawRequestPromised('byMailboxAndDate', {
    startkey: [mailboxID],
    endkey: [mailboxID, {}],
    reduce: true,
    group_level: 1
  }).then(function(result) {
    var _ref;
    return {
      count: ((_ref = result[0]) != null ? _ref.value : void 0) || 0
    };
  });
};

Message.getUIDs = function(mailboxID) {
  return Message.rawRequestPromised('byMailboxAndDate', {
    startkey: [mailboxID],
    endkey: [mailboxID, {}],
    reduce: false
  }).map(function(row) {
    return row.value;
  });
};

Message.byMessageId = function(accountID, messageID) {
  return Message.rawRequestPromised('byMessageId', {
    key: [accountID, messageID],
    include_docs: true
  }).then(function(rows) {
    var data, _ref;
    if (data = (_ref = rows[0]) != null ? _ref.doc : void 0) {
      return new Message(data);
    }
  });
};

Message.prototype.addToMailbox = function(box, uid) {
  this.mailboxIDs[box.id] = uid;
  return this.savePromised();
};

Message.createFromImapMessage = function(mail, box, uid) {
  var attachments, messageID;
  mail.accountID = box.accountID;
  mail.mailboxIDs = {};
  mail.mailboxIDs[box._id] = uid;
  messageID = mail.headers['message-id'];
  mail.messageID = mailutils.normalizeMessageID(messageID);
  mail.normSubject = mailutils.normalizeSubject(mail.subject);
  mail.replyTo = [];
  if (mail.cc == null) {
    mail.cc = [];
  }
  if (mail.bcc == null) {
    mail.bcc = [];
  }
  if (mail.to == null) {
    mail.to = [];
  }
  if (mail.from == null) {
    mail.from = [];
  }
  attachments = [];
  if (mail.attachments) {
    attachments = mail.attachments.map(function(att) {
      var buffer, out;
      buffer = att.content;
      delete att.content;
      return out = {
        name: att.generatedFileName,
        buffer: buffer
      };
    });
  }
  return Promise.resolve(mail['x-gm-thrid'] || Message.findConversationIdByMessageIds(mail) || Message.findConversationIdBySubject(mail)).then(function(conversationID) {
    mail.conversationID = conversationID;
    return Message.createPromised(mail);
  }).then(function(jdbMessage) {
    return Promise.serie(attachments, function(att) {
      if (att.buffer == null) {
        att.buffer = new Buffer(0);
      }
      att.buffer.path = encodeURI(att.name);
      return jdbMessage.attachBinaryPromised(att.buffer, {
        name: encodeURI(att.name)
      });
    });
  });
};

Message.findConversationIdByMessageIds = function(mail) {
  var references;
  references = mail.references || [];
  references.concat(mail.inReplyTo || []);
  references = references.map(mailutils.normalizeMessageID).filter(function(mid) {
    return mid;
  });
  if (!references.length) {
    return null;
  }
  return Message.rawRequestPromised('byMessageId', {
    keys: messageIds.map(function(id) {
      return [mail.accountID, id];
    }),
    reduce: true
  }).then(Message.pickConversationID);
};

Message.findConversationIdBySubject = function(mail) {
  var _ref;
  if (!(((_ref = mail.normSubject) != null ? _ref.length : void 0) > 3)) {
    return null;
  }
  return Message.rawRequestPromised('byNormSubject', {
    key: [mail.accountID, mail.normSubject]
  }).then(Message.pickConversationID);
};

Message.pickConversationID = function(rows) {
  var change, conversationID, conversationIDCounts, count, pickedConversationID, pickedConversationIDCount;
  conversationIDCounts = {};
  rows.forEach(function(result, row) {
    var _name;
    if (conversationIDCounts[_name = row.value] == null) {
      conversationIDCounts[_name] = 1;
    }
    return conversationIDCounts[row.value]++;
  });
  pickedConversationID = null;
  pickedConversationIDCount = 0;
  for (conversationID in conversationIDCounts) {
    count = conversationIDCounts[conversationID];
    if (count > pickedConversationIDCount) {
      pickedConversationID = conversationID;
      pickedConversationIDCount = count;
    }
  }
  if (!((pickedConversationID != null) && pickedConversationID !== 'undefined')) {
    pickedConversationID = GUID.raw();
  }
  change = {
    conversationID: pickedConversationID
  };
  return Promise.serie(rows, function(row) {
    return Message.findPromised(row.id).then(function(message) {
      if (message.conversationID !== pickedConversationID) {
        return message.updateAttributesPromised(change);
      }
    });
  })["return"](pickedConversationID);
};

Promise.promisifyAll(Message, {
  suffix: 'Promised'
});

Promise.promisifyAll(Message.prototype, {
  suffix: 'Promised'
});
