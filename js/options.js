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
}

chromewm.options.prototype.Init = function() {
  this.workspaceQty = goog.dom.getElement('workspaceQty');

  this.Load();

  goog.events.listen(
    this.workspaceQty,
    goog.events.EventType.CHANGE,
    () => { this.Save()}
  );

  goog.events.listen(
      goog.dom.getElement('confCommands'),
      goog.events.EventType.CLICK,
      () => {
        chrome.tabs.create({url: "chrome://extensions/configureCommands"});}
        // chrome.windows.create({
          // url: "chrome://extensions/configureCommands",
        // })
  );
}


/**
 * @desc Saves options
*/
chromewm.options.prototype.Save = function() {
  var savedOptions = {
    'workspaceQty': this.workspaceQty.value
  };

  chrome.storage.sync.set(savedOptions);
}

/**
 * @desc Loads options
*/
chromewm.options.prototype.Load = function() {
  chrome.storage.sync.get({
    'workspaceQty': 1
  },
  (savedOptions) => {
    this.workspaceQty.value = savedOptions.workspaceQty;
  });
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
