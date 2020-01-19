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



;
mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true, useCreateIndex: true});
/*
restService.listen(process.env.PORT || 8000, function () {
    console.log("Server up and listening");
});
*/

mongoose.connect('mongodb://localhost:27017/mysterybot', {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true
});
mongoose.set('useFindAndModify', false);


restService.post("/add", function (req, res) {
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


restService.post("/dialogflow_request", async (req, res, next) => {
    //Handles request from Dialogflow
    //Returns Dialogflow Response

    try {
        let session = await getSessionById(req.body.session);
        //console.log(session)

        session.tries++;


        if (req.body.queryResult.action == 'anyText') {

            let newEntitiesMentioned = await getNewEntitiesMentioned(req, session);

            console.log("new entities mentioned " +newEntitiesMentioned)
            let oldEntitiesMentioned = await getOldEntitiesMentioned(req)

            session = await updateSessionEntities(session, newEntitiesMentioned);
            //Solving process bestimmen
            let solvingProcess = await checkSolvingProcess(session);

            // CASE 1:  GAME OVER: ALL ENTITES SOLVED

            if (solvingProcess == 5) {
                const newSession = await Session.findOneAndUpdate({_id: session._id}, {$set: session}).exec();
                console.log(solvingProcess)
                return agentAnswers(getGameOver(), res);
            }


            // CASE 2:  NEW ENTITIES MENTIONED

            if (newEntitiesMentioned.length > 0) {

                //Neue Entitäten der session hinzufügen
                const newSession = await Session.findOneAndUpdate({_id: session._id}, {$set: session}).exec();

                //Antwort zusammenbauen
                return agentAnswers(await getPositiveFeedback() + await getSolvedEntityString(newEntitiesMentioned) + await getSolvingProcessAnswerString(solvingProcess), res);

            }
            if (oldEntitiesMentioned.length > 0) {

            // CASE 3:  OLD ENTITIES MENTIONED

                return agentAnswers(await getSolvedEntityString(oldEntitiesMentioned) + "Dies hast jedoch du bereits gesagt. " + await getSolvingProcessAnswerString(solvingProcess), res);

            } else {

                // CASE 4:  NO ENTITIES AT ALL MANTIONED

                // Keine  Entitäten erkannt
                // Fallback intent
                session.false_tries++;


                if (session.false_tries >= 4) {
                    //give hint
                    session.false_tries = 0;
                    const newSession = await Session.findOneAndUpdate({_id: session._id}, {$set: session}).exec();
                    return agentAnswers(await getHint(newSession), res);
                } else {
                    //return fallback
                    const newSession = await Session.findOneAndUpdate({_id: session._id}, {$set: session}).exec();
                    return agentAnswers(await getNegativeFeedback(), res);
                }
            }

        }
        if (req.body.queryResult.action == 'hint') {
            session.false_tries = 0;
            const newSession = await Session.findOneAndUpdate({_id: session._id}, {$set: session}).exec();
            return agentAnswers(await getHint(session), res);
        }
        if (req.body.queryResult.action == 'delete_session') {
            Session.findByIdAndRemove(req.body.session, (err, session) => {
                if (err) {return agentAnswers("Error in Deleting mongo data", res)}
                else {
                    return agentAnswers("Session wurde gelöscht", res)
                }
            })
        }


        else {

            const newSession = await Session.findOneAndUpdate({_id: session._id}, {$set: session}).exec();
            return agentAnswers("Intent noch nicht umgesetzt", res);
        }


    } catch (err) {
        //Todo: Fehlerantwort an Nutzer zurückgeben
        agentAnswers("Ein unerwarteter Fehler ist passiert.", res)
        console.log(err)
    }

    //console.log(req);

    //Get new entities

    //console.log(newEntitiesMentioned)

});


function getGameOver() {
    return "Gratulation! Du hast es geschafft!"
}

async function getHint(session) {
    //TODO: Hintlogik neu
    if (session.lighthouse == false) {
        return "Du brauchst also einen Tipp. Bei dem Haus handelt es sich nicht um ein gewöhnliches Haus."
    }
    if (session.forgot == false) {
        return "Etwas Hilfe für dich: Was war mit dem Licht?"
    }
    if (session.news == false) {
        return ("Tipp: Was lief im Radio?")
    }
    if (session.shipAccident == false) {
        return "Hier ein kleiner Tipp: Denke doch einmal daran, was der Mann im Radio gehört haben könnte."
    }
    if (session.responsible == false) {
        return "Warum hat er sich umgebracht?"
    } else {
        return "Kein Hint möglich"
    }
}


async function updateSessionEntities(session, entitiesSolved) {
    for (let i = 0; i < entitiesSolved.length; i++) {
        if (entitiesSolved[i] == "leuchtturm") session.lighthouse = true;
        if (entitiesSolved[i] == "nachrichten") session.news = true;
        if (entitiesSolved[i] == "vergessen") session.forgot = true;
        if (entitiesSolved[i] == "schuld") session.responsible = true;
        if (entitiesSolved[i] == "schiffsunglueck") session.shipAccident = true;
    }

    return session;
}

async function checkSolvingProcess(session) {
    //Sollte nach dem update des session objekts aufgerufen werden
    let count = 0;

    if (session.lighthouse) count++;
    if (session.news) count++;
    if (session.forgot) count++;
    if (session.responsible) count++;
    if (session.shipAccident) count++;
    console.log("SOLVING PROCESS COUNT: " + count)
    return count;
}

async function getSolvedEntityString(solvedEntities) {
    // solved Entities is an array of minimum length 1

    switch (solvedEntities.length) {
        case 1:
            return await getSingleSolvedEntityString(solvedEntities[0])
            break;
        case 2:
            return await getFirstSolvedEntityString(solvedEntities[0])
                + await getAnotherSolvedEntityString(solvedEntities[1]);
            break;
        case 3:
            return await getFirstSolvedEntityString(solvedEntities[0])
                + await getAnotherSolvedEntityString(solvedEntities[1])
                + await getAnotherSolvedEntityString(solvedEntities[2])
            break;

        case 4:
            return await getFirstSolvedEntityString(solvedEntities[0])
                + await getAnotherSolvedEntityString(solvedEntities[1])
                + await getAnotherSolvedEntityString(solvedEntities[2])
                + await getAnotherSolvedEntityString(solvedEntities[3])
            break;

        case 5:
            return await getFirstSolvedEntityString(solvedEntities[0])
                + await getAnotherSolvedEntityString(solvedEntities[1])
                + await getAnotherSolvedEntityString(solvedEntities[2])
                + await getAnotherSolvedEntityString(solvedEntities[3])
                + await getAnotherSolvedEntityString(solvedEntities[4])
            break;
    }


}


async function getSingleSolvedEntityString(solved_entity) {
    let lighthouse_solved = "Das Haus ist alles andere als ein gewöhnliches.. Der Mann wohnt in einem Leuchtturm! ";
    let news_solved = "Im Radio lief ein Nachrichtensender, der etwas wichtiges zu berichten hatte! Was war passiert? ";
    let shipAcciddent_solved = "Auf dem Meer nahe der Küste hat es ein Schiffsunglück gegeben! ";
    let responsible_solved = "Der Mann fühlte sich für irgendetwas schuldig... "
    let forgot_solved = "Normalerweise hatte er das Licht immer angestellt, doch in dieser Nacht vergaß er es! ";
    let nothing_solved = "Ist das etwa alles was dir einfällt? Wir haben hier schließlich ein Rätsel zu lösen... ";

    switch (solved_entity) {
        case "nachrichten":
            return news_solved;
            break;
        case "leuchtturm":
            return lighthouse_solved;
            break;
        case "schiffsunglueck":
            return shipAcciddent_solved;
            break;
        case "schuld":
            return responsible_solved;
            break;
        case "vergessen":
            return forgot_solved;
        default:
            return nothing_solved;
            break;
    }
}

async function getAnotherSolvedEntityString(solved_entity) {
    let lighthouse_solved = "und du hast damit Recht, dass er in einem Leuchtturm wohnt! ";
    let news_solved = "und im Radio lief ein Nachrichtensender, der etwas wichtiges zu berichten hatte! ";
    let shippingAcciddent_solved = "und in der Nacht hat es ein schreckliches Schiffsunglück gegeben. ";
    let responsible_solved = "und der Mann muss sich wirklich geschämt haben! Er fühlte sich schuldig für etwas.  "
    let forgot_solved = "und außerdem hat er vergessen das Licht anzuschalten. ";
    let nothing_solved = "Ist das etwa alles was dir einfällt? Wir haben hier schließlich ein Rätsel zu lösen...";

    switch (solved_entity) {
        case "nachrichten":
            return news_solved;
            break;
        case "leuchtturm":
            return lighthouse_solved;
            break;
        case "schiffsunglueck":
            return shippingAcciddent_solved;
            break;
        case "schuld":
            return responsible_solved;
            break;
        case "vergessen":
            return forgot_solved;
        default:
            return nothing_solved;
            break;
    }
}

async function getFirstSolvedEntityString (solved_entity) {
    let lighthouse_solved = "Das Haus ist alles andere als ein gewöhnliches.. Der Mann wohnt in einem Leuchtturm ";
    let news_solved = "Im Radio lief ein Nachrichtensender, der etwas wichtiges zu berichten hatte ";
    let shipAcciddent_solved = "Auf dem Meer nahe der Küste hat es ein furchtbares Schiffsunglück gegeben ";
    let responsible_solved = "Der Mann fühlte sich für irgendetwas schuldig "
    let forgot_solved = "Er hatte vergessen, den Lichtschalter zu betätigen ";
    let nothing_solved = "Ist das etwa alles was dir einfällt? Wir haben hier schließlich ein Rätsel zu lösen ";

    switch (solved_entity) {
        case "nachrichten":
            return news_solved;
            break;
        case "leuchtturm":
            return lighthouse_solved;
            break;
        case "schiffsunglueck":
            return shipAcciddent_solved;
            break;
        case "schuld":
            return responsible_solved;
            break;
        case "vergessen":
            return forgot_solved;
        default:
            return nothing_solved;
            break;
    }
}

async function getSolvingProcessAnswerString(count) {

    let answerString = "";

    if (Math.random() > 0.5) {
        switch (count) {
            case 0:
                answerString = ""
                break;
            case 1:
                answerString = "Du hast bereits ein wichtiges Detail herausgefunden! "
                break;
            case 2:
                answerString = "Weiter so! Jetzt hast du schon zwei wichtige Details herausgefunden! "
                break;
            case 3:
                answerString = "Bravo! Du kommst der Lösung immer näher! "
                break;
            case 4:
                answerString = "Das Puzzle ist beinahe komplett! Nur noch ein letztes Detail! "
                break;
            case 5:
                answerString = "Gut! Du hast alle wichtigen Details herausgefunden! "
                break;
            default:
                break;
        }
    }


    return answerString;
}

async function getNewEntitiesMentioned(request, session) {
    let parameters = request.body.queryResult.parameters;
    Promise.resolve(parameters);

    let ret = [];

    if (parameters.hasOwnProperty('leuchtturm')
        && parameters.leuchtturm
        && !session.lighthouse) {
        console.log("1. Leuchtturm erraten!")
        ret.push("leuchtturm")
    }

    if (parameters.hasOwnProperty('nachrichten')
        && parameters.nachrichten
        && !session.news) {
        console.log("2. News erraten!")
        ret.push("nachrichten")
    }

    if (parameters.hasOwnProperty('schiffsunglueck')
        && parameters.schiffsunglueck
        && !session.shipAccident) {
        console.log("3. Schiffsunfall erraten!")
        ret.push("schiffsunglueck")
    }

    if (parameters.hasOwnProperty('vergessen')
        && parameters.vergessen
        && !session.forgot) {
        console.log("4. Licht vergessen erraten!")
        ret.push("vergessen")
    }

    if (parameters.hasOwnProperty('schuld')
        && parameters.schuld
        && !session.schuld) {
        console.log("5. Schuld erraten!")
        ret.push("schuld")
    }
    return ret;
}

async function getOldEntitiesMentioned(request) {
    let parameters = request.body.queryResult.parameters;
    Promise.resolve(parameters);

    let ret = [];

    if (parameters.hasOwnProperty('leuchtturm')
        && parameters.leuchtturm) {
        ret.push("leuchtturm")
    }

    if (parameters.hasOwnProperty('nachrichten')
        && parameters.nachrichten) {
        ret.push("nachrichten")
    }

    if (parameters.hasOwnProperty('schiffsunglueck')
        && parameters.schiffsunglueck) {
        ret.push("schiffsunglueck")
    }

    if (parameters.hasOwnProperty('vergessen')
        && parameters.vergessen) {
        ret.push("vergessen")
    }

    if (parameters.hasOwnProperty('schuld')
        && parameters.schuld) {
        ret.push("schuld")
    }
    return ret;
}

async function getPositiveFeedback() {
    let rdm = Math.random();

    if (rdm > 0.75) {
        return "Genau richtig! "
    } else if (rdm> 0.5) {
        return "Spitze! "
    } else if (rdm > 0.25) {
        return "Klasse - das stimmt! "
    } else {
        return "Sehr gut! "
    }



}

async function getNegativeFeedback() {
    let rdm = Math.random();

    if (rdm > 0.75) {
        return "Da hab ich leider keine Antowort drauf - ist aber auch nicht so wichtig.."
    } else if (rdm> 0.5) {
        return "Darauf fällt mir keine Antowort ein."
    } else if (rdm > 0.25) {
        return "Da musst du jemand anderen Fragen.."
    } else {
        return "Das weiß ich nicht. Frag nochmal anders!"
    }



}

async function getSession(ses) {
    try {
        const session = await Session.findOne({session: ses}).exec();
        if (session) {
            return session;
        } else {
            const newSes = new Session({
                session: ses

            });
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

async function getSessionById(sessionId) {
    try {
        const session = await Session.findOne({_id: sessionId}).exec();
        if (session) {
            return session;
        } else {
            const newSes = new Session({
                _id: sessionId

            });
            newSes.save(function (err, newSes) {
                if (err) {
                    console.log(err);
                } else {
                    return newSes;
                }
            })
            return newSes;
        }
    } catch (err) {
        console.log(err);
    }

}

async function agentAnswers(answer, res) {

    var speechResponse = {
        google: {
            expectUserResponse: true,
            richResponse: {
                items: [
                    {
                        simpleResponse: {
                            textToSpeech: answer
                        }
                    }
                ]
            }
        }
    };

    return res.json({
        fulfillmentText: answer,
        payload: speechResponse,
        source: "webhook-echo-sample"
    });
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

