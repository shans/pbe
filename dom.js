var fs = require('fs');
var _eval = require('eval');
var htmlparser = require('htmlparser2');

var EventTarget_proto = {
  __proto__:  Object.prototype,
  removeEventListener: function(name, f) {
    if (this._listeners == undefined)
      return;
    if (this._listeners[name] == undefined)
      return;
    var idx = this._listeners[name].indexOf(f);
    if (idx < 0)
      return;
    this._listeners[name].splice(idx, 1);
  },
  addEventListener: function(name, f) {
    if (this._listeners == undefined)
      this._listeners = {};
    if (this._listeners[name] == undefined)
      this._listeners[name] = [];
    this._listeners[name].push(f);
    // HACK to deal with import polyfill not waiting for document ready state correctly
    if (name == 'readystatechange' && this.readyState == 'complete') {
      var e = new Event(name);
      e.target = this;
      f(e);
    }
  },
  dispatchEvent: function(event) {
    this._fireNow(event.type, event);
  },
  fire: function(name, event) {
    Promise.resolve().then(function() {
      this._fireNow(name, event);
    }.bind(this));
  },
  _fireNow: function(name, event) {
    event.target = this;
    if (this._listeners && this._listeners[name]) {
      for (var f of this._listeners[name])
        f(event);
      return;
    }
    this.parent && this.parent._fireNow(name, event);
  },
}

function isWrapper(object) {
  return object && object.__impl4cf1e782hg__;
}

function assert(b) {
  if (!b) throw new Error("Assertion failed");
}

var Node_proto = {
  __proto__: EventTarget_proto,
  get parentNode() {
    return this.parent;
  },
  get children() {
    return this._children;
  },
  remove: function() {
  },
  insertBefore: function(newChild, referenceNode) {
    // NO NO NO NO NO NO NO
    if (isWrapper(newChild))
      newChild = newChild.__impl4cf1e782hg__;
    if (isWrapper(referenceNode))
      referenceNode = referenceNode.__impl4cf1e782hg__;
    if (referenceNode == null)
      return this._appendChild(newChild)
    var i = this._children.indexOf(referenceNode);
    if (i == -1)
      throw "NotFoundError"
    this._children.splice(i, 0, newChild);
    this._childAttached(newChild);
  },
  appendChild: function(child) {
    assert(!isWrapper(child));
    return this._appendChild(child);
  },
  _appendChild: function(child) {
    this._children.push(child);
    this._childAttached(child);
  },
  removeChild: function(child) {
    var i = this._children.indexOf(child);
    if (i == -1)
      throw new NotFoundError();
    this._children.splice(i, 1);
  },
  _childAttached(child) {
    child.parent = this;
    child.ownerDocument = this.ownerDocument;
    if (child._isAttached)
      child._detach();
    if (!child._isAttached && this._isAttached)
      child._attach();
  },
  _attach: function() {
    this._isAttached = true;
    for (var child of this._children) {
      child._attach();
    }
    if (this.nodeType == Node.ELEMENT_NODE && this.ownerDocument == exports.document) {
      if (this.name == "script") {
        var file = this.getAttribute("src");
        if (file == undefined) {
          var data = this._children[0].data; // TODO is this right?
          var file = this.ownerDocument.__wrapper8e3dd93a60__._URL; // TODO ownerDocument.name or something?
        } else if (file.startsWith('data:text/javascript;charset=utf-8,')) {
          var data = decodeURIComponent(file.substring(35));
          var fileIdx = data.lastIndexOf("//# sourceURL=");
          file = data.substring(fileIdx + 14).trim();
        } else {
          var data = String(fs.readFileSync(file));
        }
        console.log('new script!', file);
        _runScript(data, file, this);
        this.dispatchEvent(new Event("load"));
      }
    }
  },
  _detach: function() {
    this._isAttached = false;
    for (var child of this._children) {
      child._detach();
    }
  },
  _observe: function(context, observer) {
    this.__observers.push({context: context, observer: observer});
  },
  get lastChild() {
    if (this._children.length == 0)
      return null;
    return this._children[this._children.length - 1];
  },
  get firstChild() {
    if (this._children.length == 0)
      return null;
    return this._children[0];
  },
  get nextSibling() {
    var idx = this.parent._children.indexOf(this)
    if (idx == this.parent._children.length - 1)
      return null;
    return this.parent._children[idx + 1];
  },
  get previousSibling() {
    var idx = this.parent._children.indexOf(this)
    if (idx == 0)
      return null;
    return this.parent._children[idx - 1];
  },
  _self_repr: function() {
    return '{' + this.nodeType + '}';
  },
  get baseURI() {
    return this.ownerDocument ? this.ownerDocument.baseURI : null;
  }
}

