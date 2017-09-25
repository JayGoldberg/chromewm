/**
 * @fileoverview Wrapper for IndexedDB using Promises
 * work in progress.
 * @author EduCampi
 */
 // TODO(): addStore function
 // TODO(): getDB without specifying version, and create if needed.
 // TODO(): Overload a centralized function for repetitive transaction setup.

goog.provide('edu.indxDB');

goog.require('goog.array');
goog.require('goog.db');
goog.require('goog.object');

/**
 * @desc Constructor for indxDB
 * @constructor @export
 */
edu.indxDB = function() {
  /** @type {goog.db.IndexedDb} db */
  this.db;
  /** @private {string} defaultObjStore_ */
  this.defaultObjStore_;
}


/**
 * @desc Connects to or Creates the specified indxDB
 * @param {!string} name
 * @param {number} version
 * @param {Array<Object>=} objStores - The first objStore will be set as default
 * @param {!string} objStores.name
 * @param {string=} objStores.keyPath
 * @param {boolean=} objStores.autoIncrement
 * @return {!Promise}
 */
edu.indxDB.prototype.getDB = function(name, version, objStores) {
  var stores_ = objStores || [];
  return new Promise((resolve, reject) => {
    goog.db.openDatabase(name, version,
      (vChgEv_, db_, tx_) => {
        goog.array.forEach(stores_, (objStore_, i, a) => {
          var options_ = goog.object.map(objStore_, (v_,k_,obj_) => {
            if (k_ != 'name') { return v_; }
          });

          try {
            db_.createObjectStore(objStore_['name'], options_);
          }
          catch(err) {
            reject(err);
          }
        });
      },

      (vChgEv_) => {
        reject(vChgEv_);
      })
      .addCallback((val_) => {
        this.db = val_;
        this.defaultObjStore_ = objStores[0]['name'];
        resolve();
    });
  });
}


/**
 * @desc gets the value for the provided key in the specified Store
 * @param {!(number|string)} key
 * @param {string=} store
 * @return {!Promise}
 */
edu.indxDB.prototype.getByKey = function(key, store) {
  var store_ = store || this.defaultObjStore_;
  return new Promise((resolve, reject) => {
    try {
      var tx_ = this.db.createTransaction([store_],
          goog.db.Transaction.TransactionMode.READ_ONLY);
      var objStore_ = tx_.objectStore(store_);
      var results_ = objStore_.get(key);
      results_.addErrback(reject);
      results_.addCallback(resolve);
    }
    catch(err) {
      reject(err)
    }
  });
}


/**
 * @desc Gets all elements in the specified Store
 * @param {string=} store
 * @return {!Promise}
 */
edu.indxDB.prototype.getAllByStore = function(store) {
  var store_ = store || this.defaultObjStore_;
  return new Promise((resolve, reject) => {
    try {
      var tx_ = this.db.createTransaction([store_],
          goog.db.Transaction.TransactionMode.READ_ONLY);
      var objStore_ = tx_.objectStore(store_);
      var elements_ = objStore_.getAll();
      elements_.addErrback(reject);
      elements_.addCallback((results) => {
        tx_.dispose();
        resolve(results);
      });
    }
    catch(err) {
      reject(err)
    }
  });
}


/**
 * @desc Adds elements to the specified Store
 * @param {!Array<Object>} objsToAdd - Array of objects to add
 * @param {string=} store
 * @return {!Promise}
 */
edu.indxDB.prototype.addToStore = function(objsToAdd, store) {
  var store_ = store || this.defaultObjStore_;
  return new Promise((resolve, reject) => {
    try {
      var tx_ = this.db.createTransaction([store_],
          goog.db.Transaction.TransactionMode.READ_WRITE);
      var objStore_ = tx_.objectStore(store_);
      goog.array.forEach(objsToAdd, (obj_, i_, a_) => {
        objStore_.put(obj_);
      });
      tx_.wait()
      .addErrback(reject)
      .addCallback(resolve);
    }
    catch(err) {
      reject(err)
    }
  });
}


/**
 * @desc Removes an element from the store by its Key
 * @param {!Array<(number|string)>} keys - Array of Keys to remove
 * @param {string=} store
 * @return {!Promise}
 */
edu.indxDB.prototype.delByKey = function(keys, store) {
  var store_ = store || this.defaultObjStore_;
  return new Promise((resolve, reject) => {
    try {
      var tx_ = this.db.createTransaction([store_],
          goog.db.Transaction.TransactionMode.READ_WRITE);
      var objStore_ = tx_.objectStore(store_);
      // var results_;
      goog.array.forEach(keys, (key_, i_, a_) => {
        objStore_.remove(key_);
      });
      tx_.wait()
      .addErrback(reject)
      .addCallback(resolve);
      // results_.addErrback(reject);
      // results_.addCallback(resolve);
    }
    catch(err) {
      reject(err)
    }
  });
}


/**
 * @desc Removes all elements from a Store
 * @param {string} store - Must be specified
 * @return {!Promise}
 */
edu.indxDB.prototype.delAllByStore = function(store) {
  return new Promise((resolve, reject) => {
    try {
      var tx_ = this.db.createTransaction([store],
          goog.db.Transaction.TransactionMode.READ_WRITE);
      var objStore_ = tx_.objectStore(store);
      var results_ = objStore_.clear();
      results_.addErrback(reject);
      results_.addCallback(resolve);
    }
    catch(err) {
      reject(err)
    }
  });
}


/**
 * @desc Removes a store from the DB
 * @param {string} store - Must be specified
 * @param {string=} newDefaultStore - If removing the defaultStore
 * @return {!Promise}
 */
edu.indxDB.prototype.delStore = function(store, newDefaultStore) {
  return new Promise((resolve, reject) => {
    goog.db.openDatabase(this.db.getName(), this.db.getVersion()+1,
      (vChgEv_, db_, tx_) => {
        try {
          this.db.deleteObjectStore(store);
        }
        catch(err) {
          reject(err);
        }
      },
      (vChgEv_) => {
        reject(vChgEv_);
      })
      .addCallback((val_) => {
        this.db = val_;
        if (store == this.defaultObjStore_) {
          this.defaultObjStore_ = newDefaultStore || '';
        }
        resolve();
    });
  });
}


/**
 * @desc Deletes the Database
 * @param {string} name - Need to specify DB name as extra safety measure
 * @returns {Promise}
 */
edu.indxDB.prototype.delDB = function(name) {
  return new Promise((resolve, reject) => {

    goog.db.deleteDatabase(name,
      (vChgEv_) => {
        reject(vChgEv_);
      })
      .addCallback(() => {
        this.db.dispose();
        this.defaultObjStore_ = '';
        resolve();
    });
  });
}
