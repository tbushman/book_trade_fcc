var express = require('express');
var passport = require('passport');
var User = require('../models/user');
var multer  = require('multer');
var url = require('url');
var dotenv = require('dotenv');
var async = require("async");
var books = require('google-books-search');
var isbn = require('node-isbn-catalogue');
var router = express.Router();

var ObjectId = User.ObjectId;
var upload = multer();

dotenv.load();

var googleMapsClient = require('@google/maps').createClient({
	key: process.env.GOOGLE_KEY
});

var options = {
    key: process.env.GOOGLE_KEY,
    field: 'title',
    offset: 0,
    limit: 10,
    type: 'books',
    order: 'relevance',
    lang: 'en'
};


// test authentication middleware
function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) { 
		return next(); 
	}
	return res.redirect('/register');
}

/* GET home page. */
//displays all books in DB or user's most recent search, if authenticated
router.get('/', function(req, res, next) {
	
	if (req.isAuthenticated()) {
		//console.log(req.user._id)
		User.findOne({_id: req.user._id}, 'requestlist', function(err, requests){
			if (err) {
				return next(err)
			}
			if (!err && requests.requestlist.length === 0) {
				User.find({
				     coords:
				       { $near :
				          {
				            $geometry: { type: "Point",  coordinates: [ req.user.coords[0], req.user.coords[1] ] },
				            $minDistance: 0,
				            $maxDistance: 5000
				          }
				       }
				   }, 'books', function(err, docs){
					if (err) {
						return next(err);
					}
					return res.render('index', {
						user: req.user,
						request: null,
						data: docs
					})
				})
			} else {
				User.find({
				     coords:
				       { $near :
				          {
				            $geometry: { type: "Point",  coordinates: [ req.user.coords[0], req.user.coords[1] ] },
				            $minDistance: 0,
				            $maxDistance: 5000
				          }
				       }
				   }, 'books', function(err, docs){
					if (err) {
						return next(err);
					}
					var boolean_requests = [];
					for (var i in requests.requestlist) {
						if (requests.requestlist[i].accepted === false) {
							boolean_requests.push(requests.requestlist[i])
						}
					}
					return res.render('index', {
						user: req.user,
						request: boolean_requests.length,
						data: docs
					})
				})
				//alert user that another user has requested a book
			}
		})
	} else {
		User.find({}, 'books', function(err, docs){
			if (err) {
				return next(err);
			}
			return res.render('index', {
				user: req.user,
				request: null,
				data: docs
			})
		})
	}	
});

//register url contains search params if prompted to register via api request
//params saved to req.app.locals for redirect once user is authenticated
router.get('/register*', function(req, res, next) {
	var outputPath = url.parse(req.url).pathname;
	var search = outputPath.replace('/register/', '');
	var location = search.split('/')[1];
	var title = search.split('/')[0];
	req.app.locals.location = location.replace('%20', '');
	req.app.locals.title = title.replace('%20', '');
    return res.render('register', { 
	 	info: 'You need to be a registered user to list or request books for trade.'
	});
});

router.post('/register', upload.array(), function(req, res, next) {
	googleMapsClient.geocode({ address: req.body.location }, function(err, response) {
		if (err) {
			return res.render('register', {
				info: "Sorry. Could not find your City. Try again."
			});
		}
		
		var coords = [];
		coords.push(response.json.results[0].geometry.location.lng);
		coords.push(response.json.results[0].geometry.location.lat);
		User.register(new User({ username : req.body.username, location: req.body.location, email: req.body.email, coords: coords }), req.body.password, function(err, user) {
			if (err) {
				return res.render('register', {
					info: "Sorry. That username already exists. Try again."
				});
			}
			passport.authenticate('local')(req, res, function () {
				return res.redirect('/');
			});
	  	});
	});
});

router.get('/login', function(req, res, next){
	return res.render('login', { 
		user: req.user 
	});
});

router.post('/login', upload.array(), passport.authenticate('local'), function(req, res, next) {
	return res.redirect('/');
});

router.get('/logout', function(req, res, next){
	req.logout();
	return res.redirect('/');
});


