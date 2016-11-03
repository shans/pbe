'use strict';

var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var htmlparser = require('htmlparser2');
var _eval = require('eval');
var dom = require('./dom.js');

var debug = true;
var log = debug ? console.log : function() { }

/*
global.importScript = function(name, async) {
  log('importing', name);
  var lastSlash = name.lastIndexOf('/');
  if (lastSlash > -1)
    var dir = name.substring(0, lastSlash) + '/';
  else
    var dir = '';
  
  var process = function(data) {
    var handler = new htmlparser.DomHandler(function(error, dom) {
      if (error)
        console.log(error);
      else
        addElementDefinition(dom, dir, name);
    });
    
    var parser = new htmlparser.Parser(handler);
    parser.write(data);
    parser.done();
  };
  
  if (async) {
    fs.readFileAsync(name).then(process);
  } else {
    var data = fs.readFileSync(name);
    process(data);
  }
}

function addElementDefinition(dom, dir, name) {
  for (var el of dom) {
    if (el.type == 'tag' && el.name == 'dom-module') {
      var elementName = el.attribs.id;
      for (var child of el.children) {
        runIfScript(child, name);
        if (child.type == 'tag' && child.name == 'template')
          registerElementTemplate(elementName, child);
      }
    } else if (el.type == 'tag' && el.name == 'link') {
      if (el.attribs.rel == 'import')
        var async = el.attribs.hasOwnProperty('async');
        importScript(dir + el.attribs.href, async);
    } else {
      runIfScript(el, name);
    }
  }
}
var elements = {};

function elementTemplate(name) {
  if (elements[name] == undefined)
    elements[name] = {pending: []};
  return elements[name];
}

function resolve(element, template) {
  log('resolving', element.name);
  element.template = template;
  template.defn.create && template.defn.create.call(element);
  for (var el of template.template.children) {
    if (el.type == 'text')
      element.children.push(createTextNode(el.data)); // TODO: fix
    else
      element.appendChild(createElement(el.name, el.attribs));
  }
  if (element.isAttached)
    template.defn.attached && template.defn.attached.call(element);
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

function runIfScript(tag, file) {
  if (tag.type == 'script' && tag.name == 'script') {
    _runScript(tag.children[0].data, file, tag);
  }
}
*/

// TODO this should be part of the DOM model
function runScript(document, file) {
  var script = document.createElement("script");
  script.setAttribute("src", file);
  document.head.appendChild(script);
}

/*
function _runScript(data, file, tag) {
  console.log('running', file);
  try {
    global.context.location = {search: ""};
    global.context.document.currentScript = tag; // TODO: should be the generated element
    global.context.document.currentScript.ownerDocument = global.context.document // TODO: this should be automatic
    global.context = _eval('window=this;window.__proto__=this.Window.prototype;' + data + '\nexports.window=window;\n', file, global.context).window;
  } catch (e) {
    console.log('***** ' + e.message);
    var stackFrames = e.stack.split('\n');
    for (var i = 1; i < stackFrames.length; i++) {
      var context = stackFrames[i];
      var lineInfo = context.split(':');
      var line = Number(lineInfo[lineInfo.length - 2]);
      console.log('\t' + context);
      console.log('\t' + data.split('\n')[line - 1]);
    }
  }
}

function Polymer(dict) {
  var template = elementTemplate(dict.is);
  template.defn = dict;
  maybeResolvePendingElements(template);
}

global.createElement = function(name, attribs) {
  log('creating', name);
  var element = {name: name, type: 'element', children: [], isAttached: false};
  element.__proto__ = dom.Element;
  if (attribs !== undefined) {
    for (var attrib in attribs)
      element[attrib] = attribs[attrib];
  }
  var template = elementTemplate(name);
  template.pending.push(element);
  maybeResolvePendingElements(template);
  return element;
}
global.context.document.createElement = global.createElement
*/

// TODO: this needs cleaning up


global.createApp = function(file, name) {
  var document = dom.document;
  var link = document.createElement('link');
  link.setAttribute('rel', 'import');
  link.setAttribute('href', file);
  console.log('appending link');
  document.body.appendChild(link);
  runScript(document, 'bower_components/webcomponentsjs/webcomponents.js');
  // importScript(file);
  // var elt = dom.document.createElement(name);
  // dom.document.body.appendChild(elt);
}
