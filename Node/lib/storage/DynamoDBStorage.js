var Debug = require('debug');
var debug = Debug('DynamoDBStorage');
var AWS = require('aws-sdk');
var DynamoDBStorage = (function () {
    function DynamoDBStorage(state, storage) {
        debug("set storage: dynamodb: " + state);
        AWS.config.update({
            region: storage.region
        });
        this.dd = new AWS.DynamoDB.DocumentClient();
        this.ddTable = storage.table;
        this.state = state;
    }
    DynamoDBStorage.prototype.get = function (id, callback) {
        var params = {
            Key: {
                "id": id,
                "state": this.state
            },
            TableName: this.ddTable
        };
        debug("get: " + this.state + " " + id, JSON.stringify(params));
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
                "id": id,
                "state": this.state,
                "data": data || {}
            },
            TableName: this.ddTable
        };
        debug("put " + this.state + " " + id, JSON.stringify(params));
        this.dd.put(params, callback);
    };
    DynamoDBStorage.prototype.delete = function (id) {
        var params = {
            Key: {
                "id": id,
                "state": this.state
            },
            TableName: this.ddTable
        };
        debug("delete " + this.state + " " + id, JSON.stringify(params));
        this.dd.delete(params);
    };
    return DynamoDBStorage;
}());
exports.DynamoDBStorage = DynamoDBStorage;
