import Debug = require('debug')
const debug = Debug('FacebookBot');
import collection = require('../dialogs/DialogCollection');
import session = require('../Session');
import memory = require('../storage/Storage');
import dynamoDb = require('../storage/DynamoDBStorage');
import botService = require('./FacebookBotService');
import consts = require('../consts');

export interface IFacebookBotOptions {
    userStore?: IStorage;
    sessionStore?: IStorage;
    maxSessionAge?: number;
    localizer?: ILocalizer;
    minSendDelay?: number;
    defaultDialogId?: string;
    defaultDialogArgs?: any;
    contactAddedmessage?: string;
    botAddedMessage?: string;
    botRemovedMessage?: string;
    memberAddedMessage?: string;
    memberRemovedMessage?: string;
    page_token?: string;
    validation_token?: string;
    storage?: IStorageOptions;
}

export interface IFacebookBotMessage {
    to: string;
    from: string;
    type: string;
    content: IFacebookBotMessageContent;
    messageId: number;
    text: string;
    contentType: string;
    eventTime: number;
}

export interface IFacebookBotService {
    send(sender: string, message: IFacebookBotMessageContent, errorHandler: any): void;
    on(event: string, listener: Function): void;
}

export class FacebookBot extends collection.DialogCollection {
    private options: IFacebookBotOptions = {
        maxSessionAge: 14400000,    // <-- default max session age of 4 hours
        defaultDialogId: '/',
        minSendDelay: 1000,
    };

    private botService: IFacebookBotService;

    constructor(options?: IFacebookBotOptions) {
        super();
        this.configure(options);
        this.botService = new botService.FacebookBotService(options.page_token, options.validation_token);
        var events = 'message|message_deliveries|messaging_optins|messaging_postbacks'.split('|');
        events.forEach((value) => {
            this.botService.on(value, (message: IFacebookBotMessage) => {
                debug('bot message', JSON.stringify(message));
                this.handleEvent(value, message);
            });
        });
    }

    public configure(options: IFacebookBotOptions) {
        if (options) {
            for (var key in options) {
                if (options.hasOwnProperty(key)) {
                    (<any>this.options)[key] = (<any>options)[key];
                }
            }
        }
    }

    public beginDialog(address: IBeginDialogAddress, dialogId: string, dialogArgs?: any): void {
        // Validate args
        if (!address.to) {
            throw new Error('Invalid address passed to FacebookBot.beginDialog().');
        }
        if (!this.hasDialog(dialogId)) {
            throw new Error('Invalid dialog passed to FacebookBot.beginDialog().');
        }

        // Dispatch message
        this.dispatchMessage(this.toFacebookMessage(address), dialogId, dialogArgs);
    }

    private handleEvent(event: string, data: any) {
        var onError = (err: Error) => {
            this.emit('error', err, data);
        };

        switch (event) {
            case 'message':
                this.dispatchMessage(data, this.options.defaultDialogId, this.options.defaultDialogArgs);
                break;
        }
    }

    private dispatchMessage(message: IFacebookBotMessage, dialogId: string, dialogArgs: any) {
        var onError = (err: Error) => {
            this.emit('error', err, message);
        };

        // Initialize session
        var ses = new FacebookSession({
            localizer: this.options.localizer,
            minSendDelay: this.options.minSendDelay,
            dialogs: this,
            dialogId: dialogId,
            dialogArgs: dialogArgs
        });
        ses.on('send', (reply: IMessage) => {
            this.saveData(msg.from.address, ses.userData, ses.sessionState, () => {
                if (reply) {
                    var facebookReply = this.toFacebookMessage(reply);
                    facebookReply.to = ses.message.to.address;
                    this.botService.send(facebookReply.to, facebookReply.content, onError);
                }
            });
        });
        ses.on('error', (err: Error) => {
            this.emit('error', err, message);
        });
        ses.on('quit', () => {
            this.emit('quit', message);
        });

        // Load data and dispatch message
        var msg = this.fromFacebookMessage(message);
        this.getData(msg.from.address, (userData, sessionState) => {
            ses.userData = userData || {};
            ses.dispatch(sessionState, msg);
        });
    }

