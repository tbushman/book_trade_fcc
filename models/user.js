var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    passportLocalMongoose = require('passport-local-mongoose');

var User = new Schema({
	username: String,
	password: String,
	location: String,
	wishlist: [{
		title: String,
		isbn: Number,
		location: String,
		thumbnail: String
	}],
	books: [{
		title: String,
		isbn: Number,
		location: String,
		thumbnail: String
	}]
}, { collection: 'fcc_books' });

User.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', User);