function Node(document, type) {
  this.parent = null;
  this.ownerDocument = document;
  this.nodeType = type;
  this._children = [];
  this._isAttached = false;
  this.__observers = [];
}
Node.prototype = Node_proto;
Node.ELEMENT_NODE = 1;
Node.TEXT_NODE = 3;
Node.COMMENT_NODE = 8;
Node.DOCUMENT_NODE = 9;
Node.DOCUMENT_FRAGMENT_NODE = 11;

var Element_proto = {
  __proto__: Node_proto,
  get innerHTML() {
    return "hello, world!";
  },
  set innerHTML(html) {
    function addElement(dom, node) {
      if (dom.type == 'tag' || dom.type == 'script') {
        var elem = new Element(dom.name, node.ownerDocument);
        elem.attribs = dom.attribs;
        dom.children.map(a => addElement(a, elem));
        node.appendChild(elem);
        console.log('creating', dom.name, 'on', node.ownerDocument.__wrapper8e3dd93a60__._URL, 'with baseURI', node.ownerDocument.baseURI);
      } else if (dom.type == 'text') {
        node.appendChild(new Text(dom.data, node.ownerDocument));
      } 
    }
 
    var handler = new htmlparser.DomHandler(function(error, dom) {
      if (error)
        console.log(error);
      else
        dom.map(a => addElement(a, this));
    }.bind(this));
    
    var parser = new htmlparser.Parser(handler);
    
    parser.write(html);
    parser.done();
  },
  removeAttribute: function(attribute) {
    this.attribs[attribute] = undefined;
  },
  getAttribute: function(attribute) {
    return this.attribs[attribute];
  },
  setAttribute: function(attribute, value) {
    this.attribs[attribute] = value;
  },
  match: function(selector) {
    var split = selector.split(",")
    if (split.length > 1)
      return split.map(a => this.match(a)).reduce((a,b) => a || b);
    if (selector == this.name)
      return true;
    if (selector == 'link[rel=import]' && this.nodeType == Node.ELEMENT_NODE && this.name == 'link' && this.getAttribute('rel') == 'import') {
      return true;
    }
    if (selector == 'script:not([type])' && this.nodeType == Node.ELEMENT_NODE && this.name == 'script') {
      return true;
    }
    return false;
  },
  querySelector: function(selector) {
    if (this.match(selector))
      return this;
    for (child of this._children) {
      if (child.querySelector) {
        var result = child.querySelector(selector);
        if (result)
          return result;
      }
    }
    return null;
  },
  querySelectorAll: function(selector) {
    var results = [];
    if (this.match(selector))
      results.push(this);
    for (child of this._children) {
      if (child.querySelectorAll) {
        results = results.concat(child.querySelectorAll(selector));
      }
    }
    return results;
  },
  set textContent(text) {
    var newTextNode = new Text(text, this.ownerDocument);
    // TODO remove children properly
    this._children = [];
    this.appendChild(newTextNode);
  },
  get textContent() {
    // TODO do this properly
    return this._children[0].data;
  },
  _self_repr: function() {
    return '{' + this.name + ' ' + this.attribs + '}';
  },
  get href() {
    var relative_href = this.attribs.href;
    var base = this.baseURI;
    if (base == null || relative_href[0] == '/' || relative_href.includes("://"))
      return relative_href;
    var lastSlash = base.lastIndexOf('/');
    if (lastSlash == -1)
      return relative_href;
    return base.substring(0, lastSlash) + '/' + relative_href;
  },
  get rel() {
    return this.attribs.rel;
  },
  get src() {
    return this.attribs.src;
  },
  set src(src) {
    this.attribs.src = src;
  }
}

