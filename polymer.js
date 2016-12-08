'use strict';

var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var htmlparser = require('htmlparser2');

var debug = true;
var log = debug ? console.log : function() { }

global.importScript = function(name) {
  log('importing', name);
  var data = fs.readFileSync(name);

  var handler = new htmlparser.DomHandler(function(error, dom) {
    if (error)
      console.log(error);
    else
      addElementDefinition(dom);
  });
  
  var parser = new htmlparser.Parser(handler);
  parser.write(data);
  parser.done();
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

class ChangeBus {
  constructor(context) {
    this.context = context;
    this.paths = {};
  }  

  _getRegistrations(registrationObject, pathComponent, isRoot) {
    if (registrationObject.paths[pathComponent] == undefined) {
      registrationObject.paths[pathComponent] = { paths: {}, objects: [], functions: [] };
      if (isRoot)
        this.hookProperty(this.context, pathComponent, [pathComponent], registrationObject.paths[pathComponent]);
    }
    return registrationObject.paths[pathComponent];
  }

  static pathComponents(path) {
    return path.split('.');
  }

  hookProperty(object, objectName, components, regBase) {
    var ctx = this;
    if (regBase.localObject == undefined) {
      regBase.localObject = object[objectName];
      console.log(`hookProperty set ${components} to ${JSON.stringify(object[objectName])} (${objectName})`);
    }
    Object.defineProperty(object, objectName, {
      get() { return regBase.localObject; },
      set(v) { ctx.onChange(components, v); }
    });
  };

  getRegistrationsFor(components) {
    var registrations = this;
    var isRoot = true;
    for (var i = 0; i < components.length; i++) {
      registrations = this._getRegistrations(registrations, components[i], isRoot);
      isRoot = false;
    }
    return registrations;
  }

  registerPath(object, path, name) {
    console.log(`registerPath(${object.dump()}, ${path}, ${name})`);
    var components = ChangeBus.pathComponents(path);
    var registrations = this.getRegistrationsFor(components);

    for (var registeredObject of registrations.objects)
      if (registeredObject.object == object && registeredObject.path == name)
        return;
 
    registrations.objects.push({object: object, path: name});
    this.hookProperty(object, name, components, registrations);
  }

  registerFunction(object, fn, args, name) {
    console.log(`registerFunction(${object.dump()}, ${fn}, ${args}, ${name})`);
    args = args.map(a => ChangeBus.pathComponents(a));
    args.forEach(arg => {
      var registrations = this.getRegistrationsFor(arg);
      registrations.functions.push({name: fn, args: args, object: object, property: name});
    });
    object[name] = this.context[fn].apply(this.context, args.map(a => this.getRegistrationsFor(a).localObject));
  }

  onChange(components, value) {
    console.log(`onChange(${components}, ${JSON.stringify(value)})`);
    var registrations = this.getRegistrationsFor(components);
    this._onChange(registrations, value);
  }

  _onChange(registrations, value) {
    registrations.localObject = value;
    for (var subPath in registrations.paths)
      this._onChange(registrations.paths[subPath], value[subPath]); 
    for (var fn of registrations.functions) {
      var args = fn.args.map(a => this.getRegistrationsFor(a).localObject);
      fn.object[fn.property] = this.context[fn.name].apply(this.context, args);
    }
  }

  dump() {
    return this._dump(this, '');
  }

  _dump(obj, indent) {
    var s = '{\n';
    for (var path in obj.paths) {
      s += indent + `path:${path} localObject:${obj.paths[path].localObject} referents:[`;
      s += obj.paths[path].objects.map(a => `${a.object.dump()} ${a.path}`).join(',');
      s += '] ';
      s += this._dump(obj.paths[path], indent + '  ');
    }
    s += '}\n';
    return s;
  }
}   

function createBindingOrAttribute(element, context, attrib, value) {
  var result = /{{(.*)}}/.exec(value);
  if (result == null) {
    element[attrib] = value;
    return false;
  }
  value = result[1];
  var funcMatch = /.*\(.*\)/
  if (funcMatch.exec(value)) {
    value = value.split("(");
    var funcName = value[0];
    var args = value[1].split(")")[0].split(",").map(a => a.trim());
    context._changeBus.registerFunction(element, funcName, args, attrib);
    return true;
  }
  context._changeBus.registerPath(element, value, attrib);
  return true;
}

function createTextBindingOrTextNode(context, data) {
  var text_node = createTextNode(data);
  var result = /{{(.*)}}/.exec(data);
  if (result !== null) {
    var resultBits = result[1].split('.');
    context._changeBus.registerPath(text_node, result[1], 'text');
  }
  return text_node;
}

function expandTemplate(template, element) {
  function processChildren(childList, parentElement) {
    for (var el of childList) {
      if (el.type == 'text') {
        parentElement.children.push(createTextBindingOrTextNode(element, el.data));
      } else {
        var created_element = createElement(el.name);
        for (var attrib in el.attribs)
          // <created_element attrib={{thing in attribs[attrib]}}>, host context is element
          createBindingOrAttribute(created_element, element, attrib, el.attribs[attrib]);
        parentElement.appendChild(created_element);
        processChildren(el.children, parentElement.children[parentElement.children.length - 1]);
      }
    }
  }
  element._changeBus = new ChangeBus(element);
  processChildren(template.children, element);
} 

function resolve(element, template) {
  log('resolving', element.name);
  element.template = template;
  template.defn.create && template.defn.create.call(element);

  for (var fn in template.defn) {
    if (typeof template.defn[fn] == 'function') {
      console.log(`providing function ${fn} on ${element.dump()}`);
      (function(fn) { element[fn] = function() { return template.defn[fn].apply(element, arguments); }; })(fn);
    }
  }

  expandTemplate(template.template, element);

  for (var property in template.defn.properties) {
    var value = template.defn.properties[property];
    if (typeof value != 'object')
      element[property] = value;
    else if (typeof value.value == 'function')
      element[property] = value.value.call(element);
    else if (typeof value.computed == 'string') { 
      var computed = value.computed.split("(");
      var funcName = computed[0];
      var args = computed[1].split(")")[0].split(",").map(a => a.trim());
      element._changeBus.registerFunction(element, funcName, args, property);
    }
  }

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
    if (tag.attribs.src == undefined) {
      try {
        eval(tag.children[0].data);
      } catch (e) {
        console.log(tag.children[0].data);
      }
    } else {
      var x = require('./' + tag.attribs.src);
      for (var key in x)
        global[key] = x[key];
    }
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
    this.parent && this.parent._fireNow && this.parent._fireNow(name, event);
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
    return `<${this.name}></${this.name}>`;
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
  attach: function() { },
  dump: function() { return `[${this.text}]`; }
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
