var cheerio = require('cheerio');

function getRequest(address, method, callback) {
    var request = require('request');
    request({
        method : method,
        url: address
    }, function(err, response, body) {
        if(err) {
            console.log(err);
            return callback(err);
        }
        return callback(null, body);
    });
}

getRequest(
    'http://m.bnizona.com/index.php/category/index/promo', 
    'GET', 
    function(err, body) {
        if(!err) {
            process(body);
        }
    });

var jsonResult = {};

function process(body) {
    $ = cheerio.load(body, {
        normalizeWhitespace: true
    });

    var cnt = 0;
    $('a', 'ul.menu').each(function(index, element) {
        cnt++; var target = $('a', 'ul.menu').length;
        element = $(element);
        var href = element.attr('href');
        var category = cleanString(element.text());
        jsonResult[category] = {};
        jsonResult[category]["link"] = href;
        getRequest(
            href,
            'GET',
            function(err, body) {
                if(!err)
                    processCategory(body, function(result) {
                        jsonResult[category]["subcategories"] = result;
                        if(cnt == target) {
                            var fs = require('fs');
                            fs.writeFile('result.json', JSON.stringify(jsonResult, null, 4));
                        }
                    });
            });
    });
    var fs = require('fs');
    fs.writeFile('result.json', JSON.stringify(jsonResult, null, 4));
}

function cleanString(str) {
    return str.replace(/[^\w]/gi, '').toLowerCase();
}

function processCategory(body, callback) {
    $ = cheerio.load(body, {
        normalizeWhitespace : true
    });
    var jsonResultCategory = [];

    var cnt = 0;

    $('ul#lists').find('a').each(function(index, element) {
        var content = $(element);
        var temp = {};
        ++cnt;
        var target = $('ul#lists').find('a').length;
        temp = {
            link : $(this).attr('href'),
            img : $('img', content).attr('src'),
            merchant_name : $('span.merchant-name', content).text(),
            promo_title : $('span.promo-title', content).text(),
            valid_until : $('span.valid-until', content).text()
        };
        getDetails($(this).attr('href'), function(details) {
            temp["more_details"] = details;
            jsonResultCategory.push(temp);

            if (cnt == target) {
                return callback(jsonResultCategory);
            }
        })
    });
}

function getDetails(url, callback) {
    var details = {};
    getRequest(
        url,
        'GET',
        function(err, body) {
            if(!err) {
                $ = cheerio.load(body);
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
            }
            return callback(details);
        });
}
