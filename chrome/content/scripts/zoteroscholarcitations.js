Zotero.ScholarCitations = {};	

Zotero.ScholarCitations.toUpdate = 0;
Zotero.ScholarCitations.current = 0;
Zotero.ScholarCitations.failed = false;
Zotero.ScholarCitations.itemsToUpdate = null;

Zotero.ScholarCitations.init = function() {
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
	    var libraryId = item.getField("libraryID");
	    if (libraryId == null || libraryId == '' || Zotero.Libraries.isEditable(libraryId)) {
		items.push(item);
	    }
	}
    }
    Zotero.ScholarCitations.updateItems(items);
};

Zotero.ScholarCitations.updateItems = function(items) {
    if (items.length == 0) {
	return;
    }
    
    // Disabled progress window
    //Zotero.UnresponsiveScriptIndicator.disable();
    //Zotero_File_Interface.Progress.show("Updating citations...");	
    
    Zotero.ScholarCitations.current = 0;
    Zotero.ScholarCitations.toUpdate = items.length;
    Zotero.ScholarCitations.itemsToUpdate = items;
    Zotero.ScholarCitations.numberOfUpdatedItems = 0;
    Zotero.ScholarCitations.delay = false;
    Zotero.ScholarCitations.failed = false;
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

    if (Zotero.ScholarCitations.current >= Zotero.ScholarCitations.toUpdate) {
	// Disabled progress window
	//Zotero_File_Interface.Progress.close();
	//Zotero.UnresponsiveScriptIndicator.enable();	
	if (Zotero.ScholarCitations.failed) {
	    alert("Some of the requests to Google Scholar failed. Probably due to large number of requests.");
	}
	return;
    }
    
    Zotero.ScholarCitations.updateItem(Zotero.ScholarCitations.itemsToUpdate[Zotero.ScholarCitations.current]);
    
    Zotero.ScholarCitations.current++;
};

Zotero.ScholarCitations.updateItem = function(item) {
    var url = "http://scholar.google.com/scholar?hl=en&as_q=" + encodeURIComponent(item.getField('title')).replace(/ /g, '+') + "&num=1";
    
    var date = 	item.getField('date');
    if (date != '') {
	//url += '&as_ylo=' + date + '&as_yhi=' + date;
	url += '&as_ylo=' + date;
    }
    
    var creators = item.getCreators();
    if (creators.length > 0) {
	url += '&as_sauthors=' + encodeURIComponent(creators[0].ref.lastName).replace(/ /g, '+');
    }
/*
    var authors = '&as_sauthors=';
    for (var i=0; i<creators.length; i++) {
	if (i != 0) {
	    authors += '+';
	}
	authors += creators[i].ref.lastName.replace(/ /g, '+');
    }
    url += authors;
*/
    var req = new XMLHttpRequest();
    req.open('GET', url, true);
    
    req.onreadystatechange = function(aEvt) {
	if (req.readyState == 4) {
	    if (req.status == 200) {
		if (item.isRegularItem() && !item.isCollection()) {
		    var citations = Zotero.ScholarCitations.getCitationCount(req.responseText);
		    try {
			item.setField('callNumber', citations);
			item.save();	
		    } catch (e) { 
		    }		
		}				
	    } else {
		Zotero.ScholarCitations.failed = true;
	    }
	    
	    Zotero.ScholarCitations.updateNextItem();					
	}
    };
    
    req.send(null);		
};

Zotero.ScholarCitations.fillZeros = function(number) {
    var output = '';
    var cnt = 4 - number.length;
    for (var i = 0; i < cnt; i++) {
	output += '0';		
    }
    output += number;
    return output;
};

Zotero.ScholarCitations.getCitationCount = function(responseText) {
    if (responseText == "") {
	return '0000';
    }
    
    var citeStringLength = 15;
    var lengthOfCiteByStr = 9;
    var citeArray = new Array();
    
    var citeExists = responseText.search('Cited by');
    if (citeExists == -1) {
	return '0000';
    }
    
    var tmpString = responseText.substr(citeExists, citeStringLength);
    var end = tmpString.indexOf("<") - lengthOfCiteByStr;
    return Zotero.ScholarCitations.fillZeros(tmpString.substr(lengthOfCiteByStr, end));
};

window.addEventListener('load', function(e) { 
			    Zotero.ScholarCitations.init(); 
			}, false);
