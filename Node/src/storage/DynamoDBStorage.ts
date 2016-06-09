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
    private partitionKey: string;

    constructor(type: string, storage: IStorageOptions) {
        debug(`set storage: dynamodb: ${type}`)
        AWS.config.update({
            region: storage.region
        });
        this.dd = new AWS.DynamoDB.DocumentClient();
        this.ddTable = storage.table;
        this.partitionKey = `${storage.partition_key}_${type}`;
    }

    public get(id: string, callback: (err?: Error, data?: IBotStorageData) => void): void {
        var params = {
            Key: {
                "partition": this.partitionKey,
                "id": id
            },
            TableName: this.ddTable
        };
        debug(`get: ${this.partitionKey} ${id}`, JSON.stringify(params));
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
                "partition": this.partitionKey,
                "id": id,
                "data": data || {}
            },
            TableName: this.ddTable
        };
        debug(`put ${this.partitionKey} ${id}`, JSON.stringify(params));
        this.dd.put(params, callback);
    }

    public delete(id: string): void {
        var params = {
            Key: {
                "partition": this.partitionKey,
                "id": id
            },
            TableName: this.ddTable
        };
        debug(`delete ${this.partitionKey} ${id}`, JSON.stringify(params));
        this.dd.delete(params);
    }
}
