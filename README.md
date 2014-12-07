# Zotero Scholar Citations

This is an add-on for Zotero, a research source management tool. The add-on automatically fetches numbers of citations of your Zotero items from Google Scholar and makes it possible to sort your items by the citations. Moreover, it allows batch updating the citations, as they may change over time.

When updating multiple citations in a batch, the add-on makes a 1 minute delay after every 50 items to try to avoid being blocked by Google Scholar for multiple automated requests. If a blockage happens, the add-on opens a browser window and directs it to http://scholar.google.com/, which may result in two distinct cases. In one case, Google Scholar displays a Captcha, which you need to enter to get unblocked and then re-try updating the citations. In the other case, Google Scholar displays a message like the following "We're sorry... but your computer or network may be sending automated queries. To protect our users, we can't process your request right now." In that case, the only solution is to wait for a while until Google unblocks you.

Currently, Zotero doesn't have any special field for the number of citations, that's why it is stored in the "Extra" field. To sort by this field you have to add it in the source listing table.

*IMPORTANT:* in version 1.8 the field for storing the number of citations has been changed from "Call Number" to "Extra" -- please update your column configuration.

The add-on supports both versions of Zotero.

To install:
  - Download the add-on from https://github.com/bwiernik/zotero-scholar-citations/raw/master/builds/zotero-scholar-citations-1.8.7bw-fx.xpi
  - Go to Tools -> Add-ons -> click the settings button in the top-right corner -> Install Add-on From File -> select the downloaded file and restart Zotero.

Read about how the add-on was made: http://blog.beloglazov.info/2009/10/zotero-citations-from-scholar-en.html

# License

Copyright (C) 2011-2013 Anton Beloglazov

Distributed under the Mozilla Public License (MPL).
