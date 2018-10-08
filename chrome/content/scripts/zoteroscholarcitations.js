if (typeof Zotero === 'undefined') {
    Zotero = {};
}
Zotero.ScholarCitations = {};


Zotero.ScholarCitations.init = function() {
    Zotero.ScholarCitations.resetState();

    stringBundle = document.getElementById('zoteroscholarcitations-bundle');
    Zotero.ScholarCitations.captchaString = 'Please enter the Captcha on the page that will now open and then re-try updating the citations, or wait a while to get unblocked by Google if the Captcha is not present.';
    Zotero.ScholarCitations.citedPrefixString = ''
        if (stringBundle != null) {
            Zotero.ScholarCitations.captchaString = stringBundle.getString('captchaString');
        }

    // Register the callback in Zotero as an item observer
    var notifierID = Zotero.Notifier.registerObserver(
            Zotero.ScholarCitations.notifierCallback, ['item']);

    // Unregister callback when the window closes (important to avoid a memory leak)
    window.addEventListener('unload', function(e) {
        Zotero.Notifier.unregisterObserver(notifierID);
    }, false);
};

Zotero.ScholarCitations.notifierCallback = {
    notify: function(event, type, ids, extraData) {
        if (event == 'add') {
            Zotero.ScholarCitations.updateItems(Zotero.Items.get(ids));
        }
    }
};

Zotero.ScholarCitations.resetState = function() {
    Zotero.ScholarCitations.current = -1;
    Zotero.ScholarCitations.toUpdate = 0;
    Zotero.ScholarCitations.itemsToUpdate = null;
    Zotero.ScholarCitations.numberOfUpdatedItems = 0;
};

Zotero.ScholarCitations.updateSelectedEntity = function(libraryId) {
    if (!ZoteroPane.canEdit()) {
        ZoteroPane.displayCannotEditLibraryMessage();
        return;
    }

    var collection = ZoteroPane.getSelectedCollection();
    var group = ZoteroPane.getSelectedGroup();

    if (collection) {
        var items = [];
        collection.getChildItems(false).forEach(function (item) {
            items.push(Zotero.Items.get(item.id));
        });
        Zotero.ScholarCitations.updateItems(items);
    } else if (group) {
        if (!group.editable) {
            alert("This group is not editable!");
            return;
        }
        var items = [];
        group.getCollections().forEach(function(collection) {
            collection.getChildItems(false).forEach(function(item) {
                items.push(Zotero.Items.get(item.id));
            })
        });
        Zotero.ScholarCitations.updateItems(items);
    } else {
        Zotero.ScholarCitations.updateAll();
    }
};

Zotero.ScholarCitations.updateSelectedItems = function() {
    Zotero.ScholarCitations.updateItems(ZoteroPane.getSelectedItems());
};

Zotero.ScholarCitations.updateAll = function() {
    var items = [];
    Zotero.Items.getAll().forEach(function (item) {
        if (item.isRegularItem() && !item.isCollection()) {
            var libraryId = item.getField('libraryID');
            if (libraryId == null ||
                    libraryId == '' ||
                    Zotero.Libraries.isEditable(libraryId)) {
                items.push(item);
            }
        }
    });
    Zotero.ScholarCitations.updateItems(items);
};

Zotero.ScholarCitations.updateItems = function(items) {
    if (items.length == 0 ||
            Zotero.ScholarCitations.numberOfUpdatedItems < Zotero.ScholarCitations.toUpdate) {
        return;
    }

    Zotero.ScholarCitations.resetState();
    Zotero.ScholarCitations.toUpdate = items.length;
    Zotero.ScholarCitations.itemsToUpdate = items;
    Zotero.ScholarCitations.updateNextItem();
};

Zotero.ScholarCitations.updateNextItem = function() {
    Zotero.ScholarCitations.numberOfUpdatedItems++;

    if (Zotero.ScholarCitations.current == Zotero.ScholarCitations.toUpdate - 1) {
        Zotero.ScholarCitations.resetState();
        return;
    }

    Zotero.ScholarCitations.current++;
    Zotero.ScholarCitations.updateItem(
            Zotero.ScholarCitations.itemsToUpdate[Zotero.ScholarCitations.current]);
};

