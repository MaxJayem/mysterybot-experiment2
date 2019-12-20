const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SessionSchema = new Schema({
    session : {
        type: String,
        required : true
    },
    query_text : {
        type : String,
    }
});
module.exports = mongoose.model('Session', SessionSchema);