specialElements = {'body': HTMLBodyElement_proto, 'head': HTMLHeadElement_proto, 'html': HTMLHtmlElement_proto};

function Element(name, document) {
  Node.call(this, document, Node.ELEMENT_NODE);
  this.name = name;
  this.type = 'tag';
  this.attribs = {};
  // this.impl = impls[name];
  this.localName = name;
  if (name == 'canvas') {
    // ew ew ew ew ew
    this.getContext = function(name) { return {}};
  }
  if (name == 'base' && document._firstBase == undefined) {
    document._firstBase = this;
  }
  if (specialElements[name] !== undefined)
    this.__proto__ = specialElements[name];
  
  /*
  if (this.impl) {
    this.__proto__ = this.impl.prototype;
  }
`*/
  this.style = {}
}

Element.prototype = Element_proto;

var CharacterData_proto = {
  __proto__: Node_proto,
  set data(text) {
    this._data = text;
    for (observer of this.__observers)
      if (observer.context.characterData)
        observer.observer.callback([{target: this, type: "characterData"}]);
  },
  get data() {
    return this._data;
  },
  get textContent() {
    return this._data;
  }
}

function CharacterData(text, document, type) {
  Node.call(this, document, type);
  this.type = 'text';
  this._data = text;
}

CharacterData.prototype = CharacterData_proto;

var Text_proto = {
  __proto__: CharacterData_proto
}

function Text(text, document) {
  CharacterData.call(this, text, document, Node.TEXT_NODE);
}
Text.prototype = Text_proto;

var HTMLBodyElement_proto = {
  __proto__: Element_proto
}

function HTMLBodyElement() { }
HTMLBodyElement.prototype = HTMLBodyElement_proto;

var HTMLHeadElement_proto = {
  __proto__: Element_proto
}

function HTMLHeadElement() { }
HTMLHeadElement.prototype = HTMLHeadElement_proto;

var HTMLHtmlElement_proto = {
  __proto__: Element_proto
}

function HTMLHtmlElement() { }
HTMLHtmlElement.prototype = HTMLHtmlElement_proto;

var HTMLElement_proto = {
  __proto__: Element_proto
}

function HTMLElement() {
}
HTMLElement.prototype = HTMLElement_proto;

var Event_proto = {
  initEvent: function(type, bubbles, cancelable) {
    this.subtype = type;
    this.bubbles = bubbles;
    this.cancelable = cancelable;
  },
  preventDefault: function() {
  }
};

function Event(type) {
  this.type = type;
}
Event.prototype = Event_proto;

var UIEvent_proto = {
  __proto__: Event_proto
}
function UIEvent() {
  Event.call(this, "UIEvent");
}
UIEvent.prototype = UIEvent_proto;

var CustomEvent_proto = {
  __proto__: Event_proto
}
function CustomEvent() {
  Event.call(this, "CustomEvent");
}
CustomEvent.prototype = CustomEvent_proto;

var MouseEvent_proto = {
  __proto__: Event_proto
}
function MouseEvent() {
  Event.call(this, "MouseEvent");
}
MouseEvent.prototype = MouseEvent_proto;

var FocusEvent_proto = {
  __proto__: Event_proto
}
function FocusEvent() {
  Event.call(this, "FocusEvent");
}
FocusEvent.prototype = FocusEvent_proto;

var DocumentFragment_proto = {
  __proto__: Node_proto
};

function DocumentFragment(ownerDocument) {
  Node.call(this, ownerDocument, Node.DOCUMENT_FRAGMENT_NODE);
};