Zotero.ScholarCitations.generateItemUrl = function(item) {
    var baseUrl = 'https://scholar.google.com/';
    var url = baseUrl +
        'scholar?hl=en&as_q=' +
        encodeURIComponent(item.getField('title')).replace(/ /g, '+') +
        '&as_occt=title&num=1';

    var creators = item.getCreators();
    if (creators.length > 0) {
        url += '&as_sauthors=' +
            encodeURIComponent(creators[0].lastName).replace(/ /g, '+');
    } else {
        var date = item.getField('date');
        if (date != '') {
            url += '&as_ylo=' + date + '&as_yhi=' + date;
        }
    }

    return url;
};

Zotero.ScholarCitations.updateItem = function(item) {
    var req = new XMLHttpRequest();
    var url = Zotero.ScholarCitations.generateItemUrl(item);
    req.open('GET', url, true);

    req.onreadystatechange = function() {
        if (req.readyState == 4) {
            if (req.status == 200 && req.responseText.search("www.google.com/recaptcha/api.js") == -1) {
                if (item.isRegularItem() && !item.isCollection()) {
                    var citations = Zotero.ScholarCitations.getCitationCount(
                            req.responseText);
                    try {
                        var old = item.getField('extra')
                            if (old.length == 0 || old.search(/^(\d{5}|No Citation Data)$/) != -1) {
                                item.setField('extra', citations);
                            } else if (old.search(/^(\d{5}|No Citation Data) *\n/) != -1) {
                                item.setField(
                                        'extra',
                                        old.replace(/^(\d{5}|No Citation Data) */, citations + ' '));
                            } else if (old.search(/^(\d{5}|No Citation Data) *[^\n]+/) != -1) {
                                item.setField(
                                        'extra',
                                        old.replace(/^(\d{5}|No Citation Data) */, citations + ' \n'));
                            } else if (old.search(/^(\d{5}|No Citation Data)/) != -1) {
                                item.setField(
                                        'extra',
                                        old.replace(/^(\d{5}|No Citation Data)/, citations));
                            } else {
                                item.setField('extra', citations + ' \n' + old);
                            }
                        item.save();
                    } catch (e) {}
                }
                Zotero.ScholarCitations.updateNextItem();
            } else if (req.status == 200 ||
                    req.status == 403 ||
                    req.status == 503) {
                alert(Zotero.ScholarCitations.captchaString);
                req2 = new XMLHttpRequest();
                req2.open('GET', url, true);
                req2.onreadystatechange = function() {
                    if (req2.readyState == 4) {
                        if (typeof Zotero.openInViewer !== 'undefined') {
                            Zotero.openInViewer(url);
                        } else if (typeof ZoteroStandalone !== 'undefined') {
                            ZoteroStandalone.openInViewer(url);
                        } else if (typeof Zotero.launchURL !== 'undefined') {
                            Zotero.launchURL(url);
                        } else {
                            window.gBrowser.loadOneTab(
                                    url, {inBackground: false});
                        }
                        Zotero.ScholarCitations.resetState();
                    }
                }
                req2.send(null);
            }
        }
    };

    req.send(null);
};

Zotero.ScholarCitations.fillZeros = function(number) {
    var output = '';
    var cnt = 5 - number.length;
    for (var i = 0; i < cnt; i++) {
        output += '0';
    }
    output += number;
    return output;
};

Zotero.ScholarCitations.getCitationCount = function(responseText) {
    if (responseText == '') {
        return 'No Citation Data';
    }

    var citeStringLength = 15;
    var lengthOfCiteByStr = 9;
    var citeArray = new Array();

    // 'gs_r gs_or gs_scl' is classes of each item element in search result
    var resultExists = responseText.match('gs_r gs_or gs_scl') ? true : false;

    var citeExists = responseText.search('Cited by');
    if (citeExists == -1) {
        if (resultExists)
            return '00000';
        else
            return 'No Citation Data';
    }

    var tmpString = responseText.substr(citeExists, citeStringLength);
    var end = tmpString.indexOf('<') - lengthOfCiteByStr;
    return Zotero.ScholarCitations.fillZeros(
            tmpString.substr(lengthOfCiteByStr, end));
};

if (typeof window !== 'undefined') {
    window.addEventListener('load', function(e) {
        Zotero.ScholarCitations.init();
    }, false);
}

module.exports = Zotero.ScholarCitations;
