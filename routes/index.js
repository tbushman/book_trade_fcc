var express = require('express');
var passport = require('passport');
var User = require('../models/user');
var multer  = require('multer');
var url = require('url');
var dotenv = require('dotenv');
var async = require("async");
var books = require('google-books-search');
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
	return res.redirect('/');
}

/* GET home page. */
router.get('/', function(req, res, next) {
	
	if (req.isAuthenticated()) {
		//console.log(req.user._id)
		User.findOne({_id: req.user._id}, function(err, docs){
			if (err) {
				return next(err);
			}
			var last_search = docs.searches[docs.searches.length-1];
			if (last_search === undefined) {
				return res.render('index', { 
					user: req.user,
					data: []
				});
			} else {
				var title = last_search.title;
				var location = last_search.location;
				return res.redirect('/api/'+title+'/'+location+'');
			}
		})
		
	} else {
		return res.render('index', { 
			user: req.user,
			data: []
		});
	}
	
});

router.get('/register*', function(req, res, next) {
    return res.render('register', { });
});

router.post('/register', upload.array(), function(req, res, next) {
	User.register(new User({ username : req.body.username }), req.body.password, function(err, user) {
		if (err) {
			return res.render('register', {info: "Sorry. That username already exists. Try again."});
		}
		passport.authenticate('local')(req, res, function () {
			return res.redirect('/');
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

router.get('/auth/twitter', passport.authenticate('twitter'), function(req, res, next){
	return next();
});

router.get('/auth/twitter/callback', passport.authenticate('twitter', { 
	failureRedirect: '/' 
}), function(req, res, next) {
	return res.redirect('/');
});

router.get('/logout', function(req, res, next){
	req.logout();
	return res.redirect('/');
});

router.get('/user', ensureAuthenticated, function(req, res, next){
	User.findOne({_id: req.user._id}, function(err, user) {
		if(err) {
			return next(err);  // handle errors
	    } else {
			var results = user.books;
			
			if (results.length > 0) {
				
				async.map(results, getBookInfo, function(err, result){
					//console.log(result) //array
					return res.render('user', {
						user: req.user,
						data: result
					});
				})

			} else {
				return res.render('user', { 
					user: req.user,
					data: []
				});
			}
	    }
	});
});

router.get('/search', function(req, res, next){
	return res.render('search', {
		user: req.user
	})
});

router.all('/api*', ensureAuthenticated);

router.get('/api/:title/:location', function(req, res, next) {
	var title = req.params.title;
	var location = req.params.location;
	books.search({ title: title, location: location }).then(function (data) {
		var results = data.businesses;
		
		async.map(results, getBookInfo, function(err, result){
			//console.log(result) //array
			return res.render('index', {
				user: req.user,
				title: title,
				location: location,
				data: result
			});
		})
	}).catch(function (err) {
		return next(err);
	});
});

router.post('/api/rsvp/:id', function(req, res, next){
	var books_id = req.params.id;
	var push_rsvp = {
		id: books_id
	}
	User.find(
		{_id: req.user._id, rsvp: {$elemMatch: push_rsvp} },
		function(error, data) {
			if (error) {
				return next(error);
			}
			if (data.length === 0) {
				User.findOneAndUpdate(
					{_id: req.user._id},
					{$push: {rsvp: push_rsvp}},
					{safe: true, upsert: true},
					function(err, docs){
						if (err) {
							return next(err);
						}
						User.find({rsvp: {$elemMatch: {id: books_id} } }, function(err, users){
							if (err) {
								return next(err);
							}
							var length = users.length;
							if (users.length === 0) {
								length = 0;
							}
							res.contentType('application/json');
							return res.json(length);
						});
					});
			} else {
				User.findOneAndUpdate(
					{_id: req.user._id},
					{$pull: {rsvp: {$elemMatch: {id: books_id}} }},
					{multi: true},
					function(err, docs){
						if (err) {
							return next(err);
						}
						//var rsvp = [];
						User.find({rsvp: {$elemMatch: {id: books_id} } }, function(err, users){
							if (err) {
								return next(err);
							}
							var length = users.length;
							if (users.length === 0) {
								length = 0;
							}
							res.contentType('application/json');
							return res.json(length);
						});
					})
				
			}
		}
	)
});

router.post('/search', upload.array(), function(req, res, next) {
	var title = req.body.title;
	var location = req.body.location;
	if (req.isAuthenticated()) {
		var push_search = {
			title: title,
			location: location
		};
		User.findOneAndUpdate(
			{_id: req.user._id},
			{$push:{searches: push_search}},
			{safe: true, upsert: false},
			function(err, docs) {
				//console.log(docs)
				if (err) {
					return next(err);
				}
				books.search({ title: title, location: location }, options).then(function (data) {
					var results = data.businesses;
					return res.render('index', {
						user: req.user,
						title: title,
						location: location,
						data: result
					});
				}).catch(function (err) {
					return next(err);
				});
				
			} 
		);
	} else {
		books.search({ title: title, location: location }, options).then(function (data) {
			var results = data.businesses;

			async.map(results, getBookInfo, function(err, result){
				//console.log(result) //array
				return res.render('index', {
					user: req.user,
					title: title,
					location: location,
					data: result
				});
			})
		}).catch(function (err) {
			return next(err);
		});
	}
});




module.exports = router;
