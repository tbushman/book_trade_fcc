var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    passportLocalMongoose = require('passport-local-mongoose');

var User = new Schema({
	username: String,
	password: String,
	twitter: {
		oauthID: Number,
		name: String,
		created: Date
	},
	searches: [{
		title: String,
		isbn: Number,
		location: String
	}],
	books: [{
		title: String,
		isbn: Number,
		location: String
	}]
}, { collection: 'fcc_books' });

User.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', User);
