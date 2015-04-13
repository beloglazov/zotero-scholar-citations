var zsc = require('../chrome/content/scripts/zoteroscholarcitations.js');
var assert = require('assert');
var sinon = require('sinon');
var request = require('sync-request');

var items = [
{
    'citations': 400,
    'title': 'Energy-aware resource allocation heuristics for efficient management of data centers for cloud computing',
    'date': '2012',
    'creators': [{
        'ref': {
            'firstName': 'Anton',
            'lastName': 'Beloglazov'
        }
    }, {
        'ref': {
            'firstName': 'Jemal',
            'lastName': 'Abawajy'
        }
    }, {
        'ref': {
            'firstName': 'Rajkumar',
            'lastName': 'Buyya'
        }
    }]
},
{
    'citations': 50,
    'title': 'Optimal value of information in graphical models',
    'date': '2009',
    'creators': [{
        'ref': {
            'firstName': 'Carlos',
            'lastName': 'Guestrin',
        }
    }, {
        'ref': {
            'firstName': 'CMU',
            'lastName': 'EDU',
        }
    }]
}];


function createMockItem(item) {
    var mock = {
        citations: item.citations,
        getField: sinon.stub(),
        getCreators: sinon.stub()
    };
    mock.getField.withArgs('title').returns(item.title);
    mock.getField.withArgs('date').returns(item.date);
    mock.getCreators.returns(item.creators);
    return mock;
}

function fetchCitations(item) {
    var url = zsc.generateItemUrl(item);
    var res = request('GET', url);
    var content = res.body.toString('utf-8');
    return parseInt(zsc.getCitationCount(content));
}


suite('Zotero Scholar Citations', function() {
    this.timeout(0);

    test('fillZeros', function() {
        assert.equal(zsc.fillZeros(''), '00000');
        assert.equal(zsc.fillZeros('1'), '00001');
        assert.equal(zsc.fillZeros('32'), '00032');
    });

    test('fetchCitations', function() {
        items.forEach(function (item) {
            var mock = createMockItem(item);
            assert(fetchCitations(mock) > mock.citations);
        });
    });


});

