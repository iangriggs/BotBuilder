#Instructions for running example Facebook bot. 

The steps below assume that you've already followed the developer setup steps documented on the relevant Facebook Messenger Quickstart page on http://developer.facebook.com (https://developers.facebook.com/docs/messenger-platform/quickstart) and have your PAGE TOKEN and a VADLIDATION TOKEN ready.
   
    git clone git@github.com:<REPO>.git 
    cd <CLONED INTO FOLDER>
    cd Node
    git install
    cd examples
    cd hello-Facebook
    npm install
    PAGE_TOKEN=<PAGE TOKEN> VALIDATION_TOKEN=<VALIDATION TOKEN> node app.js
    
After completing the steps above open a Chat window in Facebook to your bot and type 'hello' and receive a 'hello' back.

