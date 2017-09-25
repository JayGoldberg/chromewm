/**
 * @fileoverview Options file
 * @author EduCampi
*/
goog.provide('chromewm.options');

goog.require('goog.dom');
goog.require('goog.events');
goog.require('goog.storage.mechanism.HTML5LocalStorage');

/**
 * @desc Defines Options Object
 * @constructor @export
 */
chromewm.options = function() {
  /** @private {Element} workspaceQty_ */
  this.workspaceQty_ = goog.dom.getElement('workspaceQty');
  /** @private {Element} workspaceQtyRange_ */
  this.workspaceQtyRange_ = goog.dom.getElement('workspaceQtyRange');
  /** @private {Object} storage_ */
  this.storage_= new goog.storage.mechanism.HTML5LocalStorage();
}


/**
 * @desc Initializes properties and listeners
 */
chromewm.options.prototype.Init = function() {

  this.Load_();

  goog.events.listen(
    this.workspaceQtyRange_,
    goog.events.EventType.MOUSEMOVE,
    () => { this.updateWorkspaceQty_()}
  );

  goog.events.listen(
    this.workspaceQtyRange_,
    goog.events.EventType.CHANGE,
    () => { this.Save_()}
  );

  goog.events.listen(
      goog.dom.getElement('confCommands'),
      goog.events.EventType.CLICK,
      () => {
        chrome.tabs.create({'url': "chrome://extensions/configureCommands"});}
  );
}


/**
 * @desc Updateds workspaceQty_ number
 * @private
 */
chromewm.options.prototype.updateWorkspaceQty_ = function() {
  this.workspaceQty_['innerHTML'] = this.workspaceQtyRange_['value'];
}


/**
 * @desc Saves options
 * @private
 */
chromewm.options.prototype.Save_ = function() {
  this.storage_.set('workspaceQty_', this.workspaceQtyRange_['value']);
}


/**
 * @desc Loads options
 * @private
 */
chromewm.options.prototype.Load_ = function() {
  this.workspaceQtyRange_['value'] = this.storage_.get('workspaceQty_') || 4;
  this.workspaceQty_['innerHTML'] = this.workspaceQtyRange_['value'];
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
