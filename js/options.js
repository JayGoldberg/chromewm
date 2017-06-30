/**
 * @fileoverview Options file
 * @author EduCampi
*/

goog.provide('chromewm.options');

goog.require('goog.dom');
goog.require('goog.events');


/**
 * @desc Defines Options Object
 * @constructor @export
 */
chromewm.options = function() {

}

chromewm.options.prototype.init = function() {
  this.confCommands = goog.dom.getElement('confCommands');

  goog.events.listen(this.confCommands,
      goog.events.EventType.CLICK,
      () => {chrome.tabs.create({url: "chrome://extensions/configureCommands"})}
  );
}

/**
 * Create and start options
*/
/** @type {chromewm.options} optionsMain */
var optionsMain = new chromewm.options();
optionsMain.init();
