'use strict';

var Component = require('./Component');
var Surface = require('./Surface');
var $$ = Component.$$;

function ReadonlySurface() {
  Component.apply(this, arguments);

  var controller = this.getController();
  this.docSession = controller.getDocumentSession();
  if (!this.docSession) {
    throw new Error('ReadonlySurface needs a valid DocumentSession');
  }
  this.name = this.props.name;

  this.textTypes = this.props.textTypes;
  this._initializeCommandRegistry(this.props.commands);

  this.editingBehavior = new EditingBehavior();
  this.textPropertyManager = new TextPropertyManager(doc, this.props.containerId);

  doc.connect(this, {
    'document:changed': this.onDocumentChange
  });
}

ReadonlySurface.Prototype = function() {

  this.render = function() {
    var el = $$("div")
      .addClass('surface')
      .attr('spellCheck', false);
    return el;
  };

  this.dispose = function() {
    var doc = this.getDocument();
    this.setSelection(null);
    this.textPropertyManager.dispose();
    // Document Change Events
    doc.disconnect(this);
  };

  this.getChildContext = function() {
    return {
      surface: this,
      doc: this.getDocument()
    };
  };

  this.getCommand = function(commandName) {
    return this.commandRegistry.get(commandName);
  };

  this.getTextTypes = function() {
    return this.textTypes || [];
  };

  this.getController = function() {
    return (this.context.controller ||
      // used in test-suite
      this.props.controller);
  };

  this.getDocument = function() {
    return this.docSession.getDocument();
  };

  this.getDocumentSession = function() {
    return this.docSession;
  };

  this.transaction = Surface.prototype.transaction;

  this.getSelection = function() {
    return this.docSession.getSelection();
  };

  this.setSelection = function(sel) {
    this.docSession.setSelection(sel);
    this.textPropertyManager.renderSelection(this.getSelection());
  };

  this.rerenderDomSelection = function() {
    this.textPropertyManager.renderSelection(this.getSelection());
  };

  this.getTextPropertyManager = function() {
    return this.textPropertyManager;
  };

};

Component.extend(ReadonlySurface);

module.exports = ReadonlySurface;
