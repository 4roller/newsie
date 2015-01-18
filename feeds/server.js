var newsieFeedService = (function() {

	// Requrires
	var fs = require('fs');
	var http = require('http');
	var url = require('url') ;
	var request = require('request');
	var xml2js = require('xml2js').parseString;
	var Promise = require('promise');

	var SERVER_PORT = 3333; 

	// Developer Keys
	var keys = {
		'nyt': '?api-key=e522ecbee0e8e8c5cdd1bfc341d76cef:6:67368943'
	}

	// Maos for Source and Topic end points
	var sources = {
		'lat': {
			'feed': 'http://www.latimes.com/$topic/rss2.0.xml',
			'topics': {
        		'World': 'world',
        		'Business': 'business',
        		'Nation': 'nation',
        		"Real Estate": 'business/realestate',
        		"Science": 'science',
        		"Technology": 'business/technology',
	        	'Entertainment': 'entertainment',
	        	'Transportation': 'local/transportation',
        		'Lifestyle': 'style',
	        	'Travel': 'travel',
        		'Sports': 'sports',
            	'Opinion': 'opinion',
        		'Health': 'health',
        		'Local': 'local',
        		"Food": 'food',
        		'Health': 'health',
        		'Westside': 'local/westside'
			}
		},		
		'nyt': {
			'feed': 'http://api.nytimes.com/svc/news/v3/content/all/$topic/',
			'topics': {
				'Top Stories': 'all',
        		'World': 'world',
        		'Business': 'business',
	        	'Arts': 'arts',
	        	'Technology': 'technology',
            	'Science': 'science',
        		'Style': 'style',
	        	'Travel': 'travel',
        		'Sports': 'sports',
            	'Opinion': 'opinion',
        		'Health': 'health'
			}
		},
		'bbc': {
			'feed': 'http://feeds.bbci.co.uk/news/$topic/rss.xml',
			'topics': {
		        'Top Stories': '',
		        'World': 'world',
				'Business': 'business',
		     	'Politics':	'politics',
		        'Health': 'health',
		        'Education': 'education',
		        'Science': 'science_and_environment',
		        'Technology': 'technology',
		        'Entertainment': 'entertainment_and_arts' 
			}
		},
		'reuters': {
			'feed': 'http://www.reuters.com/rssFeed/$topic',
			'topics': {
				'Top Stories': 'topNews',
				'World': 'worldNews',
            	'US': 'domestichNews',
            	'Business': 'businessNews',
            	'Oddly Enough': 'oddlyEnoughNews',
        		'Politics': 'politicsNews',
        		'Health': 'healthNews',
        		'Sports': 'sportsNews',
        		'Science': 'scienceNews',
        		'Internet': 'internetNews',
        		'Technology': 'technologyNews',
        		'Entertainment': 'entertainmentNews'
			}
		},
		'npr': {
			'feed': 'http://www.npr.org/rss/rss.php?id=$topic',
			'topics': {
		        'Top Stories': '1001',
		        'World': '1004',
		        'US': '1003',
				'Business': '1006',
		     	'People':	'1023',
		        'Health and Science': '1007',
		        'Technology': '1019',
		        'Food': '1053'
			}
		}
	}


	var mapNYT = function(obj) {
		var getMedia = function() {
			var media = null;
			if(obj['multimedia']) {
				media = obj['multimedia'][0]['url'];
			}
			return media;
		}
		return {
			'title': obj['title'],
			'date': obj['published_date'],
			'description': obj['abstract'],
			'media': getMedia(),
			'link': obj['url'],
			'subsection': obj['subsection']
		}
	}
	var mapLAT = function(obj) {
		var getMedia = function() {
			var media = null;
			if(obj['media:thumbnail']) {
				media = obj['media:thumbnail'][0]['$']['url'] + "/75/75x75";
			}
			return media;
		}
		return {
			'title': obj['title'],
			'date': obj['pubDate'],
			'description': obj['description'],
			'media': getMedia(),
			'link': obj['link']
		}
	}

	var mapBBC = function(obj) {
		var getMedia = function() {
			var media = null;
			if(obj['media:thumbnail']) {
				media = obj['media:thumbnail'][0]['$']['url'];
			}
			return media;
		}
		return {
			'title': obj['title'],
			'date': obj['pubDate'],
			'description': obj['description'],
			'media': getMedia(),
			'link': obj['link']
		}
	}

	var mapNPR = function(obj) {
		return {
			'title': obj['title'],
			'date': obj['pubDate'],
			'description': obj['description'],
			//'media': obj['media:thumbnail'][0]['$']['url'],
			'link': obj['link']
		}
	}

	var mapReuters = function(obj) {
		return {
			'title': obj['title'],
			'date': obj['pubDate'],
			'description': obj['description'],
			//'media': obj['media:thumbnail'][0]['$']['url'],
			'link': obj['link']
		}
	}

	var normalizeArticles = function(rawObj, source) {
		var promise = new Promise(function(resolve, reject) {
			var handlerObj = {}
			var articles = [];
			switch(source) {
				case 'nyt':
					handlerObj = {
						'results': JSON.parse(rawObj).results,
						'mapFn': mapNYT
					}
					break;
				case 'lat':
					handlerObj = {
						'results': rawObj['rss']['channel'][0]['item'],
						'mapFn': mapLAT
					}
					break;
				case 'bbc':
					handlerObj = {
						'results': rawObj['rss']['channel'][0]['item'],
						'mapFn': mapBBC
					}
					break;
				case 'npr':
					handlerObj = {
						'results': rawObj['rss']['channel'][0]['item'],
						'mapFn': mapNPR
					}
					break;
				case 'reuters':
					handlerObj = {
						'results': rawObj['rss']['channel'][0]['item'],
						'mapFn': mapReuters
					}
					break;
			}
			for(var i=0, length = handlerObj['results'].length; i < length; i++) {
				articles.push(handlerObj.mapFn(handlerObj.results[i]))
			}
			var obj = {
				'result': articles
			}
			//console.log(obj);
			resolve(obj);
		});
		return promise;
	}

	var fetchStream = function(url, source, res) {
		var options = {
			"url": url,
			"headers": {
				'User-Agent': 'node server'
			}
		}
		request(options, function (error, response, body) {
  			if (!error && response.statusCode == 200) {
  				var cType = response['caseless']['dict']['content-type'];
  				// Soruce returned JSON
  				if(cType.indexOf('json') > -1) {
  					var jsonObj = body;
  					normalizeArticles(body, source).then(function(result) {
  						res.writeHead(200, {
							'Content-Type':  'application/json'
						});
						res.end(JSON.stringify(result));
  					});
  				} 
  				// Source returned XML
  				else if(cType.indexOf('xml') > -1) {
	    			xml2js(body, function (err, jsonObj) {
	    				normalizeArticles(jsonObj, source).then(function(result){
		    				res.writeHead(200, {
								'Content-Type':  'application/json'
							});
							//res.end('1111');
		   					res.end(JSON.stringify(result));
	    				});
					});
  				}
  			}
		});
	}


	var startServer = function() {
		http.createServer(function (req, res) {
			var queryObject = url.parse(req.url,true).query;

			// Handle Source and Topic Fetch because there are query params
			if(queryObject.source && queryObject.topic) {
				// Create a url
				var someURL = sources[queryObject.source].feed.replace('$topic', sources[queryObject.source].topics[queryObject.topic]);
				if(queryObject.source == 'nyt') {
					someURL += keys['nyt'];
				}			
				console.log(someURL)
				fetchStream(someURL, queryObject.source, res);			
			} else { // Send the Sources as a JSON object
				res.writeHead(200, {
					'Content-Type':  'application/json'
				});
				res.write(JSON.stringify(sources));
				res.end();
			}
		}).listen(SERVER_PORT);
	}

	return {
		init: function() {
			console.log('newsie feed server started on ' + SERVER_PORT);
			startServer();
		}
	}

})();
newsieFeedService.init();








