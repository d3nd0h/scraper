var Promise = require('bluebird');
var cheerio = require('cheerio');
var request = Promise.promisify(require('request'));

function getRequest(address, method) {
    return new Promise(function(resolve, reject) {
        request({
            method: method,
            url: address,
        }).then(function(body) {
            resolve(body);
        }).catch(function(err) {
            console.log(err);
        });
    });
}

getRequest(
    'http://m.bnizona.com/index.php/category/index/promo', 
    'GET'
    ).then(function(body) {
        // call promise to process main page
        return process(body);
    }).then(function(res) {
        // write output to file
        var fs = require('fs');
        fs.writeFile('result.json', JSON.stringify(res, null, 2));
    });

function process(body) {
    return new Promise(function(resolve, reject) {
        $ = cheerio.load(body.body, {
            normalizeWhitespace: true
        });

        var jsonResult = {};

        var functionList = [];
        var categories = [];

        // process each link
        $('a', 'ul.menu').each(function(index, element) {
            element = $(element);
            var href = element.attr('href');
            var category = cleanString(element.text());
            categories.push(category);
            jsonResult[category] = {};
            jsonResult[category]["link"] = href;
            functionList.push(getRequest(href, 'GET').then(function(body) {
                return processCategory(body);
            }));
        });

        // parallel scraping each subcategory
        Promise.all(functionList)
            .then(function(res) {
                // console.log(res);
                for(var i=0; i<res.length; i++) {
                    jsonResult[categories[i]]["subcategory"] = res[i];
                }
                resolve(jsonResult);
            })
    });
}

function cleanString(str) {
    return str.replace(/[^\w]/gi, '').toLowerCase();
}

function processCategory(body) {
    return new Promise(function(resolve, reject) {
        $ = cheerio.load(body.body, {
            normalizeWhitespace : true
        });
        var jsonResultCategory = [];

        var functionList = [];

        // process each link
        $('ul#lists').find('a').each(function(index, element) {
            var content = $(element);
            var temp = {};
            var target = $('ul#lists').find('a').length;
            temp = {
                link : $(this).attr('href'),
                img : $('img', content).attr('src'),
                merchant_name : $('span.merchant-name', content).text(),
                promo_title : $('span.promo-title', content).text(),
                valid_until : $('span.valid-until', content).text()
            };
            jsonResultCategory.push(temp);
            functionList.push(getDetails($(this).attr('href')));
        });

        // paralel scraping each subcategory details
        Promise.all(functionList)
            .then(function(res) {
                for(var i=0; i<res.length; i++) {
                    jsonResultCategory[i]["more_details"] = res[i];
                }
                return jsonResultCategory;
            }).then(function(res) {
                resolve(res);
            });
    });
}

function getDetails(url) {
    return new Promise(function(resolve, reject) {
        getRequest(
            url,
            'GET'
            ).then(function(body) {
                var details = {};
                $ = cheerio.load(body.body);
                // get banner
                details["banner"] = $('img', 'div.banner').attr('src');

                var menu = $('ul.menu').contents();
                // get merchant detail
                var merchant_detail = $('#merchant-detail', menu);
                details["merchant_detail"] = {};
                details["merchant_detail"]["title"] = $('h5', merchant_detail).text();
                details["merchant_detail"]["description"] = $('p', merchant_detail).text();

                // get merchant location
                var merchant_location = $('.content.merchant', menu);
                details["merchant_location"] = [];
                merchant_location.children().each(function() {
                    var temp;
                    if($(this).get(0).name == 'img')
                        temp = $(this).attr('src');
                    else
                        temp = $(this).text();
                    details["merchant_location"].push(temp);
                });
                return details;
            }).then(function(details) {
                resolve(details);
            });
    });
}
