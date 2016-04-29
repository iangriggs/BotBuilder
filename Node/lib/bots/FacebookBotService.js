"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var events = require('events');
var request = require('request');
var FacebookBotService = (function (_super) {
    __extends(FacebookBotService, _super);
    function FacebookBotService(page_token, validation_token) {
        _super.call(this);
        this.page_token = page_token;
        this.validation_token = validation_token;
    }
    FacebookBotService.prototype.send = function (sender, text, errorHandler) {
        console.log(sender, text);
        var messageData = { text: text };
        request({
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: {
                access_token: this.page_token
            },
            method: 'POST',
            json: {
                recipient: {
                    id: sender
                },
                message: messageData,
            }
        }, function (error, response, body) {
            if (error) {
                console.error('Error sending message: ', error);
            }
            else if (response.body.error) {
                console.error('Error: ', response.body.error);
            }
        });
    };
    FacebookBotService.prototype.receive = function (message) {
        console.log('receive handler called', message);
        var messaging_events = message.entry[0].messaging;
        for (var i = 0; i < messaging_events.length; i++) {
            var event = message.entry[0].messaging[i];
            var sender = event.recipient.id;
            var recipient = event.sender.id;
            if (event.message && event.message.text) {
                var text = event.message.text;
                var id = event.message.mid;
                console.log('message received:', text, sender);
                this.emit('message', {
                    messageId: id,
                    text: text,
                    to: recipient,
                    from: sender
                });
            }
        }
    };
    FacebookBotService.prototype.validate = function (params, callback) {
        console.log('validate handler called', params);
        if (params.hub.verify_token === this.validation_token) {
            var challenge = Number(params.hub.challenge);
            callback(null, challenge);
            return;
        }
        callback(new Error('validation failed'));
    };
    return FacebookBotService;
}(events.EventEmitter));
exports.FacebookBotService = FacebookBotService;
