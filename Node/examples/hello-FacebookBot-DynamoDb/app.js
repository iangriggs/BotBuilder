// A quick hello world using the hacked together demonstrating the Facebook Bot
// Service and Provider working together.
//
// I had to also run 'npm install' from the ../../../Node folder to get some
// some dependencies installed including chrono-node, node-uuid, request
// and sprintf-
//
// This version demonstrates the briefest of conversations using the dynamodb
// storage provider.

var restify = require('restify');
var builder = require('../../');

var page_token = process.env.PAGE_TOKEN;
if (!page_token) {
  console.error('Page token required as PAGE_TOKEN environment variable.');
  return;
}
var validation_token = process.env.VALIDATION_TOKEN;
if (!validation_token) {
  console.error('Provide validation token as VALIDATION_TOKEN environment variable.');
  return;
}

var ddTable = process.env.DD_TABLE;
if (!validation_token) {
  console.error('Provide DynamoDB table name as DD_TABLE environment variable.');
  return;
}

var ddRegion = process.env.DD_REGION;
if (!validation_token) {
  console.error('Provide DynamoDB region as DD_REGION environment variable.');
  return;
}

var options = {
  page_token,
  validation_token,
  storage: {
    provider: 'dynamodb',
    table: ddTable,
    region: ddRegion
  }
};

var dialog = new builder.CommandDialog();
var bot = new builder.FacebookBot(options);
bot.add('/', dialog);
dialog.matches('^echo', [
    function (session) {
        if (session.userData.echo) {
            builder.Prompts.text(session, `Last time you asked me to say ${session.userData.echo.toUpperCase()}. What would you like me to say this time?`);
        } else {
            builder.Prompts.text(session, "What would you like me to say?");
        }
    },
    function (session, results) {
        if (results.response) {
            session.send(`Ok... ${results.response.toUpperCase()}. Type ECHO to try again.`);
            session.userData.echo = results.response;
        } else {
            session.send("Ok");
        }
    }
]);

var server = restify.createServer();
server.use(restify.bodyParser());
server.use(restify.queryParser());
server.get('/facebook/receive', validate)
server.post('/facebook/receive', receive);

var port = process.env.PORT || 3000;
server.listen(port, function() {
    console.log(`Magic happening on port ${port}`);
});

function receive(req, res) {
    console.log('receive', JSON.stringify(req.body));
    bot.botService.receive(req.body);
    res.send(200);
}

function validate(req, res) {
    console.log('validate', JSON.stringify(req.params));
    bot.botService.validate(req.params, function(err, challenge){
      if (err) {
          console.error(err);
          res.send('Error, validation failed');
          return;
      }
      console.log('validation successful');
      res.send(200, challenge);
    });
};
