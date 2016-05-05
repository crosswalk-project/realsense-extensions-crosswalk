(function(document) {
  'use strict';

  var app = document.querySelector('#app');

  app.selectedPage = 'Face';

  app._onPageSelected = function(e) {
    console.log('item selected: ' + app.selectedPage);
    app.$.paperDrawerPanel.closeDrawer();
  };

  app._onPageDeactivated = function(e) {
    e.detail.item.activated = false;
  };

  app._onPageActivated = function(e) {
    e.detail.item.activated = true;
  };

  app.addEventListener('dom-change', function() {
    console.log('Our app is ready to rock!');
  });

})(document);
