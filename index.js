"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const url = process.env.MONGODB_URI;
const mongoose = require("mongoose");
const mongo = require('mongodb');

const Session = require('./session');

const restService = express();

restService.use(
    bodyParser.urlencoded({
        extended: true
    })
);


restService.use(bodyParser.json());


restService.listen(process.env.PORT || 8000, function () {
    console.log("Server up and listening");
});
;

mongoose.connect('mongodb://localhost:27017/mysterybot', {useNewUrlParser: true, useCreateIndex: true});
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));


restService.post("/add", function (req, res) {
    console.log(req.body.session)
    var session = new Session(req.body);
    session.save(function (err, session) {
        if (err) {
            res.status(400).json({
                message: err.message
            });
        } else {
            res.status(201).json(session);
        }
    })
});


restService.get("/getAll", async (req, res, next) => {
    try {
        const sessions = await Session.find({}).exec();
        return res.status(200).json({
            result: sessions
        });
    } catch (err) {
        return res.status(500).json({
            status: 'error'
        });
    }
})

restService.get("/", (req, res, next) => {
    return res.status(200).json({
        message: 'It is working'
    });
})

restService.post("/start", async (req, res, next) => {
    try {
        const session = await getSession(req.body.session);
        session.tries++;
        const newSession = await Session.findOneAndUpdate(session.session, session, false).exec();
        return res.status(200).json({
            result: newSession
        });
    } catch (err) {
        return res.status(500).json({
            status: 'error'
        });
    }
});

restService.post("/test", async (req, res, next) => {
    try {
        const session = await Session.findOne({session: req.body.session}).exec();
        if (session) {
            return res.status(200).json({
                result: session
            });
        } else {
            var ses = new Session(req.body);
            ses.save(function (err, ses) {
                if (err) {
                    res.status(400).json({
                        message: err.message
                    });
                } else {
                    res.status(201).json(ses);
                }
            })
        }

    } catch (err) {
        return res.status(500).json({
            status: 'error'
        });
    }
})

async function getSession(ses) {
    try {
        const session = await Session.findOne({session: ses}).exec();
        if (session) {
            return session;
        } else {
            var newSes = new Session(req.body);
            newSes.save(function (err, newSes) {
                if (err) {
                    console.log(err);
                } else {
                    return newSes;
                }
            })
        }
    } catch (err) {
        console.log(err);
    }

}


restService.post("/echo", function (req, res) {
    var speech =
        req.body.queryResult &&
        req.body.queryResult.parameters &&
        req.body.queryResult.parameters.echoText
            ? req.body.queryResult.parameters.echoText
            : "Seems like some problem. Speak again.";

    var speechResponse = {
        google: {
            expectUserResponse: true,
            richResponse: {
                items: [
                    {
                        simpleResponse: {
                            textToSpeech: speech
                        }
                    }
                ]
            }
        }
    };


    /* add Mongo DB transaction*/

    var resString = "problem_with mongo"
    // Now use sessionId to find session in database

    //1. Check wether document with given session Id is already there
    //var user = findOrCreateSession("123");


    /*mongo.MongoClient.connect(url,  function(err, db) {

        if (err) throw err;

        var dbo = db.db("heroku_5pv6gkcs");

        dbo.createCollection("sessions", function(err, res) {
          if (err) throw err;
          db.close
        })


        //adding data
        var myobj = [
          { "msg_from" : "tadhack", "msg_to" : "gihan", "msg_body" : "promotion 1" },
          { "msg_from" : "dialog", "msg_to" : "gihan", "msg_body" : "promotion 1" },
          { "msg_from" : "tadhack", "msg_to" : "gihan", "msg_body" : null, "msg_date" : "2018-10-13T16:43:39.989Z" },
          { "msg_from" : "tadhack", "msg_to" : "gihan", "msg_body" : null, "msg_date" : "2018-10-13T16:45:55.447Z" },
          { "msg_from" : "tadhack", "msg_to" : "gihan", "msg_body" : null, "msg_date" : "2018-10-13T16:50:08.034Z" },
          { "msg_from" : "tadhack", "msg_to" : "gihan", "msg_body" : "send your data", "msg_date" : "2018-10-13T16:51:53.639Z" },
          { "msg_from" : "tadhack", "msg_to" : "gihan", "msg_body" : "msg", "msg_date" : "2018-10-13T17:45:40.873Z" },
          { "msg_from" : "tadhack", "msg_to" : "gihan", "msg_body" : "We need your NIC numbers and vehicle registration numbers for security purpose. Please find the attached, fill the details and get back to us ASAP.  \r\n \r\nThanks and Regards,\r\n\r\nM. S. M. Siyas\r\n", "msg_date" : "2018-10-14T02:09:15.574Z" }
        ]
        dbo.collection("sessions").insertMany(myobj, function(err, res) {
          if (err) throw err;
          resString="Number of documents inserted: " + res.insertedCount;
          db.close();
        });

    })*/

    return res.json({
        payload: speechResponse,
        //data: speechResponse,
        fulfillmentText: resString,
        speech: speech,
        displayText: speech,
        source: "webhook-echo-sample"
    });
});


