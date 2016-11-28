'use strict';

var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var htmlparser = require('htmlparser2');

var debug = true;
var log = debug ? console.log : function() { }

global.importScript = function(name) {
  log('importing', name);
  fs.readFileAsync(name).then(function(data) {
    var handler = new htmlparser.DomHandler(function(error, dom) {
      if (error)
        console.log(error);
      else
        addElementDefinition(dom);
    });
    
    var parser = new htmlparser.Parser(handler);
    parser.write(data);
    parser.done();
  });
}

function addElementDefinition(dom) {
  for (var el of dom) {
    if (el.type == 'tag' && el.name == 'dom-module') {
      var elementName = el.attribs.id;
      for (var child of el.children) {
        runIfScript(child);
        if (child.type == 'tag' && child.name == 'template')
          registerElementTemplate(elementName, child);
      }
    } else if (el.type == 'tag' && el.name == 'link') {
      if (el.attribs.rel == 'import')
        importScript(el.attribs.href);
    } else {
      runIfScript(el);
    }
  }
}

var elements = {};

function elementTemplate(name) {
  if (elements[name] == undefined)
    elements[name] = {pending: []};
  return elements[name];
}

function createBindingOrAttribute(element, context, attrib, value) {
  var result = /{{(.*)}}/.exec(value);
  if (result == null) {
    element[attrib] = value;
    return false;
  }
  value = result[1];
  var bindTo = result[1];
  console.log('defineProperty', element.dump(), attrib);
  Object.defineProperty(element, attrib, {
    get() { return this["_" + attrib]; },
    set(v) {
      console.log('set', attrib, 'to', v, 'on', this.dump());
      console.log('set', value, 'on', context.dump());
      context[value] = v;
      this["_" + attrib] = v;
    }
  });
  return true;
}

function expandTemplate(template, element) {
  function processChildren(childList, parentElement) {
    for (var el of childList) {
      if (el.type == 'text') {
        parentElement.children.push(createTextNode(el.data));
      } else {
        var created_element = createElement(el.name);
        for (var attrib in el.attribs)
          createBindingOrAttribute(created_element, element, attrib, el.attribs[attrib]);
        parentElement.appendChild(created_element);
        processChildren(el.children, parentElement.children[parentElement.children.length - 1]);
      }
    }
  }
  processChildren(template.children, element);
} 

function resolve(element, template) {
  log('resolving', element.name);
  element.template = template;
  template.defn.create && template.defn.create.call(element);

  expandTemplate(template.template, element);

  if (element.isAttached) {
    template.defn.attached && template.defn.attached.call(element);
  }
}

// TODO: should this only resolve if elements referenced by the template are resolved too?
function maybeResolvePendingElements(template) {
  if (template.defn && template.template) {
    var pending = template.pending;
    template.pending = [];
    for (let element of pending)
      resolve(element, template);
  }
}

function registerElementTemplate(name, templateElement) {
  log('registering', name);
  var template = elementTemplate(name);
  template.template = templateElement;
  maybeResolvePendingElements(template);
}

function runIfScript(tag) {
  if (tag.type == 'script' && tag.name == 'script') {
    eval(tag.children[0].data);
  }
}

function Polymer(dict) {
  var template = elementTemplate(dict.is);
  template.defn = dict;
  maybeResolvePendingElements(template);
}

var Element = {
  addEventListener: function(name, f) {
    if (this._listeners == undefined)
      this._listeners = {};
    if (this._listeners[name] == undefined)
      this._listeners[name] = [];
    this._listeners[name].push(f);
    log('event listener for', this.name, name);
  },
  fire: function(name, event) {
    Promise.resolve().then(function() {
      this._fireNow(name, event);
    }.bind(this));
  },
  _fireNow: function(name, event) {
    log('fire event for', this.name, name);
    if (this._listeners && this._listeners[name]) {
      for (var f of this._listeners[name])
        f(event);
      return;
    }
    this.parent && this.parent._fireNow(name, event);
  },
  remove: function() {
  },
  attach: function() {
    for (var child of this.children)
      child.attach();
    if (this.template && this.template.defn.attached) {
      this.template.defn.attached.call(this);
    }
    this.isAttached = true;
  },
  appendChild: function(child) {
    child.parent = this;
    this.children.push(child);
    if (this.isAttached)
      child.attach();
  },
  get innerHTML() {
    var s = '';
    for (var child of this.children) {
      if (child.type == 'element')
        s += `<${child.name}>${child.innerHTML}</${child.name}>`;
      else
        s += child.text;
    }
    return s;
  },
  dump: function() {
    return `<${this.name}>${this.innerHTML}</${this.name}>`;
  }
}

global.createElement = function(name, attribs) {
  log('creating', name);
  var element = {name: name, type: 'element', children: [], isAttached: false};
  element.__proto__ = Element;
  if (attribs !== undefined) {
    for (var attrib in attribs)
      element[attrib] = attribs[attrib];
  }
  var template = elementTemplate(name);
  template.pending.push(element);
  maybeResolvePendingElements(template);
  return element;
}

var TextNode = {
  attach: function() { }
}

global.createTextNode = function(text) {
  var textNode = {type: 'text', text: text};
  textNode.__proto__ = TextNode;
  return textNode;
} 

global.createRoot = function(file, name) {
  importScript(file);
  var root = createElement(name);
  root.parent = "TOP_OF_DOC";
  root.attach();
}
