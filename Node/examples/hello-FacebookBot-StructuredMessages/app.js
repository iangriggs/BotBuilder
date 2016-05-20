// A quick hello world using the hacked together demonstrating the Facebook Bot
// Service and Provider working together.
//
// I had to also run 'npm install' from the ../../../Node folder to get some
// some dependencies installed including chrono-node, node-uuid, request
// and sprintf-js

var restify = require('restify');
var builder = require('../../');

var page_token = process.env.PAGE_TOKEN;
if (!page_token) {
    console.error('Page token required as PAGE_TOKEN environment variable.');
    return;
}
var validation_token = process.env.VALIDATION_TOKEN;
if (!validation_token) {
    console.error('Provide validation token required as VALIDATION_TOKEN environment variable.');
    return;
}

var options = {
    page_token,
    validation_token
};

var bot = new builder.FacebookBot(options);


bot.add('/', [function(session) {
        var imageMessage = new builder.Message().addAttachment({
            contentType: 'image/png',
            contentUrl: 'https://upload.wikimedia.org/wikipedia/en/a/a6/Bender_Rodriguez.png'
        });

        session.send(imageMessage);
        builder.Prompts.confirm(session, 'Want to see a card style example?');
    },
    function(session, results) {
        if (results.response) {
            var cardMessage = new builder.Message();
            cardMessage.addAttachment({
                "title": "Robots",
                // "Link": "https://en.wikipedia.org/wiki/Bender_(Futurama)",
                "text": "Do you think the future is robots?",
                "thumbnailUrl": "http://www.theoldrobots.com/images62/Bender-18.JPG",
                // "fallbackText": "Bender: http://www.theoldrobots.com/images62/Bender-18.JPG",
                "actions": [{
                    title: 'Likely',
                    message: 'Likely to Robots',
                }, {
                    title: 'Nah',
                    message: 'Nah to Robots',
                }]
            });
            cardMessage.addAttachment({
                "title": "Virtual Reality",
                // "Link": "http://images.techtimes.com/data/images/full/218154/oculus-rift.jpg?w=600",
                "text": "Do you think the future is virtual reality?",
                "thumbnailUrl": "http://images.techtimes.com/data/images/full/218154/oculus-rift.jpg",
                // "fallbackText": "Bender: http://www.theoldrobots.com/images62/Bender-18.JPG",
                "actions": [{
                    title: 'Likely',
                    message: 'Likely to VR',
                }, {
                    title: 'Nah',
                    message: 'Nah to VR',
                }]
            });

            session.send('Mulitple cards with action buttons...')
            builder.Prompts.text(session, cardMessage);
        } else {
            session.send('No problem...taking you back to the start');
        }
    },
    function(session, results) {
        if (results.response) {
            session.send(`You answered ${results.response}`);
            builder.Prompts.choice(session, "One more question...which color?", ["red", "green", "yellow","blue"]);
        } else {
            session.send('No problem...taking you back to the start');
        }
    },
    function(session, results) {
        console.log('results', results);
        if (results.response) {            
            var messageContent = {
                contentType: 'image/png'
            }

            if (results.response.entity === 'red') {
                messageContent.contentUrl = 'https://pbs.twimg.com/media/CiVO61PWUAMVDpu.jpg:small'
            } else if (results.response.entity === 'green') {
                messageContent.contentUrl = 'https://pbs.twimg.com/media/CiGpFCkWMAAwnKa.jpg:small'
            } else if (results.response.entity === 'yellow') {
                messageContent.contentUrl = 'https://pbs.twimg.com/media/CiRzMe3XIAECGhT.jpg:small'
            } else {                
                messageContent.contentUrl = 'https://pbs.twimg.com/media/CikrsGrXAAAIkhQ.jpg:small'            
            }

            var imageMessage = new builder.Message().addAttachment(messageContent);
            session.send(imageMessage);
        } else {
            session.send('No match...taking you back to the start');
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
    bot.botService.validate(req.params, function(err, challenge) {
        if (err) {
            console.error(err);
            res.send('Error, validation failed');
            return;
        }
        console.log('validation successful');
        res.send(200, challenge);
    });
};