//user page to display all user's books for trade and all books in wish-list
router.get('/user', ensureAuthenticated, function(req, res, next){
	User.find({_id: req.user._id}, 'requestlist', function(err, requests){
		if (err) {
			return next(err)
		}
		if (!err && requests[0] !== undefined) {
			console.log(requests)
			/*var book_requests = [];
			for (var i in requests) {
				console.log(requests[i].books)
				for (var j in requests[i].books) {
					book_requests.push(requests[i].books[j])
				}
			}*/
			User.findOne({_id: req.user._id}, function(err, user) {
				if(err) {
					return next(err);  // handle errors
			    } else {
					var books = user.books;
					var requestlist = user.requestlist;
					if (books.length > 0 || requestlist.length > 0 || user.wishlist.length > 0) {

						return res.render('user', {
							info: 'Your books',
							user: req.user,
							request: requests[0].requestlist,
							data: user
						});

					} else {
						return res.render('user', { 
							info: 'Your books list is empty. Add a book for trade!',
							user: req.user,
							request: requests[0].requestlist,
							data: []
						});
					}
			    }
			});
		} else {
			User.findOne({_id: req.user._id}, function(err, user) {
				if(err) {
					return next(err);  // handle errors
			    } else {
					var books = user.books;
					var requestlist = user.requestlist;
					if (books.length > 0 || requestlist.length > 0) {

						return res.render('user', {
							info: 'Your books',
							user: req.user,
							data: user
						});

					} else {
						return res.render('user', { 
							info: 'Your books list is empty. Add a book for trade!',
							user: req.user,
							data: []
						});
					}
			    }
			});
		}
	});
});


router.get('/add', ensureAuthenticated, function(req, res, next){
	User.findOne({_id: req.user._id}, function(err, user){
		if (err) {
			return next(err)
		}
		console.log(user)
		return res.render('add', {
			user: req.user,
			data: []
		})
	})
});

router.all('/api*', ensureAuthenticated);

router.get('/api/contact/:user_id', function(req, res, next){
	User.findOne({_id: req.params.user_id}, function(err, user){
		if (err) {
			return next(err)
		}
		console.log(user)
		return res.render('profile', {
			info: 'Contact the person requesting your book',
			user: req.user,
			data: user
		})
	})
})

//User wants to trade their book. Look up by title, return list for user to choose their edition from.
router.post('/api/add', function(req, res, next) {
	var title = req.body.title;
	var isbn_no = req.body.isbn;
	if (isbn_no) {
		isbn.resolve(''+isbn_no+'', function(err, book){
			if (err) {
				return next(err)
			}
			console.log(book.length)
			return res.render('add', { //??
				info: 'Is this your edition?',
				isbn: isbn_no,
				user: req.user,
				title: book.title,
				data: book
			});
		});
	} else {
		books.search(title, options, function (err, data) {
			if (err) {
				return next(err)
			}
			//console.log(data[0].industryIdentifiers[1])
			return res.render('add', { //??
				info: 'Which of these editions most closely matches yours?',
				user: req.user,
				title: title,
				data: data
			});
		});
	}
})


//User chooses their edition from list. Re-route to user profile after pushing to user books
router.post('/api/books/:isbn', function(req, res, next) {
	var isbn_no = req.params.isbn;
	isbn.resolve(''+isbn_no+'', function(err, book){
		if (err) {
			return next(err)
		}
		var title = book.title;
		var thumbnail = book.imageLinks.thumbnail;
		var location = req.user.location;
		console.log(location)
		var entry = {
			owner: req.user._id,
			title: title,
			location: location,
			isbn: isbn_no,
			thumbnail: thumbnail
		}
		User.find(
			{_id: req.user._id, books: {$elemMatch: entry} },
			function(error, data) {
				if (error) {
					return next(error);
				}
				if (data.length === 0) {
					User.findOneAndUpdate(
					{_id: req.user._id},
					{$push: {books: entry}},
					{safe: true, upsert: true},
					function(error, docs) {
						if (error) {
							return next(error);
						}
						return res.redirect('/user')
							
					})	
				} else {
					User.findOneAndUpdate(
					{_id: req.user._id},
					{$pull: {books: {$elemMatch: {isbn: isbn_no}} }},
					{multi: true},
					function(err, docs){
						if (err) {
							return next(err);
						}
						User.findOneAndUpdate(
						{_id: req.user._id},
						{$push: {books: entry}},
						{safe: true, upsert: true},
						function(error, docs) {
							if (error) {
								return next(error);
								}
								return res.redirect('/user')
						})							
					});
				}
		});	
	})
})