restService.post("/addSession", function (req, res) {
    var speech =
        req.body.queryResult &&
        req.body.queryResult.parameters &&
        req.body.queryResult.parameters.echoText
            ? req.body.queryResult.parameters.echoText
            : "Seems like some problem. Speak again.";

    var sessionId = req.body.session || "No session available";
    var queryText = req.body.queryResult.queryText || "no query text available";
    var speechResponse = {
        google: {
            expectUserResponse: true,
            richResponse: {
                items: [
                    {
                        simpleResponse: {
                            textToSpeech: speech
                        }
                    }
                ]
            }
        }
    };
    var resString = "problem_with mongo";
    mongo.MongoClient.connect(url, function (err, db) {

        if (err) throw err;

        var myobj = [
            {
                "session_id": sessionId,
                "query_text": queryText
            }
        ]

        /* add Mongo DB transaction*/


        var dbo = db.db("heroku_5pv6gkcs");
        dbo.collection("sessions").insertMany(myobj, function (err, res) {
            if (err) throw err;
            console.log("Number of documents inserted: " + res.insertedCount);
            db.close();
        });

    })


    return res.json({
        payload: speechResponse,
        //data: speechResponse,
        fulfillmentText: resString,
        speech: speech,
        displayText: speech,
        source: "webhook-echo-sample"
    });
});


restService.post("/findSession", function (req, res) {
    var speech =
        req.body.queryResult &&
        req.body.queryResult.parameters &&
        req.body.queryResult.parameters.echoText
            ? req.body.queryResult.parameters.echoText
            : "Seems like some problem. Speak again.";

    var sessionId = req.body.session || "No session available";

    var speechResponse = {
        google: {
            expectUserResponse: true,
            richResponse: {
                items: [
                    {
                        simpleResponse: {
                            textToSpeech: speech
                        }
                    }
                ]
            }
        }
    };
    var resString = "problem_with mongo";
    mongo.MongoClient.connect(url, function (err, db) {

        if (err) throw err;

        /* add Mongo DB transaction*/


        var dbo = db.db("heroku_5pv6gkcs");
        dbo.collection('sessions').findOne({'session_id': sessionId})
            .then(function (doc) {
                if (!doc) {
                    db.close();
                    throw new Error('No record found.');
                } else {
                    console.log(doc);
                    db.close();
                }

            });

    })


    return res.json({
        payload: speechResponse,
        //data: speechResponse,
        fulfillmentText: resString,
        speech: speech,
        displayText: speech,
        source: "webhook-echo-sample"
    });
});

/*async function  findOrCreateSession  (sessionId) {
  var user= {}
  //is session known?
  try {
    mongo.MongoClient.connect(url, async function(err, db) {
   /!*   if (err) throw err;
      var dbo = db.db("heroku_5pv6gkcs");

      var id = new require('mongodb').ObjectID('5df62b365f483a00179d59a1');
      //var id = '5df62b365f483a00179d59a1'//req.params.id
      dbo.collection('sessions').findOne({'_id':id})
          .then(function(doc) {
            if(!doc)
              throw new Error('No record found.');
            console.log(doc);//else case
          });*!/


      //

      assert.equal(null, err);
      var dbo = db.db('heroku_5pv6gkcs');
      var id = new require('mongodb').ObjectID('5df62b365f483a00179d59a1');
      //Step 1: declare promise

      var myPromise =  function() {
        return new Promise((resolve, reject) => {

          dbo.collection('sessions').findOne({'_id':id})
              .then(function(err, data) {
                err
                    ? reject(err)
                    : resolve(data);

                console.log(data);//else case
              });

        });
      };
      //await myPromise
      var result = await myPromise();
      //continue execution
      db.close();
      res.json(result);

    })

    //
    user = {
      "_id": sessionId,
      "lighthouseKeeper": false
    }
  } catch (e) {
    next(e)
  }
  return user;
}*/

