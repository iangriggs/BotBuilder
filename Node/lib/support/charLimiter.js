var chunkString = function(message, length, callback) {
  var objectArray = [];
  var results = message.match(new RegExp('.{1,' + length + '}', 'g'));
  for (result in results){
    objectArray.push({text: results[result]});
  }
  callback(objectArray);
};

var sendMessage = function(message, callback) {
  if (message.text.length > 320) {
    chunkString(message.text, 320, function(results) {
      callback(results);
    });
  } else {
    callback([message]);
  }
};

module.exports = sendMessage;
