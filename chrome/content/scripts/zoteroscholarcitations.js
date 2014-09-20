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
    var notifierID = Zotero.Notifier.registerObserver(Zotero.ScholarCitations.notifierCallback, ['item']);

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
    Zotero.ScholarCitations.delay = false;
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
        var _items = collection.getChildren(true, false, 'item');
        for each(var item in _items) {
            items.push(Zotero.Items.get(item.id));
        }
        Zotero.ScholarCitations.updateItems(items);
    } else if (group) {
        if (!group.editable) {
            alert("This group is not editable!");
            return;
        }
        var collections = group.getCollections();
        var items = [];
        for each(collection in collections) {
            var _items = collection.getChildren(true, false, 'item');
            for each(var item in _items) {
                items.push(Zotero.Items.get(item.id));
            }
        }
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
    var _items = Zotero.Items.getAll();
    for each(var item in _items) {
        if (item.isRegularItem() && !item.isCollection()) {
            var libraryId = item.getField('libraryID');
            if (libraryId == null || libraryId == '' || Zotero.Libraries.isEditable(libraryId)) {
                items.push(item);
            }
        }
    }
    Zotero.ScholarCitations.updateItems(items);
};

Zotero.ScholarCitations.updateItems = function(items) {
    if (items.length == 0 || Zotero.ScholarCitations.numberOfUpdatedItems < Zotero.ScholarCitations.toUpdate) {
        return;
    }

    Zotero.ScholarCitations.resetState();
    Zotero.ScholarCitations.toUpdate = items.length;
    Zotero.ScholarCitations.itemsToUpdate = items;
    Zotero.ScholarCitations.updateNextItem();
};

Zotero.ScholarCitations.updateNextItem = function() {
    if (!Zotero.ScholarCitations.delay &&
            Zotero.ScholarCitations.numberOfUpdatedItems > 0 &&
            Zotero.ScholarCitations.numberOfUpdatedItems % 50 == 0) {
        // 60 seconds delay after every 50 items
        Zotero.ScholarCitations.delay = true;
        setTimeout(Zotero.ScholarCitations.updateNextItem, 60000);
        return;
    }
    Zotero.ScholarCitations.delay = false;
    Zotero.ScholarCitations.numberOfUpdatedItems++;

    if (Zotero.ScholarCitations.current == Zotero.ScholarCitations.toUpdate - 1) {
        Zotero.ScholarCitations.resetState();
        return;
    }

    Zotero.ScholarCitations.current++;
    Zotero.ScholarCitations.updateItem(Zotero.ScholarCitations.itemsToUpdate[Zotero.ScholarCitations.current]);
};

Zotero.ScholarCitations.updateItem = function(item) {
    if (typeof item.attachmentHash !== 'undefined') {
        Zotero.ScholarCitations.updateNextItem();
        return;
    }
    var baseUrl = 'http://scholar.google.com/';
    var url = baseUrl + 'scholar?hl=en&as_q=' + encodeURIComponent(item.getField('title')).replace(/ /g, '+') + '&as_occt=title&num=1';

    var date = item.getField('date');
    if (date != '') {
        url += '&as_ylo=' + date + '&as_yhi=' + date;
    }

    var creators = item.getCreators();
    if (creators.length > 0) {
        url += '&as_sauthors=' + encodeURIComponent(creators[0].ref.lastName).replace(/ /g, '+');
    }

    var req = new XMLHttpRequest();
    req.open('GET', url, true);

    req.onreadystatechange = function() {
        if (req.readyState == 4) {
            if (req.status == 200 &&
                req.responseText.search("RecaptchaOptions") == -1) {
                if (item.isRegularItem() && !item.isCollection()) {
                    var citations = Zotero.ScholarCitations.getCitationCount(req.responseText);
                    try {
                        var old = item.getField('extra')
                        if (old.length == 0 || old.search(/^\d{5}$/) != -1) {
                            item.setField('extra', citations);
                        } else if (old.search(/^\d{5}/) != -1) {
                            item.setField('extra', old.replace(/^\d{5}/, citations));
                        } else {
                            item.setField('extra', citations + ' ' + old);
                        }
                        item.save();
                    } catch (e) {}
                }
                Zotero.ScholarCitations.updateNextItem();
            } else {
                alert(Zotero.ScholarCitations.captchaString);
                req2 = new XMLHttpRequest();
                req2.open('GET', baseUrl, true);
                req2.onreadystatechange = function() {
                    if (req2.readyState == 4) {
                        if (typeof ZoteroStandalone !== 'undefined') {
                            ZoteroStandalone.openInViewer(baseUrl);
                        } else {
                            window.gBrowser.loadOneTab(baseUrl, {inBackground: false});
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
        return '00000';
    }

    var citeStringLength = 15;
    var lengthOfCiteByStr = 9;
    var citeArray = new Array();

    var citeExists = responseText.search('Cited by');
    if (citeExists == -1) {
        return '00000';
    }

    var tmpString = responseText.substr(citeExists, citeStringLength);
    var end = tmpString.indexOf('<') - lengthOfCiteByStr;
    return Zotero.ScholarCitations.fillZeros(tmpString.substr(lengthOfCiteByStr, end));
};

window.addEventListener('load', function(e) {
    Zotero.ScholarCitations.init();
}, false);