    private getData(userId: string, callback: (userData: any, sessionState: ISessionState) => void) {
        // Ensure stores specified
        if (!this.options.userStore) {
            if (this.options.storage && this.options.storage.provider === consts.StorageProviders.DynamoDb) {
                this.options.userStore = new dynamoDb.DynamoDBStorage(consts.StorageTypes.User, this.options.storage);
            } else {
                this.options.userStore = new memory.MemoryStorage();
            }
        }
        if (!this.options.sessionStore) {
            if (this.options.storage && this.options.storage.provider === consts.StorageProviders.DynamoDb) {
                this.options.sessionStore = new dynamoDb.DynamoDBStorage(consts.StorageTypes.Session, this.options.storage);
            } else {
                this.options.sessionStore = new memory.MemoryStorage();
            }
        }

        // Load data
        var ops = 2;
        var userData: any, sessionState: ISessionState;
        this.options.userStore.get(userId, (err, data) => {
            if (!err) {
                userData = data;
                if (--ops == 0) {
                    callback(userData, sessionState);
                }
            } else {
                this.emit('error', err);
            }
        });
        this.options.sessionStore.get(userId, (err: Error, data: ISessionState) => {
            if (!err) {
                if (data && (new Date().getTime() - data.lastAccess) < this.options.maxSessionAge) {
                    sessionState = data;
                }
                if (--ops == 0) {
                    callback(userData, sessionState);
                }
            } else {
                this.emit('error', err);
            }
        });
    }

    private saveData(userId: string, userData: any, sessionState: ISessionState, callback: Function) {
        var ops = 2;
        function onComplete(err: Error) {
            if (!err) {
                if (--ops == 0) {
                    callback(null);
                }
            } else {
                callback(err);
            }
        }
        this.options.userStore.save(userId, userData, onComplete);
        this.options.sessionStore.save(userId, sessionState, onComplete);
    }

    private fromFacebookMessage(msg: IFacebookBotMessage): IMessage {
        return {
            type: msg.type,
            id: msg.messageId ? msg.messageId.toString() : '', // TODO: postbacks don't have a messageId - what to do?
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
    }
    
    private toMessageContent(msg:IMessage): IFacebookBotMessageContent {
        if (!msg) {
            return;
        }
        var content: any = {
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
            } else if (msg.attachments[0].thumbnailUrl) {
                var elements: any[] = [];
                msg.attachments.forEach(function(attachment) {
                    var buttons: any[] = [];
                    if (attachment.actions) {
                        attachment.actions.forEach(function(action) {
                            var button: any = {};
                            button.title = action.title;
                            if (action.url) {
                                button.type = 'web_url';
                                button.url = action.url;
                            } else {
                                button.type = 'postback';
                                button.payload = action.message

                            }
                            buttons.push(button);
                        })
                    }
                    
                    var element: any = {
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
            } else if (msg.attachments[0].actions && msg.attachments[0].actions.length > 0) {
                var attachment = msg.attachments[0];
                var buttons: any[] = [];
                attachment.actions.forEach(function(action) {
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
    }

    private toFacebookMessage(msg: IMessage): IFacebookBotMessage {
        return <IFacebookBotMessage>{
            type: msg.type,
            from: msg.from ? msg.from.address : '',
            to: msg.to ? msg.to.address : '',
            content: this.toMessageContent(msg),
            messageId: msg.id ? Number(msg.id) : Number.NaN,
            contentType: "RichText",
            eventTime: msg.channelData ? msg.channelData.eventTime : new Date().getTime()
        };
    }
}

export class FacebookSession extends session.Session {

    public escapeText(text: string): string {
        if (text) {
            text = text.replace(/&/g, '&amp;');
            text = text.replace(/</g, '&lt;');
            text = text.replace(/>/g, '&gt;');
        }
        return text;
    }

    public unescapeText(text: string): string {
        if (text) {
            text = text.replace(/&amp;/g, '&');
            text = text.replace(/&lt;/g, '<');
            text = text.replace(/&gt;/g, '>');
        }
        return text;
    }
}
