var Debug = require('debug');
var debug = Debug('DynamoDBStorage');
var AWS = require('aws-sdk');
var DynamoDBStorage = (function () {
    function DynamoDBStorage(type, storage) {
        debug("set storage: dynamodb: " + type);
        AWS.config.update({
            region: storage.region
        });
        this.dd = new AWS.DynamoDB.DocumentClient();
        this.ddTable = storage.table;
        this.partitionKey = storage.partition_key + "_" + type;
    }
    DynamoDBStorage.prototype.get = function (id, callback) {
        var params = {
            Key: {
                "partition": this.partitionKey,
                "id": id
            },
            TableName: this.ddTable
        };
        debug("get: " + this.partitionKey, JSON.stringify(params));
        this.dd.get(params, function (err, result) {
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
    };
    DynamoDBStorage.prototype.save = function (id, data, callback) {
        var params = {
            Item: {
                "partition": this.partitionKey,
                "id": id,
                "data": data || {}
            },
            TableName: this.ddTable
        };
        debug("put " + this.partitionKey, JSON.stringify(params));
        this.dd.put(params, callback);
    };
    DynamoDBStorage.prototype.delete = function (id, callback) {
        var params = {
            Key: {
                "partition": this.partitionKey,
                "id": id
            },
            TableName: this.ddTable
        };
        debug("delete " + this.partitionKey, JSON.stringify(params));
        this.dd.delete(params, callback);
    };
    return DynamoDBStorage;
}());
exports.DynamoDBStorage = DynamoDBStorage;