DocumentFragment.prototype = DocumentFragment_proto;

var Comment_proto = {
  __proto__: CharacterData_proto
}

function Comment(data, document) {
  CharacterData.call(this, data, document, Node.COMMENT_NODE);
  this.type = 'comment';
}
Comment.prototype = Comment_proto;

var Range_proto = {
}

function Range() {
}
Range.prototype = Range_proto;

var Selection_proto = {
}

function Selection() {
}
Selection.prototype = Selection_proto;

var DataTransfer_proto = {
}

function DataTransfer() {
}
DataTransfer.prototype = DataTransfer_proto;

var XMLHttpRequest_proto = {
  __proto__: EventTarget_proto,
  open: function(type, url, thing) {
    if (type == 'GET') {
      this.url = url;
    }
  },
  send: function() {
    fs.readFile(this.url, function(error, data) {
      this.readyState = 4;
      this.status = 200;
      this.responseText = String(data);
      this.dispatchEvent(new Event("readystatechange"));
    }.bind(this));
  },
  getResponseHeader(str) {
    return undefined;
  }
}

function XMLHttpRequest() {
}

XMLHttpRequest.prototype = XMLHttpRequest_proto;

var Document_proto = {
  __proto__: Node_proto,
  createElement: function(name) {
    var element = new Element(name, this);
    /*
    if (elements[name] == undefined)
      elements[name] = [];
    elements[name].push(element);
    */
    return element;
  },
  createElementNS: function(name, ns) {
    return this.createElement(name);
  },
  createTextNode: function(text) {
    return new Text(text, this);
  },
  createComment: function(data) {
    return new Comment(data, this);
  },
  createDocumentFragment: function() {
    return new DocumentFragment();
  },
  querySelector: function(selector) {
    if (this.documentElement)
      var result = this.documentElement.querySelector(selector);
    else 
      var result = null;
    return result;
  },
  querySelectorAll: function(selector) {
    if (this.documentElement)
      var result = this.documentElement.querySelectorAll(selector);
    else
      var result = [];
    return result; 
  },
  createEvent: function(type) {
    return new Event(type);
  },
  createRange: function() {
    return new Range();
  },
  // TODO maybe start using this
  createHTMLDocument: function(title) {
    return this.implementation.createHTMLDocument(title);
  },
  adoptNode: function(externalNode) {
    externalNode.ownerDocument = this;
  },
  get baseURI() {
    if (this._firstBase)
      return this._firstBase.getAttribute('href');
    return null;
  }
      
  /*,
  registerElement: function(name, constr) {
    impls[name] = constr;
    if (elements[name] !== undefined)
      for (var element of elements[name]) {
        element.impl = constr;
        element.__proto__ = constr.prototype;
      }
  }*/ 
}

function Document(window) {
  Node.call(this, this, Node.DOCUMENT_NODE);
  this.implementation = new DOMImplementation();
  this.implementation.window = window;
  this.implementation.parent = this;

  this.defaultView = window;

  this.documentElement = new Element('html', this);
  this.documentElement._attach();
  this.head = new Element('head', this);
  
  this.documentElement.appendChild(this.head);
  this.body = new Element('body', this);
  this.documentElement.appendChild(this.body); 
  this.readyState = 'complete'; 
  this._firstBase = undefined;
  //this.dispatchEvent(new Event("readystatechange"));
}

Document.prototype = Document_proto;

var DOMImplementation_proto = {
  createHTMLDocument(title) {
    var doc = new Document(this.window);
    doc.parent = this.parent;
    return doc;  
  },
  createDocument() { },
  createDocumentType() { },
  hasFeature() { }
}

function DOMImplementation() {
}
DOMImplementation.prototype = DOMImplementation_proto;


var MutationObserver_proto = {
  observe: function(element, context) {
    element._observe(context, this);
  }
}

function MutationObserver(callback) {
  this.callback = callback;
}
MutationObserver.prototype = MutationObserver_proto;

