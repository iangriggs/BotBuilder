
// A quick hack of a Facebook Bot Service for this library. I went straight for
// the javascript as I'm not a Typescript person. It's probably not that tricky
// so will probably revisit shortly and put the Typescript file in place and
// generate this is the way that Microsoft intended. At the moment I'm more
// interested in building a working bot with it.
//
// See ../../examples/hello-FacebookBot for an example of using it!!!!.

import events = require('events');
import request = require('request');

export class FacebookBotService {
    
    private page_token: string;
    private validation_token: string;
    private eventEmitter: any;

    constructor(page_token: string, validation_token: string) {
        this.page_token = page_token;
        this.validation_token = validation_token;
        this.eventEmitter = new events.EventEmitter();
        this.receive = this.receive.bind(this); // ensures this has class scope and not caller scope
    }

    send(sender: string, text: string, errorHandler: any) {
        console.log(sender, text);

        var messageData = {
            text: text
        }

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
        }, function(error: any, response: any, body: any) {
                if (error) {
                    console.log('Error sending message: ', error);
                } else if (response.body.error) {
                    console.log('Error: ', response.body.error);
                }
            });
    }

    receive(req: any, res: any) {
        console.log('receive handler called', req.body);

        var messaging_events = req.body.entry[0].messaging;
        for (var i = 0; i < messaging_events.length; i++) {
            var event = req.body.entry[0].messaging[i];
            var sender = event.recipient.id;
            var recipient = event.sender.id;
            if (event.message && event.message.text) {
                var text = event.message.text;
                var id = event.message.mid;
                console.log('message received:', text, sender);
                this.eventEmitter.emit('message', {
                    messageId: id,
                    text: text,
                    to: recipient,
                    from: sender
                });
            }
        }

        res.send(200);
    }

    validate(req: any, res: any) {
        console.log('validate handler called', req.params);
        if (req.params.hub.verify_token === this.validation_token) {
            var challenge = Number(req.params.hub.challenge);
            res.send(200, challenge);
            console.log('validation successful');
            return;
        }
        console.error('Error, wrong validation token');
        res.send('Error, wrong validation token');
    }
}
