import collection = require('../dialogs/DialogCollection');
import session = require('../Session');
import storage = require('../storage/Storage');
import botService = require('./FacebookBotService');

export interface IFacebookBotOptions {
    userStore?: storage.IStorage;
    sessionStore?: storage.IStorage;
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
    page_token?:string;
    validation_token?:string;
}

export interface IFacebookBotMessage {
  to: string,
  from: string,
  type: string,
  content: string,
  messageId: number,
  text: string,
  contentType: string,
  eventTime: number
}

export interface IFacebookBotService {
  FacebookBotService: any,
  eventEmitter: any,
  send: any
}

export class FacebookBot extends collection.DialogCollection {
    private options: IFacebookBotOptions = {
        maxSessionAge: 14400000,    // <-- default max session age of 4 hours
        defaultDialogId: '/',
        minSendDelay: 1000,       
    };
    
    private botService: any;

    constructor(options?: IFacebookBotOptions) {
        super();
        this.configure(options);
        this.botService = new botService.FacebookBotService(options.page_token, options.validation_token);
        var events = 'message|message_deliveries|messaging_optins|messaging_postbacks'.split('|');
        events.forEach((value) => {
            this.botService.eventEmitter.on(value, (data: IFacebookBotMessage) => {
                console.log('botService emitted message');
                this.handleEvent(value, data);
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

    private dispatchMessage(data: IFacebookBotMessage, dialogId: string, dialogArgs: any) {
        var onError = (err: Error) => {
            this.emit('error', err, data);
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
                // If we have no message text then we're just saving state.
                if (reply && reply.text) {
                    var facebookReply = this.toFacebookMessage(reply);
                    facebookReply.to = ses.message.to.address;
                    this.botService.send(facebookReply.to, facebookReply.content, onError);
                }
            });
        });
        ses.on('error', (err: Error) => {
            this.emit('error', err, data);
        });
        ses.on('quit', () => {
            this.emit('quit', data);
        });

        // Load data and dispatch message
        var msg = this.fromFacebookMessage(data);
        this.getData(msg.from.address, (userData, sessionState) => {
            ses.userData = userData || {};
            ses.dispatch(sessionState, msg);
        });
    }

    private getData(userId: string, callback: (userData: any, sessionState: ISessionState) => void) {
        // Ensure stores specified
        if (!this.options.userStore) {
            this.options.userStore = new storage.MemoryStorage();
        }
        if (!this.options.sessionStore) {
            this.options.sessionStore = new storage.MemoryStorage();
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
    }

    private toFacebookMessage(msg: IMessage): IFacebookBotMessage {
        return <IFacebookBotMessage>{
            type: msg.type,
            from: msg.from ? msg.from.address : '',
            to: msg.to ? msg.to.address : '',
            content: msg.text,
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
