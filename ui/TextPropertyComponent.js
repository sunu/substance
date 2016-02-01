'use strict';

var AnnotatedTextComponent = require('./AnnotatedTextComponent');

/**
  Renders a text property. Used internally by different components (e.g. ui/TextPropertyEditor)

  @class
  @component
  @extends ui/Component

  @prop {String[]} path path to a text property
  @prop {String} [tagName] specifies which tag should be used - defaults to `div`

  @example

  ```js
  $$(TextProperty, {
    path: [ 'paragraph-1', 'content']
  })
  ```
*/

function TextPropertyComponent() {
  TextPropertyComponent.super.apply(this, arguments);
}

TextPropertyComponent.Prototype = function() {

  this.didMount = function() {
    var surface = this.getSurface();
    if (surface) {
      surface._registerTextProperty(this.props.path, this);
    }
  };

  this.dispose = function() {
    var surface = this.getSurface();
    if (surface) {
      surface._unregisterTextProperty(this.props.path, this);
    }
  };

  this.getInitialState = function() {
    var surface = this.getSurface();
    return {
      fragments: surface._getFragments(this.props.path)
    };
  };

  this.render = function() {
    var el = this.super.render.call(this);
    el.removeClass('sc-annotated-text').addClass('sc-text-property');
    return el;
  };

  this.getAnnotations = function() {
    var doc = this.getDocument();
    var annotations = doc.getIndex('annotations').get(this.props.path);
    if (this.state.fragments) {
      annotations = annotations.concat(this.state.fragments);
    }
    return annotations;
  };

  this.getContainer = function() {
    return this.getSurface().getContainer();
  };

  this.getController = function() {
    return this.context.controller;
  };

  this.getDocument = function() {
    return this.context.doc;
  };

  this.getElement = function() {
    return this.$el[0];
  };

  this.getSurface = function() {
    return this.context.surface;
  };
};

AnnotatedTextComponent.extend(TextPropertyComponent);

module.exports = TextPropertyComponent;
