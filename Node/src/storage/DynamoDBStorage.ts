import Debug = require('debug')
const debug = Debug('DynamoDBStorage');
import utils = require('../utils');
import AWS = require('aws-sdk');

export interface IBotStorageData {
    userData?: any;
    conversationData?: any;
}

export interface IBotStorage {
    get(id: string, callback: (err?: Error, data?: IBotStorageData) => void): void;
    save(id: string, data: IBotStorageData, callback?: (err: Error) => void): void;
}

export class DynamoDBStorage implements IBotStorage {

    private dd: any;
    private ddTable: string;
    private state: string;

    constructor(state: string, storage: IStorageOptions) {
        debug(`set storage: dynamodb: ${state}`)
        AWS.config.update({
            region: storage.region
        });
        this.dd = new AWS.DynamoDB.DocumentClient();
        this.ddTable = storage.table;
        this.state = state;
    }

    public get(id: string, callback: (err?: Error, data?: IBotStorageData) => void): void {
        var params = {
            Key: {
                "id": id,
                "state": this.state
            },
            TableName: this.ddTable
        };
        debug(`get: ${this.state} ${id}`, JSON.stringify(params));
        this.dd.get(params, function(err: Error, result: any) {
            if (err) {
                callback(err);
                return;
            }

            if (result && result.Item && result.Item.data) {
                callback(null, result.Item.data);
                return;
            }
            callback();
        });
    }

    public save(id: string, data: IBotStorageData, callback?: (err: Error) => void): void {
        var params = {
            Item: {
                "id": id,
                "state": this.state,
                "data": data || {}
            },
            TableName: this.ddTable
        };
        debug(`put ${this.state} ${id}`, JSON.stringify(params));
        this.dd.put(params, callback);
    }

    public delete(id: string): void {
        var params = {
            Key: {
                "id": id,
                "state": this.state
            },
            TableName: this.ddTable
        };
        debug(`delete ${this.state} ${id}`, JSON.stringify(params));
        this.dd.delete(params);
    }
}
