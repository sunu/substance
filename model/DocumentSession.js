"use strict";

var extend = require('lodash/object/extend');
var oo = require('../util/oo');
var EventEmitter = require('../util/EventEmitter');
var TransactionDocument = require('./TransactionDocument');
var DefaultChangeCompressor = require('./DefaultChangeCompressor');
var Selection = require('./Selection');
var DocumentChange = require('./DocumentChange');

/*
  TODO: Maybe find a suitable name.
  The purpose of this class is to maintain editing related things:
    - selection
    - transactions
    - undo/redo
    - versioning
    - collaborative editing
*/
function DocumentSession(doc, options) {
  DocumentSession.super.apply(this);

  options = options || {};
  this.doc = doc;
  this.selection = Selection.nullSelection;

  // the stage is a essentially a clone of this document
  // used to apply a sequence of document operations
  // without touching this document
  this.stage = new TransactionDocument(this.doc, this);
  this.isTransacting = false;

  this.doneChanges = [];
  this.undoneChanges = [];

  this.compressor = options.compressor || new DefaultChangeCompressor();

  this.doc.connect(this, {
    'document:changed': this.onDocumentChange
  });
}

DocumentSession.Prototype = function() {

  this.getDocument = function() {
    return this.doc;
  };

  this.getSelection = function() {
    return this.selection;
  };

  this.setSelection = function(sel) {
    this.selection = sel;
    this.emit('selection:changed', sel, this);
    // For those who are just interested in selection changes
    // done via this method -- as opposed to implicit changes
    // when via DocumentChange
    this.emit('selection:changed:explicitly', sel, this);
  };

  this.canUndo = function() {
    return this.doneChanges.length > 0;
  };

  this.canRedo = function() {
    return this.undoneChanges.length > 0;
  };

  this.undo = function() {
    var change = this.doneChanges.pop();
    if (change) {
      this.stage._apply(change);
      this.doc._apply(change);
      this.undoneChanges.push(change.invert());
      this._notifyChangeListeners(change, { 'replay': true });
    } else {
      console.error('No change can be undone.');
    }
  };

  this.redo = function() {
    var change = this.undoneChanges.pop();
    if (change) {
      this.stage._apply(change);
      this.doc._apply(change);
      this.doneChanges.push(change.invert());
      this._notifyChangeListeners(change, { 'replay': true });
    } else {
      console.error('No change can be redone.');
    }
  };

  /**
    Start a transaction to manipulate the document

    @param {function} transformation a function(tx) that performs actions on the transaction document tx

    @example

    ```js
    doc.transaction(function(tx, args) {
      tx.update(...);
      ...
      return {
        selection: newSelection
      };
    })
    ```
  */
  this.transaction = function(transformation, info) {
    /* jshint unused: false */
    if (this.isTransacting) {
      throw new Error('Nested transactions are not supported.');
    }
    this.isTransacting = true;
    this.stage.reset();
    var sel = this.selection;
    info = info || {};
    var change = this.stage._transaction(function(tx) {
      tx.before.selection = sel;
      var args = { selection: sel };
      var result = transformation(tx, args) || {};
      tx.after.selection = result.selection || sel;
      extend(info, tx.info);
    });
    if (change) {
      this.selection = change.after.selection;
      this.isTransacting = false;
      this._commit(change, info);
      this.emit('selection:changed', this.selection, this);
      return change;
    } else {
      this.isTransacting = false;
    }
  };

  this.onDocumentChange = function(change, info) {
    if (info.session !== this) {
      this.stage._apply(change);
      // rebase the change history
      // TODO: as an optimization we could rebase the history lazily
      DocumentChange.transform(this.doneChanges, change);
      DocumentChange.transform(this.undoneChanges, change);
      // TODO: transform selection
      var sel = DocumentChange.transformSelection(this.selection, change);
      if (!sel.equals(this.selection)) {
        this.selection = sel;
        this.emit('selection:changed', this.selection, this);
      }
    }
  };

  this._commit = function(change, info) {
    // apply the change
    change.timestamp = Date.now();
    // TODO: try to find a more explicit way, or a maybe a smarter way
    // to keep the TransactionDocument in sync
    this.doc._apply(change);

    var lastChange = this._getLastChange();
    // try to merge this change with the last to get more natural changes
    // e.g. not every keystroke, but typed words or such.
    var merged = false;
    if (lastChange && !lastChange.isFinal()) {
      if (this.compressor.shouldMerge(lastChange, change)) {
        merged = this.compressor.merge(lastChange, change);
      }
    }
    if (!merged) {
      // push to undo queue and wipe the redo queue
      this.doneChanges.push(change.invert());
    }
    this.undoneChanges = [];
    // console.log('Document._saveTransaction took %s ms', (Date.now() - time));
    // time = Date.now();
    this._notifyChangeListeners(change, info);
  };

  this._notifyChangeListeners = function(change, info) {
    info = info || {};
    info.session = this;
    // TODO: I would like to wrap this with a try catch.
    // however, debugging gets inconvenient as caught exceptions don't trigger a breakpoint
    // by default, and other libraries such as jquery throw noisily.
    this.doc._notifyChangeListeners(change, info);
  };

  this._getLastChange = function() {
    return this.doneChanges[this.doneChanges.length-1];
  };

};

oo.inherit(DocumentSession, EventEmitter);

module.exports = DocumentSession;
