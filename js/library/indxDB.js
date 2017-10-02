/**
 * @fileoverview Wrapper for IndexedDB using Promises
 * work in progress.
 * @author EduCampi
 */
 // TODO(): addStore function
 // TODO(): getDB without specifying version, and create if needed.

goog.provide('edu.indxDB');

goog.require('goog.array');
goog.require('goog.db');
goog.require('goog.object');

/**
 * @desc Constructor for indxDB
 * @constructor @export
 */
edu.indxDB = function() {
  /** @private {goog.db.IndexedDb} db_ - References IndexedDB */
  this.db_;
  /** @private {string} defaultObjStore_ - References default ObjectStore */
  this.defaultObjStore_;
}


/**
 * @desc Connects to or Creates the specified indxedDB
 * @param {!string} name - Name of the Database
 * @param {number} version - Version of the Database
 * @param {Array<Object>=} objStores - The first objStore will be set as default
 * @param {!string} objStores.name
 * @param {string=} objStores.keyPath
 * @param {boolean=} objStores.autoIncrement
 * @returns {!Promise}
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
        this.db_ = val_;
        this.defaultObjStore_ = objStores[0]['name'];
        resolve();
    });
  });
}


/**
 * @desc Runs Transaction
 * @param {!Function} fn - Function to run on the objectStore
 * @param {!goog.db.Transaction.TransactionMode} mode - READ_ONLY or READ_WRITE
 * @param {string=} store - The store where to run the transaction
 * @returns {!Promise}
 * @private
 */
edu.indxDB.prototype.runTx_ = function(fn, mode, store) {
  var store_ = store;
  if (typeof store === 'undefined') {
    store_ = this.defaultObjStore_;
  }
  return new Promise ((resolve, reject) => {
    var tx_ = this.db_.createTransaction([store_], mode);
    var result = fn(tx_.objectStore(store_));
    tx_.wait()
    .addCallback(resolve(result))
    .addErrback(reject);
  });
}


/**
 * @desc Gets Key value from DB
 * @param {!(number|string)} key - The Key to look for
 * @param {string=} store - The store where to run the transaction
 * @returns {!Promise}
 */
edu.indxDB.prototype.getByKey = function(key, store) {
  return this.runTx_(
      (objStore) => { return objStore.get(key); },
      goog.db.Transaction.TransactionMode.READ_ONLY,
      store
  );
}


/**
 * @desc Gets all objects from the specified DB store
 * @param {string=} store - The store where to run the transaction
 * @returns {!Promise}
 */
edu.indxDB.prototype.getAllByStore = function(store) {
  return this.runTx_(
      (objStore) => { return objStore.getAll(); },
      goog.db.Transaction.TransactionMode.READ_ONLY,
      store
  );
}


/**
 * @desc Adds elements to the specified store.
 * @param {!Array<Object>} objsToAdd - Array of objects to add
 * @param {string=} store - The store where to run the transaction
 * @returns {!Promise}
 */
edu.indxDB.prototype.addToStore = function(objsToAdd, store) {
  return this.runTx_(
      (objStore) => {
        goog.array.forEach(objsToAdd, (obj_, i, a) => {
          objStore.put(obj_);
        });},
      goog.db.Transaction.TransactionMode.READ_WRITE,
      store
  );
}


/**
 * @desc Removes elements from the store by their Keys.
 * @param {!Array<(number|string)>} keys - Array of Keys to remove
 * @param {string=} store - The store where to run the transaction
 * @returns {!Promise}
 */
edu.indxDB.prototype.delByKey = function(keys, store) {
  return this.runTx_(
      (objStore) => {
        goog.array.forEach(keys, (key_, i, a) => {
          objStore.remove(key_);
        });},
      goog.db.Transaction.TransactionMode.READ_WRITE,
      store
  );
}


/**
 * @desc Removes all elements from a Store
 * @param {!string} store - The store where to run the transaction
 * @returns {!Promise}
 */
edu.indxDB.prototype.delAllByStore = function(store) {
  return this.runTx_(
      (objStore) => { return objStore.clear(); },
      goog.db.Transaction.TransactionMode.READ_WRITE,
      store
  );
}


/**
 * @desc Removes a store from the DB
 * @param {!string} store - Must be specified
 * @param {string=} newDefaultStore - If removing the defaultStore
 * @returns {!Promise}
 */
edu.indxDB.prototype.delStore = function(store, newDefaultStore) {
  return new Promise((resolve, reject) => {
    goog.db.openDatabase(this.db_.getName(), this.db_.getVersion()+1,
      (vChgEv_, db_, tx_) => {
        try {
          this.db_.deleteObjectStore(store);
        }
        catch(err) {
          reject(err);
        }
      },
      (vChgEv_) => {
        reject(vChgEv_);
      })
      .addCallback((val_) => {
        this.db_ = val_;
        if (store == this.defaultObjStore_) {
          this.defaultObjStore_ = newDefaultStore || '';
        }
        resolve();
    });
  });
}


/**
 * @desc Deletes the Database
 * @param {!string} name - Need to specify DB name as extra safety measure
 * @returns {Promise}
 */
edu.indxDB.prototype.delDB = function(name) {
  return new Promise((resolve, reject) => {

    goog.db.deleteDatabase(name,
      (vChgEv_) => {
        reject(vChgEv_);
      })
      .addCallback(() => {
        this.db_.dispose();
        this.defaultObjStore_ = '';
        resolve();
    });
  });
}