var UnderlyingWindow_proto = {
  /*
  addEventListener: function(name, f) {
    console.log('addEventListener', name);
    if (name == 'message') {
      if (this._messageReceivers == undefined)
        this._messageReceivers = [];
      this._messageReceivers.push(f);
    }
  },
  */
};

Window_proto = {
  __proto__: EventTarget_proto,

  postMessage: function(message) {
    Promise.resolve().then(function() {
      this.dispatchEvent({type: 'message', data: message});
    }.bind(this));
  },
  requestAnimationFrame: function(f) {
    Promise.resolve().then(f.bind(this)());
  },
  getSelection: function () {
    return new Selection();
  },
  setTimeout: function(f, t) {
    return setTimeout(f.bind(this), t);
  },
 
  get location() {
    return underlyingWindow.location;
  },

  Document: Document,
  DocumentFragment: DocumentFragment,
  Element: Element,
  HTMLBodyElement: HTMLBodyElement,
  HTMLHeadElement: HTMLHeadElement,
  HTMLHtmlElement: HTMLHtmlElement,
  Node: Node,
  CharacterData: CharacterData,
  Text: Text,
  Comment: Comment,
  Range: Range,
  Selection: Selection,
  HTMLElement: HTMLElement,
  MutationObserver: MutationObserver,
  DOMImplementation: DOMImplementation,
  DataTransfer: DataTransfer,
  XMLHttpRequest: XMLHttpRequest,
  Event: Event,
  UIEvent: UIEvent,
  CustomEvent: CustomEvent,
  MouseEvent: MouseEvent,
  FocusEvent: FocusEvent,
}  

function UnderlyingWindow() {
}

UnderlyingWindow.prototype = UnderlyingWindow_proto;

var underlyingWindow = undefined;

function Window() {
  underlyingWindow = new UnderlyingWindow();
  underlyingWindow.location = {search: ""};
}

Window.prototype = Window_proto;
var window = new Window();

global.context = {window: window, document: createDefaultDocument(window),
                  navigator: {userAgent: {match: function() { return false; }} } };
global.context.console = console;

window.document = global.context.document;

// copy window prototypes onto context directly as we can't pass a proto at the toplevel
for (var key in Window_proto) {
  global.context[key] = Window_proto[key];
}

elements = {}

function _runScript(data, file, tag) {
  console.log('running', file);
  global.context.document.currentScript = tag; // TODO: should be the generated element
  global.context.document.currentScript.ownerDocument = global.context.document // TODO: this should be automatic
  try {
    global.context = _eval('window=this;window.__proto__=this.Window.prototype;' + data + '\nexports.window=window;\n', file, global.context).window;
  } catch (e) {
    if (e.message == undefined) {
      console.log('***** ' + e);
    } else {
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
}

var impls = {}

global.context.Document = Document;
global.context.DocumentFragment = DocumentFragment;
global.context.Element = Element;
global.context.Node = Node;
global.context.Comment = Comment;
global.context.CharacterData = CharacterData;
global.context.Range = Range;
global.context.Selection = Selection;
global.context.HTMLElement = HTMLElement;
global.context.HTMLBodyElement = HTMLBodyElement;
global.context.HTMLHeadElement = HTMLHeadElement;
global.context.HTMLHtmlElement = HTMLHtmlElement;
global.context.Event = Event;
global.context.Window = Window;
global.context.self = global.context.window;

exports.document = global.context.document

function createDefaultDocument(window) {
  var document = new Document(window);
  document._ImSpartacus = "true, mate";
  var root = document.createElement('html');
  document.documentElement = root;
  document.documentElement._attach();
  var head = document.createElement('head');
  assert(!isWrapper(head));
  root.appendChild(head);
  document.head = head;
  assert(!isWrapper(document));
  var body = document.createElement('body');
  document.body = body;
  root.appendChild(body);
  document.readyState = 'complete';
  document.dispatchEvent({type: 'readystatechange'});
  return document;
}
