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

var upload = multer();

dotenv.load();

var options = {
    key: process.env.GBOOKS_KEY,
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
		User.findOne({_id: req.user._id}, function(err, docs){
			if (err) {
				return next(err);
			}
			var last_search = docs.wishlist[docs.wishlist.length-1];
			if (last_search === undefined) {
				User.find({}, 'books', function(er, docs) {
					if (er) {
						return next(er)
					}
					return res.render('index', {
						user: req.user,
						data: docs
					})
				})
			} else {
				var title = last_search.title;
				var location = last_search.location;
				return res.redirect('/api/'+title+'/'+location+'');
			}
		})
		
	} else {
		User.find({}, 'books', function(er, docs) {
			if (er) {
				return next(er)
			}
			return res.render('index', {
				user: null,
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
	User.register(new User({ username : req.body.username, location: req.body.location }), req.body.password, function(err, user) {
		if (err) {
			return res.render('register', {
				info: "Sorry. That username already exists. Try again."
			});
		}
		passport.authenticate('local')(req, res, function () {
			if (req.app.locals.title) {
				return res.redirect('/api/'+req.app.locals.title+'/'+req.app.locals.location+'');
			} else {
				return res.redirect('/');
			}
		});
  	});
});

router.get('/login', function(req, res, next){
	return res.render('login', { 
		user: req.user 
	});
});

router.post('/login', upload.array(), passport.authenticate('local'), function(req, res, next) {
	if (req.app.locals.title) {
		return res.redirect('/api/'+req.app.locals.title+'/'+req.app.locals.location+'');
	} else {
		return res.redirect('/');
	}
});

/*router.get('/auth/twitter', passport.authenticate('twitter'), function(req, res, next){
	return next();
});

router.get('/auth/twitter/callback', passport.authenticate('twitter', { 
	failureRedirect: '/' 
}), function(req, res, next) {
	if (req.app.locals.title) {
		return res.redirect('/api/'+req.app.locals.title+'/'+req.app.locals.location+'');
	} else {
		return res.redirect('/');
	}
});
*/
router.get('/logout', function(req, res, next){
	req.logout();
	return res.redirect('/');
});


//user page to display all user's books for trade and all books in wish-list
router.get('/user', ensureAuthenticated, function(req, res, next){
	User.findOne({_id: req.user._id}, function(err, user) {
		if(err) {
			return next(err);  // handle errors
	    } else {
			var results = user.books;
			
			if (results.length > 0) {
				
				return res.render('user', {
					info: 'Your books / wishlist',
					user: req.user,
					data: user
				});

			} else {
				return res.render('user', { 
					info: 'Your books / wishlist is empty. Add a book for trade!',
					user: req.user,
					data: []
				});
			}
	    }
	});
});

router.get('/add', function(req, res, next){
	return res.render('add', {
		user: req.user,
		data: []
	})
});

router.all('/api*', ensureAuthenticated);

router.get('/api/:param1/:param2', function(req, res, next){
	if (isNaN(req.params.param1)) {
		return res.redirect('/api/add')
	} else {
		var isbn = req.params.param1;
		var location = req.params.param2;
		return res.redirect('/api/wishlist/'+isbn+'/'+location)
	}
})

//User wants to trade their book. Look up by title, return list for user to choose their edition from.
router.post('/api/add', function(req, res, next) {
	var title = req.body.title;
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
})

/*router.get('/api/books/:isbn', function(req, res, next) {
	
})*/

//User chooses their edition from list. Display edition thumbnail and success upon DB entry.
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
							return res.json('book');
							/*User.find({_id: req.user._id}, function(er, docs) {
								if (er) {
									return next(er)
								}
								return res.render('user', {
									user: req.user,
									data: docs
								})
							})*/
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
							return res.json('removed');
						});
				}
		});	
	})
})

//from home page, user finds a book they want. They click the get link which redirects here, if auth
//or register with params if not authenticated
//add to user wishlist and redirect to user page which should display updated wishlist
router.post('/api/wishlist/:isbn/:location', function(req, res, next) {
	var isbn = req.params.isbn;
	var location = req.params.location;
	isbn.resolve(isbn, function(err, book){
		if (err) {
			return next(err)
		}
		var title = book.title;
		var thumbnail = book.imageLinks.thumbnail;
		var entry = {
			title: title,
			location: location,
			isbn: isbn,
			thumbnail: thumbnail
		}
		User.findOneAndUpdate(
			{_id: req.user._id},
			{$push: {wishlist: entry}},
			{safe: true, upsert: true},
			function(error, docs) {
				if (error) {
					return next(error);
				}
				return res.json('book');
			})		
	})
})



module.exports = router;