//from home page, user finds a book they want. They click the get link which redirects here, if auth
//add to user requestlist and redirect to user page which should display updated requestlist
router.post('/api/requestlist/:owner/:isbn/:location', function(req, res, next) {
	var isbn_no = req.params.isbn;
	var location = req.params.location;
	var owner = req.params.owner;
	isbn.resolve(''+isbn_no+'', function(err, book){
		if (err) {
			return next(err)
		}
		var title = book.title;
		var thumbnail = book.imageLinks.thumbnail;
		var entry = {
			requester: req.user._id,
			title: title,
			location: location,
			isbn: isbn_no,
			thumbnail: thumbnail,
			accepted: false
		}
		User.find(
		{_id: req.user._id, wishlist: {$elemMatch: {'wishlist.$.isbn': isbn_no}} }, 
		function(error, data) {
			if (error) {
				return next(error);
			}
			if (data.length === 0) {
				User.find(
				{_id: owner, requestlist: {$elemMatch: {'requestlist.$.isbn': isbn_no}} }, 
				function(error, data) {
					if (error) {
						return next(error);
					}
					if (data.length === 0) {
						User.findOneAndUpdate(
						{_id: owner}, 
						{$push: {requestlist: entry}}, 
						{safe: true, upsert: true}, 
						function(error, docs) {
							if (error) {
								return next(error);
							}
							User.findOneAndUpdate(
							{_id: req.user._id}, 
							{$push: {wishlist: entry}}, 
							{safe: true, upsert: true}, 
							function(err, data) {
								if (err) {
									return next(err)
								}
								return res.redirect('/user');
							});
						})		
					} else {
						return res.redirect('/user');
					}
				});
			} else {
				return res.redirect('/user');
			}						
		})
	})
})

router.post('/api/accept/:user_id/:isbn', function(req, res, next) {
	var requester = req.params.user_id;
	var isbn_no = req.params.isbn;
	/*User.findOneAndUpdate(
	{_id: ObjectId(''+requester+''), 'wishlist.isbn': isbn_no},
	
	{$set: {'wishlist.$.accepted': true}}*/
	var queryRequester = {'_id': requester, 'wishlist.isbn': isbn_no};
	var queryOwner = {'_id': req.user._id, 'requestlist.isbn': isbn_no};
	var setRequester = {$set: {}};
	var setOwner = {$set: {}};
	setRequester.$set['wishlist.$.accepted'] = true;
	setOwner.$set['requestlist.$.accepted'] = true;

	var options = { 
		//'overwrite': true, 
		//'new': true, 
		//'safe': true, 
		//'upsert': false, 
		//'multi': false 
		}
	
	User.findOneAndUpdate(
		queryRequester, 
		setRequester, 
		options,
		function(error, usr){
			if(error) {
				return next(error)
			}
			User.findOneAndUpdate(
				queryOwner, 
				setOwner, 
				options,
				function(error, docs){
					if(error) {
						return next(error)
					}
					User.findOneAndUpdate(
					{_id: req.user._id},
					{$pull: {books: {isbn: isbn_no}}},
					function(error, user) {
						if (error) {
							return next(error)
						}
						return res.render('user', {
							success: 'btn-success',
							requestor_email: user.email,
							requestor_name: user.username,
							user: req.user,
							request: docs.requestlist,
							data: docs
						})
					})
					
			});
	});	
})
router.delete('/api/reject/:user_id/:isbn', function(req, res, next) {
	var requester = req.params.user_id;
	var isbn_no = req.params.isbn;
	User.findOneAndUpdate(
	{_id: requester},
	{$pull: {wishlist: {isbn: isbn_no}}},
	function(err, docs){
		if (err) {
			return next(err)
		}
		User.findOneAndUpdate(
		{_id: req.user._id},
		{$pull: {requestlist: {isbn: isbn_no}}},
		function(err, docs){
			if (err) {
				return next(err)
			}
			return res.json('removed')
		})
	})
})
router.delete('/api/books/remove/:isbn', function(req, res, next) {
	var isbn_no = req.params.isbn;
	User.findOneAndUpdate(
	{_id: req.user._id},
	{$pull: {books: {isbn: isbn_no}}},
	function(err, docs){
		if (err) {
			return next(err)
		}
		return res.json('removed')
	})
})
router.delete('/api/wishlist/remove/:user_id/:isbn', function(req, res, next) {
	var owner = req.params.user_id;
	var isbn_no = req.params.isbn;
	User.findOneAndUpdate(
	{_id: req.user._id},
	{$pull: {wishlist: {isbn: isbn_no}}},
	function(err, docs){
		if (err) {
			return next(err)
		}
		User.findOneAndUpdate(
		{_id: owner},
		{$pull: {requestlist: {isbn: isbn_no}}},
		function(err, docs){
			if (err) {
				return next(err)
			}
			return res.json('removed')
		})
	})
})

module.exports = router;
