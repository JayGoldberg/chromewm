/**
 * @fileoverview Options file
 * @author EduCampi
*/
// TODO(): See If I can read the keyboard shortcuts and drop them into the console.
/**
Para abrir el popup de conf commands, puedo ver las dimensiones del
id="extension-commands-overlay"
Para eso necesito un content script que lea las dimensiones y se las mande
a la options page para hacer resize de la window.Parece demasiado"
*/

goog.provide('chromewm.options');

goog.require('goog.dom');
goog.require('goog.events');


/**
 * @desc Defines Options Object
 * @constructor @export
 */
chromewm.options = function() {
  /** @private {Element} workspaceQty_ */
  this.workspaceQty_ = goog.dom.getElement('workspaceQty');
}


/**
 * @desc Initializes properties and listeners
 */
chromewm.options.prototype.Init = function() {

  this.Load_();

  goog.events.listen(
    this.workspaceQty_,
    goog.events.EventType.CHANGE,
    () => { this.Save_()}
  );

  goog.events.listen(
      goog.dom.getElement('confCommands'),
      goog.events.EventType.CLICK,
      () => {
        chrome.tabs.create({url: "chrome://extensions/configureCommands"});}
  );
}


/**
 * @desc Saves options
 * @private
 */
chromewm.options.prototype.Save_ = function() {
  localStorage.setItem('workspaceQty_', this.workspaceQty_.value);
}


/**
 * @desc Loads options
 * @private
 */
chromewm.options.prototype.Load_ = function() {
  this.workspaceQty_.value = localStorage.getItem('workspaceQty_') || 1;
}


/**
 * Waits for the page to load and instantiates the object
 */
/** @type {Object} optionsPage */
var optionsPage = {};

goog.events.listen(
  goog.dom.getDocument(),
  goog.events.EventType.DOMCONTENTLOADED,
  () => {
    optionsPage = new chromewm.options();
    optionsPage.Init();
  }
);
