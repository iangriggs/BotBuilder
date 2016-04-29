"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var collection = require('../dialogs/DialogCollection');
var session = require('../Session');
var storage = require('../storage/Storage');
var botService = require('./FacebookBotService');
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
            _this.botService.on(value, function (data) {
                console.log('botService emitted message');
                _this.handleEvent(value, data);
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
    FacebookBot.prototype.dispatchMessage = function (data, dialogId, dialogArgs) {
        var _this = this;
        var onError = function (err) {
            _this.emit('error', err, data);
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
                if (reply && reply.text) {
                    var facebookReply = _this.toFacebookMessage(reply);
                    facebookReply.to = ses.message.to.address;
                    _this.botService.send(facebookReply.to, facebookReply.content, onError);
                }
            });
        });
        ses.on('error', function (err) {
            _this.emit('error', err, data);
        });
        ses.on('quit', function () {
            _this.emit('quit', data);
        });
        var msg = this.fromFacebookMessage(data);
        this.getData(msg.from.address, function (userData, sessionState) {
            ses.userData = userData || {};
            ses.dispatch(sessionState, msg);
        });
    };
    FacebookBot.prototype.getData = function (userId, callback) {
        var _this = this;
        if (!this.options.userStore) {
            this.options.userStore = new storage.MemoryStorage();
        }
        if (!this.options.sessionStore) {
            this.options.sessionStore = new storage.MemoryStorage();
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
            id: msg.messageId.toString(),
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
    FacebookBot.prototype.toFacebookMessage = function (msg) {
        return {
            type: msg.type,
            from: msg.from ? msg.from.address : '',
            to: msg.to ? msg.to.address : '',
            content: msg.text,
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
