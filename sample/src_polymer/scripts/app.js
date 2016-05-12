(function(document) {
  'use strict';

  var app = document.querySelector('#app');
  var clearingPage = null;
  var nextPage = null;

  app.selectedPage = 'Face';

  app._onPageSelected = function(e) {
    console.log('item selected: ' + app.selectedPage);
    app.$.paperDrawerPanel.closeDrawer();
  };

  app._onPageDeactivated = function(e) {
    var page = e.detail.item;
    console.log('_onPageDeactivated : ' + page.getAttribute('page-name'));
    // Only handle pages(Face,SP,PhotoCapture) having 'activated' property.
    if (page.activated != undefined) {
      clearingPage = page;
      page.activated = false;
    }
  };

  app._onPageActivated = function(e) {
    var page = e.detail.item;
    console.log('_onPageActivated : ' + page.getAttribute('page-name'));
    // Only handle pages(Face,SP,PhotoCapture) having 'activated' property.
    if (page.activated != undefined) {
      if (clearingPage) {
        // Previous page is clearing, just record nextPage.
        console.log('_onPageActivated : page is clearing: ' +
                    clearingPage.getAttribute('page-name'));
        nextPage = page;
      } else {
        page.activated = true;
      }
    }
  };

  app._onPageCleared = function(e) {
    console.log('_onPageCleared : ' + e.target.getAttribute('page-name'));
    if (e.target == clearingPage) {
      console.log('_onPageCleared : clearingPage got reset: ' +
                  clearingPage.getAttribute('page-name'));
      // The previous page clear done.
      clearingPage = null;
      if (nextPage) {
        console.log('_onPageCleared : start nextPage: ' + nextPage.getAttribute('page-name'));
        nextPage.activated = true;
        nextPage = null;
      }
    }
  };

  app.addEventListener('dom-change', function() {
    console.log('Our app is ready to rock!');
  });

})(document);
