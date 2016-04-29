// A quick hello world using the hacked together demonstrating the Facebook Bot
// Service and Provider working together.
//
// I had to also run 'npm install' from the ../../../Node folder to get some
// some dependencies installed including chrono-node, node-uuid, request
// and sprintf-js

var restify = require('restify');
var builder = require('../../');
var FacebookBotService = require('../../lib/bots/FacebookBotService');

var page_token = process.env.PAGE_TOKEN;
if (!page_token) {
  console.err('Page token required as PAGE_TOKEN environment variable.');
  return;
}
var validation_token = process.env.VALIDATION_TOKEN;
if (!validation_token) {
  console.err('Provide vallidation token required as VALIDATION_TOKEN environment variable.');
  return;
}

var botService = new FacebookBotService.FacebookBotService(page_token, validation_token);
var bot = new builder.FacebookBot(botService);

bot.add('/', function (session) {
   session.send('Hello World');
});

var server = restify.createServer();
server.use(restify.bodyParser());
server.use(restify.queryParser());
server.get('/facebook/receive', botService.validate)
server.post('/facebook/receive', botService.receive);
var port = process.env.PORT || 3000;
server.listen(process.env.PORT || 3000, function() {
    console.log(`Magic happening on port ${port}`);
});
