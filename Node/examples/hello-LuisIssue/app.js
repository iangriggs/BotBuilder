var builder = require('../../');
var bot = new builder.TextBot();

var model = 'https://api.projectoxford.ai/luis/v1/application?id=597f02c4-0aac-47e2-a64c-790c54f43e98&subscription-key=6d0966209c6e4f6b835ce34492f3e6d9&q=';
var luisDialog = new builder.LuisDialog(model);

var simpleWaterfall = [function(session) {
    session.send('Start of conversation');
    builder.Prompts.text(session, 'Type anything and hit enter to start secondary dialog');
}, function(session, result) {
    session.send('beginDialog /secondary');
    session.beginDialog('/secondary');
}];

//*** Uncomment one or the other to test different scenarios

var dialog = luisDialog;
//var dialog = simpleWaterfall;

//**********************************************************

bot.add('/', dialog); 

bot.add('/secondary', [function(session) {
    session.send('In secondary dialog');
    builder.Prompts.text(session, 'Type anything and hit enter to return to primary dialog');
}, function(session) {    
    session.endDialog('Returning to primary dialog');
}])


luisDialog.onBegin(function(session, args, next){
    session.send('On begin - say \'help\' to fire intent'); 
});

luisDialog.onDefault(function(session) {
    session.send('onDefault');
})

luisDialog.on('Help', [function(session) {
    session.send('\'Help\' intent fired');
    session.beginDialog('/secondary');
}]);

console.log('Say \'hi\' to start conversation');

bot.listenStdin();
