var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var charLim = require('../support/charLimiter');
var Debug = require('debug');
var debug = Debug('FacebookBot');
var collection = require('../dialogs/DialogCollection');
var session = require('../Session');
var memory = require('../storage/Storage');
var dynamoDb = require('../storage/DynamoDBStorage');
var botService = require('./FacebookBotService');
var consts = require('../consts');
var FacebookBot = (function (_super) {
    __extends(FacebookBot, _super);
    function FacebookBot(options) {
        var _this = this;
        _super.call(this);
        this.options = {
            maxSessionAge: 14400000,
            defaultDialogId: '/',
            minSendDelay: 1000,
        };
        this.configure(options);
        this.botService = new botService.FacebookBotService(options.page_token, options.validation_token);
        var events = 'message|message_deliveries|messaging_optins|messaging_postbacks'.split('|');
        events.forEach(function (value) {
            _this.botService.on(value, function (message) {
                debug('bot message', JSON.stringify(message));
                _this.handleEvent(value, message);
            });
        });
    }
    FacebookBot.prototype.configure = function (options) {
        if (options) {
            for (var key in options) {
                if (options.hasOwnProperty(key)) {
                    this.options[key] = options[key];
                }
            }
        }
    };
    FacebookBot.prototype.beginDialog = function (address, dialogId, dialogArgs) {
        if (!address.to) {
            throw new Error('Invalid address passed to FacebookBot.beginDialog().');
        }
        if (!this.hasDialog(dialogId)) {
            throw new Error('Invalid dialog passed to FacebookBot.beginDialog().');
        }
        this.dispatchMessage(this.toFacebookMessage(address), dialogId, dialogArgs);
    };
    FacebookBot.prototype.handleEvent = function (event, data) {
        var _this = this;
        var onError = function (err) {
            _this.emit('error', err, data);
        };
        switch (event) {
            case 'message':
                this.dispatchMessage(data, this.options.defaultDialogId, this.options.defaultDialogArgs);
                break;
        }
    };
    FacebookBot.prototype.dispatchMessage = function (message, dialogId, dialogArgs) {
        var _this = this;
        var onError = function (err) {
            _this.emit('error', err, message);
        };
        var ses = new FacebookSession({
            localizer: this.options.localizer,
            minSendDelay: this.options.minSendDelay,
            dialogs: this,
            dialogId: dialogId,
            dialogArgs: dialogArgs
        });
       ses.on('send', function (reply) {
            _this.saveData(msg.from.address, ses.userData, ses.sessionState, function () {
                if (reply) {
                  charLim(reply, function(results){
                    if (results){
                      for (segment in results) {
                        var facebookReply = _this.toFacebookMessage(results[segment]);
                        facebookReply.to = ses.message.to.address;
                        _this.botService.send(facebookReply.to, facebookReply.content, onError);
                      }
                    }
                  });
                }
            });
        });
        ses.on('error', function (err) {
            _this.emit('error', err, message);
        });
        ses.on('quit', function () {
            _this.emit('quit', message);
        });
        var msg = this.fromFacebookMessage(message);
        this.getData(msg.from.address, function (userData, sessionState) {
            ses.userData = userData || {};
            ses.dispatch(sessionState, msg);
        });
    };
    FacebookBot.prototype.getData = function (userId, callback) {
        var _this = this;
        if (!this.options.userStore) {
            if (this.options.storage && this.options.storage.provider === consts.StorageProviders.DynamoDb) {
                this.options.userStore = new dynamoDb.DynamoDBStorage(consts.StorageTypes.User, this.options.storage);
            }
            else {
                this.options.userStore = new memory.MemoryStorage();
            }
        }
        if (!this.options.sessionStore) {
            if (this.options.storage && this.options.storage.provider === consts.StorageProviders.DynamoDb) {
                this.options.sessionStore = new dynamoDb.DynamoDBStorage(consts.StorageTypes.Session, this.options.storage);
            }
            else {
                this.options.sessionStore = new memory.MemoryStorage();
            }
        }
        var ops = 2;
        var userData, sessionState;
        this.options.userStore.get(userId, function (err, data) {
            if (!err) {
                userData = data;
                if (--ops == 0) {
                    callback(userData, sessionState);
                }
            }
            else {
                _this.emit('error', err);
            }
        });
        this.options.sessionStore.get(userId, function (err, data) {
            if (!err) {
                if (data && (new Date().getTime() - data.lastAccess) < _this.options.maxSessionAge) {
                    sessionState = data;
                }
                if (--ops == 0) {
                    callback(userData, sessionState);
                }
            }
            else {
                _this.emit('error', err);
            }
        });
    };
    FacebookBot.prototype.saveData = function (userId, userData, sessionState, callback) {
        var ops = 2;
        function onComplete(err) {
            if (!err) {
                if (--ops == 0) {
                    callback(null);
                }
            }
            else {
                callback(err);
            }
        }
        this.options.userStore.save(userId, userData, onComplete);
        this.options.sessionStore.save(userId, sessionState, onComplete);
    };
    FacebookBot.prototype.fromFacebookMessage = function (msg) {
        return {
            type: msg.type,
            id: msg.messageId ? msg.messageId.toString() : '',
            from: {
                channelId: 'facebook',
                address: msg.from
            },
            to: {
                channelId: 'facebook',
                address: msg.to
            },
            text: msg.text,
            channelData: msg
        };
    };
    FacebookBot.prototype.toMessageContent = function (msg) {
        if (!msg) {
            return;
        }
        var content = {
            text: msg.text
        };
        if (msg.attachments && msg.attachments.length > 0) {
            if (msg.attachments[0].contentType) {
                var attachment = msg.attachments[0];
                content = {
                    attachment: {
                        type: 'image',
                        payload: {
                            url: attachment.contentUrl
                        }
                    }
                };
            }
            else if (msg.attachments[0].thumbnailUrl) {
                var elements = [];
                msg.attachments.forEach(function (attachment) {
                    var buttons = [];
                    if (attachment.actions) {
                        attachment.actions.forEach(function (action) {
                            var button = {};
                            button.title = action.title;
                            if (action.url) {
                                button.type = 'web_url';
                                button.url = action.url;
                            }
                            else {
                                button.type = 'postback';
                                button.payload = action.message;
                            }
                            buttons.push(button);
                        });
                    }
                    var element = {
                        title: attachment.title,
                        image_url: attachment.thumbnailUrl,
                        subtitle: attachment.text,
                    };
                    if (buttons.length > 0) {
                        element.buttons = buttons;
                    }
                    elements.push(element);
                });
                content = {
                    attachment: {
                        type: 'template',
                        payload: {
                            template_type: 'generic',
                            elements: elements
                        }
                    }
                };
            }
            else if (msg.attachments[0].actions && msg.attachments[0].actions.length > 0) {
                var attachment = msg.attachments[0];
                var buttons = [];
                attachment.actions.forEach(function (action) {
                    buttons.push({
                        type: 'postback',
                        payload: action.message,
                        title: action.title
                    });
                });
                content = {
                    attachment: {
                        type: 'template',
                        payload: {
                            template_type: 'button',
                            text: msg.text || attachment.text,
                            buttons: buttons
                        }
                    }
                };
            }
        }
        return content;
    };
    FacebookBot.prototype.toFacebookMessage = function (msg) {
        return {
            type: msg.type,
            from: msg.from ? msg.from.address : '',
            to: msg.to ? msg.to.address : '',
            content: this.toMessageContent(msg),
            messageId: msg.id ? Number(msg.id) : Number.NaN,
            contentType: "RichText",
            eventTime: msg.channelData ? msg.channelData.eventTime : new Date().getTime()
        };
    };
    return FacebookBot;
}(collection.DialogCollection));
exports.FacebookBot = FacebookBot;
var FacebookSession = (function (_super) {
    __extends(FacebookSession, _super);
    function FacebookSession() {
        _super.apply(this, arguments);
    }
    FacebookSession.prototype.escapeText = function (text) {
        if (text) {
            text = text.replace(/&/g, '&amp;');
            text = text.replace(/</g, '&lt;');
            text = text.replace(/>/g, '&gt;');
        }
        return text;
    };
    FacebookSession.prototype.unescapeText = function (text) {
        if (text) {
            text = text.replace(/&amp;/g, '&');
            text = text.replace(/&lt;/g, '<');
            text = text.replace(/&gt;/g, '>');
        }
        return text;
    };
    return FacebookSession;
}(session.Session));
exports.FacebookSession = FacebookSession;
