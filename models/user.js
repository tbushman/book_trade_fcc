var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    passportLocalMongoose = require('passport-local-mongoose');

var User = new Schema({
	username: String,
	password: String,
	location: String,
	email: String,
	coords: [],
	wishlist: [{
		owner: String,
		title: String,
		isbn: String,
		location: String,
		thumbnail: String,
		accepted: Boolean
	}],
	requestlist: [{
		requester: String,
		title: String,
		isbn: String,
		location: String,
		thumbnail: String,
		accepted: Boolean
	}],
	books: [{
		owner: String,
		title: String,
		isbn: String,
		location: String,
		thumbnail: String
	}]
}, { collection: 'fcc_books' });

User.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', User);
