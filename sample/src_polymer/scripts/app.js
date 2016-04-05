(function(document) {
  'use strict';

  var app = document.querySelector('#app');

  app.selectedPage = 'Scene Perception';

  app._onPageSelected = function(e) {
    console.log('item selected: ' + app.selectedPage);
    app.$.paperDrawerPanel.closeDrawer();
  };

  app.addEventListener('dom-change', function() {
    console.log('Our app is ready to rock!');
  });

})(document);
