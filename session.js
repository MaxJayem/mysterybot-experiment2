const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SessionSchema = new Schema({
    session : {
        type: String,
        required : true
    },
    query_text : {
        type : String,
    },
    lighthouse : {
        type: Boolean,
        default: false
    },
    shipAccident: {
        type: Boolean,
        default: false
    },
    tries : {
        type: Number,
        default: 0
    },
    false_tries: {
        type: Number,
        default: 0
    }
});
module.exports = mongoose.model('Session', SessionSchema);

