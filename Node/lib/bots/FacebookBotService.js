// A quick hack of a Facebook Bot Service for this library. I went straight for
// the javascript as I'm not a Typescript person. It's probably not that tricky
// so will probably revisit shortly and put the Typescript file in place and
// generate this is the way that Microsoft intended. At the moment I'm more
// interested in building a working bot with it.
//
// See ../../examples/hello-FacebookBot for an example of using it.

var events = require('events');
var request = require('request');
var eventEmitter = new events.EventEmitter();

function FacebookBotService(page_token, validation_token) {

    events.EventEmitter.call(this);
    this.eventEmitter = eventEmitter;

    this.send = function(sender, text, errorHandler) {
        console.log(sender, text);

        messageData = {
            text: text
        }

        request({
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: {
                access_token: page_token
            },
            method: 'POST',
            json: {
                recipient: {
                    id: sender
                },
                message: messageData,
            }
        }, function(error, response, body) {
            if (error) {
                console.log('Error sending message: ', error);
            } else if (response.body.error) {
                console.log('Error: ', response.body.error);
            }
        });
    }

    this.receive = function(req, res) {
        console.log('receive handler called', req.body);

        var messaging_events = req.body.entry[0].messaging;
        for (i = 0; i < messaging_events.length; i++) {
            event = req.body.entry[0].messaging[i];
            sender = event.recipient.id;
            recipient = event.sender.id;
            if (event.message && event.message.text) {
                text = event.message.text;
                id = event.message.mid;
                console.log('message received:', text, sender);
                eventEmitter.emit('message', 'BOTS RULE!', {
                    messageId: id,
                    text: text,
                    to: recipient,
                    from: sender
                });
            }
        }

        res.send(200);
    }

    this.validate = function(req, res) {
        console.log('validate handler called', req.params);
        if (req.params.hub.verify_token === validation_token) {
            var challenge = Number(req.params.hub.challenge);
            res.send(200, challenge);
            console.log('validation successful');
            return;
        }
        console.error('Error, wrong validation token');
        res.send('Error, wrong validation token');
    }
}

FacebookBotService.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = FacebookBotService;
