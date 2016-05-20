
// A quick hack of a Facebook Bot Service for this library. I went straight for
// the javascript as I'm not a Typescript person. It's probably not that tricky
// so will probably revisit shortly and put the Typescript file in place and
// generate this is the way that Microsoft intended. At the moment I'm more
// interested in building a working bot with it.
//
// See ../../examples/hello-FacebookBot for an example of using it!!!!.

import Debug = require('debug')
const debug = Debug('FacebookBotService');
import events = require('events');
import request = require('request');

interface IFacebookReceive {
    object: string;
    entry: {
        id: number;
        time: number;
        messaging: {
            recipient: {
                id: number;
            },
            sender: {
                id: number;
            },
            message?: {
                text: string;
                mid: string;
                seq: number;
            },
            postback?: {
                payload: string;
            }
            timestamp: number;
        }[];
    }[];
}

interface IFacebookValidateParams {
    [key: string]: any;
    hub: any;
}

export class FacebookBotService extends events.EventEmitter {

    private page_token: string;
    private validation_token: string;

    constructor(page_token: string, validation_token: string) {
        super();
        this.page_token = page_token;
        this.validation_token = validation_token;
    }

    send(sender: string, message: IFacebookBotMessageContent, errorHandler: (err: Error) => void) {
        debug('send', sender, message);

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
                message: message,
            }
        }, function(error: Error, response: any, body: any) {
                if (error) {
                    debug('Error sending message: ', error);
                } else if (response.body.error) {
                    debug('Error: ', response.body.error);
                }
            });
    }

    receive(message: IFacebookReceive) {
        debug('receive', JSON.stringify(message));
        var messaging_events = message.entry[0].messaging;
        for (var i = 0; i < messaging_events.length; i++) {
            var event = message.entry[0].messaging[i];
            var sender = event.recipient.id;
            var recipient = event.sender.id;
            if (event.message && event.message.text) {
                var text = event.message.text;
                var id = event.message.mid;
                this.emit('message', {
                    messageId: id,
                    text: text,
                    to: recipient,
                    from: sender
                });
            } else if (event.postback && event.postback.payload) {
                this.emit('message', {
                    messageId: id,
                    text: event.postback.payload,
                    to: recipient,
                    from: sender
                });                
            }
        }
    }

    validate(params: IFacebookValidateParams, callback: (error: Error, challenge?: number) => void) {
      debug('validate', JSON.stringify(params));
      if (params) {
          if (params.hub) {
              var hub_verify_token = params.hub.verify_token;
              var hub_challenge = params.hub.challenge;
          } else {
              var hub_verify_token = params['hub.verify_token'];
              var hub_challenge = params['hub.challenge'];
          }
          if (hub_verify_token === this.validation_token) {
              var challenge = Number(hub_challenge);
              callback(null, challenge);
              return;
          }
      }
      callback(new Error('validation failed'));
    }
}
