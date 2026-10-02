"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/mithril/render/vnode.js
var require_vnode = __commonJS({
  "node_modules/mithril/render/vnode.js"(exports2, module2) {
    "use strict";
    function Vnode(tag, key, attrs, children, text, dom) {
      return { tag, key, attrs, children, text, dom, is: void 0, domSize: void 0, state: void 0, events: void 0, instance: void 0 };
    }
    Vnode.normalize = function(node) {
      if (Array.isArray(node)) return Vnode("[", void 0, void 0, Vnode.normalizeChildren(node), void 0, void 0);
      if (node == null || typeof node === "boolean") return null;
      if (typeof node === "object") return node;
      return Vnode("#", void 0, void 0, String(node), void 0, void 0);
    };
    Vnode.normalizeChildren = function(input) {
      var children = new Array(input.length);
      var numKeyed = 0;
      for (var i = 0; i < input.length; i++) {
        children[i] = Vnode.normalize(input[i]);
        if (children[i] !== null && children[i].key != null) numKeyed++;
      }
      if (numKeyed !== 0 && numKeyed !== input.length) {
        throw new TypeError(
          children.includes(null) ? "In fragments, vnodes must either all have keys or none have keys. You may wish to consider using an explicit keyed empty fragment, m.fragment({key: ...}), instead of a hole." : "In fragments, vnodes must either all have keys or none have keys."
        );
      }
      return children;
    };
    module2.exports = Vnode;
  }
});

// node_modules/mithril/render/hyperscriptVnode.js
var require_hyperscriptVnode = __commonJS({
  "node_modules/mithril/render/hyperscriptVnode.js"(exports2, module2) {
    "use strict";
    var Vnode = require_vnode();
    module2.exports = function(attrs, children) {
      if (attrs == null || typeof attrs === "object" && attrs.tag == null && !Array.isArray(attrs)) {
        if (children.length === 1 && Array.isArray(children[0])) children = children[0];
      } else {
        children = children.length === 0 && Array.isArray(attrs) ? attrs : [attrs, ...children];
        attrs = void 0;
      }
      return Vnode("", attrs && attrs.key, attrs, children);
    };
  }
});

// node_modules/mithril/util/hasOwn.js
var require_hasOwn = __commonJS({
  "node_modules/mithril/util/hasOwn.js"(exports2, module2) {
    "use strict";
    module2.exports = {}.hasOwnProperty;
  }
});

// node_modules/mithril/render/emptyAttrs.js
var require_emptyAttrs = __commonJS({
  "node_modules/mithril/render/emptyAttrs.js"(exports2, module2) {
    "use strict";
    module2.exports = {};
  }
});

// node_modules/mithril/render/cachedAttrsIsStaticMap.js
var require_cachedAttrsIsStaticMap = __commonJS({
  "node_modules/mithril/render/cachedAttrsIsStaticMap.js"(exports2, module2) {
    "use strict";
    var emptyAttrs = require_emptyAttrs();
    module2.exports = /* @__PURE__ */ new Map([[emptyAttrs, true]]);
  }
});

// node_modules/mithril/render/hyperscript.js
var require_hyperscript = __commonJS({
  "node_modules/mithril/render/hyperscript.js"(exports2, module2) {
    "use strict";
    var Vnode = require_vnode();
    var hyperscriptVnode = require_hyperscriptVnode();
    var hasOwn = require_hasOwn();
    var emptyAttrs = require_emptyAttrs();
    var cachedAttrsIsStaticMap = require_cachedAttrsIsStaticMap();
    var selectorParser = /(?:(^|#|\.)([^#\.\[\]]+))|(\[(.+?)(?:\s*=\s*("|'|)((?:\\["'\]]|.)*?)\5)?\])/g;
    var selectorCache = /* @__PURE__ */ Object.create(null);
    function isEmpty(object) {
      for (var key in object) if (hasOwn.call(object, key)) return false;
      return true;
    }
    function isFormAttributeKey(key) {
      return key === "value" || key === "checked" || key === "selectedIndex" || key === "selected";
    }
    function compileSelector(selector) {
      var match, tag = "div", classes = [], attrs = {}, isStatic = true;
      while (match = selectorParser.exec(selector)) {
        var type = match[1], value = match[2];
        if (type === "" && value !== "") tag = value;
        else if (type === "#") attrs.id = value;
        else if (type === ".") classes.push(value);
        else if (match[3][0] === "[") {
          var attrValue = match[6];
          if (attrValue) attrValue = attrValue.replace(/\\(["'])/g, "$1").replace(/\\\\/g, "\\");
          if (match[4] === "class") classes.push(attrValue);
          else {
            attrs[match[4]] = attrValue === "" ? attrValue : attrValue || true;
            if (isFormAttributeKey(match[4])) isStatic = false;
          }
        }
      }
      if (classes.length > 0) attrs.className = classes.join(" ");
      if (isEmpty(attrs)) attrs = emptyAttrs;
      else cachedAttrsIsStaticMap.set(attrs, isStatic);
      return selectorCache[selector] = { tag, attrs, is: attrs.is };
    }
    function execSelector(state, vnode) {
      vnode.tag = state.tag;
      var attrs = vnode.attrs;
      if (attrs == null) {
        vnode.attrs = state.attrs;
        vnode.is = state.is;
        return vnode;
      }
      if (hasOwn.call(attrs, "class")) {
        if (attrs.class != null) attrs.className = attrs.class;
        attrs.class = null;
      }
      if (state.attrs !== emptyAttrs) {
        var className = attrs.className;
        attrs = Object.assign({}, state.attrs, attrs);
        if (state.attrs.className != null) attrs.className = className != null ? String(state.attrs.className) + " " + String(className) : state.attrs.className;
      }
      if (state.tag === "input" && hasOwn.call(attrs, "type")) {
        attrs = Object.assign({ type: attrs.type }, attrs);
      }
      vnode.is = attrs.is;
      vnode.attrs = attrs;
      return vnode;
    }
    function hyperscript(selector, attrs, ...children) {
      if (selector == null || typeof selector !== "string" && typeof selector !== "function" && typeof selector.view !== "function") {
        throw Error("The selector must be either a string or a component.");
      }
      var vnode = hyperscriptVnode(attrs, children);
      if (typeof selector === "string") {
        vnode.children = Vnode.normalizeChildren(vnode.children);
        if (selector !== "[") return execSelector(selectorCache[selector] || compileSelector(selector), vnode);
      }
      if (vnode.attrs == null) vnode.attrs = {};
      vnode.tag = selector;
      return vnode;
    }
    module2.exports = hyperscript;
  }
});

// node_modules/mithril/render/trust.js
var require_trust = __commonJS({
  "node_modules/mithril/render/trust.js"(exports2, module2) {
    "use strict";
    var Vnode = require_vnode();
    module2.exports = function(html) {
      if (html == null) html = "";
      return Vnode("<", void 0, void 0, html, void 0, void 0);
    };
  }
});

// node_modules/mithril/render/fragment.js
var require_fragment = __commonJS({
  "node_modules/mithril/render/fragment.js"(exports2, module2) {
    "use strict";
    var Vnode = require_vnode();
    var hyperscriptVnode = require_hyperscriptVnode();
    module2.exports = function(attrs, ...children) {
      var vnode = hyperscriptVnode(attrs, children);
      if (vnode.attrs == null) vnode.attrs = {};
      vnode.tag = "[";
      vnode.children = Vnode.normalizeChildren(vnode.children);
      return vnode;
    };
  }
});

// node_modules/mithril/hyperscript.js
var require_hyperscript2 = __commonJS({
  "node_modules/mithril/hyperscript.js"(exports2, module2) {
    "use strict";
    var hyperscript = require_hyperscript();
    hyperscript.trust = require_trust();
    hyperscript.fragment = require_fragment();
    module2.exports = hyperscript;
  }
});

// node_modules/mithril/render/delayedRemoval.js
var require_delayedRemoval = __commonJS({
  "node_modules/mithril/render/delayedRemoval.js"(exports2, module2) {
    "use strict";
    module2.exports = /* @__PURE__ */ new WeakMap();
  }
});

// node_modules/mithril/render/domFor.js
var require_domFor = __commonJS({
  "node_modules/mithril/render/domFor.js"(exports2, module2) {
    "use strict";
    var delayedRemoval = require_delayedRemoval();
    function* domFor(vnode) {
      var dom = vnode.dom;
      var domSize = vnode.domSize;
      var generation = delayedRemoval.get(dom);
      if (dom != null) do {
        var nextSibling = dom.nextSibling;
        if (delayedRemoval.get(dom) === generation) {
          yield dom;
          domSize--;
        }
        dom = nextSibling;
      } while (domSize);
    }
    module2.exports = domFor;
  }
});

// node_modules/mithril/render/render.js
var require_render = __commonJS({
  "node_modules/mithril/render/render.js"(exports2, module2) {
    "use strict";
    var Vnode = require_vnode();
    var delayedRemoval = require_delayedRemoval();
    var domFor = require_domFor();
    var cachedAttrsIsStaticMap = require_cachedAttrsIsStaticMap();
    module2.exports = function() {
      var nameSpace = {
        svg: "http://www.w3.org/2000/svg",
        math: "http://www.w3.org/1998/Math/MathML"
      };
      var currentRedraw;
      var currentRender;
      function getDocument(dom) {
        return dom.ownerDocument;
      }
      function getNameSpace(vnode) {
        return vnode.attrs && vnode.attrs.xmlns || nameSpace[vnode.tag];
      }
      function checkState(vnode, original) {
        if (vnode.state !== original) throw new Error("'vnode.state' must not be modified.");
      }
      function callHook(vnode) {
        var original = vnode.state;
        try {
          return this.apply(original, arguments);
        } finally {
          checkState(vnode, original);
        }
      }
      function activeElement(dom) {
        try {
          return getDocument(dom).activeElement;
        } catch (e) {
          return null;
        }
      }
      function createNodes(parent, vnodes, start, end, hooks, nextSibling, ns) {
        for (var i = start; i < end; i++) {
          var vnode = vnodes[i];
          if (vnode != null) {
            createNode(parent, vnode, hooks, ns, nextSibling);
          }
        }
      }
      function createNode(parent, vnode, hooks, ns, nextSibling) {
        var tag = vnode.tag;
        if (typeof tag === "string") {
          vnode.state = {};
          if (vnode.attrs != null) initLifecycle(vnode.attrs, vnode, hooks);
          switch (tag) {
            case "#":
              createText(parent, vnode, nextSibling);
              break;
            case "<":
              createHTML(parent, vnode, ns, nextSibling);
              break;
            case "[":
              createFragment(parent, vnode, hooks, ns, nextSibling);
              break;
            default:
              createElement(parent, vnode, hooks, ns, nextSibling);
          }
        } else createComponent(parent, vnode, hooks, ns, nextSibling);
      }
      function createText(parent, vnode, nextSibling) {
        vnode.dom = getDocument(parent).createTextNode(vnode.children);
        insertDOM(parent, vnode.dom, nextSibling);
      }
      var possibleParents = { caption: "table", thead: "table", tbody: "table", tfoot: "table", tr: "tbody", th: "tr", td: "tr", colgroup: "table", col: "colgroup" };
      function createHTML(parent, vnode, ns, nextSibling) {
        var match = vnode.children.match(/^\s*?<(\w+)/im) || [];
        var temp = getDocument(parent).createElement(possibleParents[match[1]] || "div");
        if (ns === "http://www.w3.org/2000/svg") {
          temp.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + vnode.children + "</svg>";
          temp = temp.firstChild;
        } else {
          temp.innerHTML = vnode.children;
        }
        vnode.dom = temp.firstChild;
        vnode.domSize = temp.childNodes.length;
        var fragment = getDocument(parent).createDocumentFragment();
        var child;
        while (child = temp.firstChild) {
          fragment.appendChild(child);
        }
        insertDOM(parent, fragment, nextSibling);
      }
      function createFragment(parent, vnode, hooks, ns, nextSibling) {
        var fragment = getDocument(parent).createDocumentFragment();
        if (vnode.children != null) {
          var children = vnode.children;
          createNodes(fragment, children, 0, children.length, hooks, null, ns);
        }
        vnode.dom = fragment.firstChild;
        vnode.domSize = fragment.childNodes.length;
        insertDOM(parent, fragment, nextSibling);
      }
      function createElement(parent, vnode, hooks, ns, nextSibling) {
        var tag = vnode.tag;
        var attrs = vnode.attrs;
        var is = vnode.is;
        ns = getNameSpace(vnode) || ns;
        var element = ns ? is ? getDocument(parent).createElementNS(ns, tag, { is }) : getDocument(parent).createElementNS(ns, tag) : is ? getDocument(parent).createElement(tag, { is }) : getDocument(parent).createElement(tag);
        vnode.dom = element;
        if (attrs != null) {
          setAttrs(vnode, attrs, ns);
        }
        insertDOM(parent, element, nextSibling);
        if (!maybeSetContentEditable(vnode)) {
          if (vnode.children != null) {
            var children = vnode.children;
            createNodes(element, children, 0, children.length, hooks, null, ns);
            if (vnode.tag === "select" && attrs != null) setLateSelectAttrs(vnode, attrs);
          }
        }
      }
      function initComponent(vnode, hooks) {
        var sentinel;
        if (typeof vnode.tag.view === "function") {
          vnode.state = Object.create(vnode.tag);
          sentinel = vnode.state.view;
          if (sentinel.$$reentrantLock$$ != null) return;
          sentinel.$$reentrantLock$$ = true;
        } else {
          vnode.state = void 0;
          sentinel = vnode.tag;
          if (sentinel.$$reentrantLock$$ != null) return;
          sentinel.$$reentrantLock$$ = true;
          vnode.state = vnode.tag.prototype != null && typeof vnode.tag.prototype.view === "function" ? new vnode.tag(vnode) : vnode.tag(vnode);
        }
        initLifecycle(vnode.state, vnode, hooks);
        if (vnode.attrs != null) initLifecycle(vnode.attrs, vnode, hooks);
        vnode.instance = Vnode.normalize(callHook.call(vnode.state.view, vnode));
        if (vnode.instance === vnode) throw Error("A view cannot return the vnode it received as argument");
        sentinel.$$reentrantLock$$ = null;
      }
      function createComponent(parent, vnode, hooks, ns, nextSibling) {
        initComponent(vnode, hooks);
        if (vnode.instance != null) {
          createNode(parent, vnode.instance, hooks, ns, nextSibling);
          vnode.dom = vnode.instance.dom;
          vnode.domSize = vnode.instance.domSize;
        } else {
          vnode.domSize = 0;
        }
      }
      function updateNodes(parent, old, vnodes, hooks, nextSibling, ns) {
        if (old === vnodes || old == null && vnodes == null) return;
        else if (old == null || old.length === 0) createNodes(parent, vnodes, 0, vnodes.length, hooks, nextSibling, ns);
        else if (vnodes == null || vnodes.length === 0) removeNodes(parent, old, 0, old.length);
        else {
          var isOldKeyed = old[0] != null && old[0].key != null;
          var isKeyed = vnodes[0] != null && vnodes[0].key != null;
          var start = 0, oldStart = 0;
          if (!isOldKeyed) while (oldStart < old.length && old[oldStart] == null) oldStart++;
          if (!isKeyed) while (start < vnodes.length && vnodes[start] == null) start++;
          if (isOldKeyed !== isKeyed) {
            removeNodes(parent, old, oldStart, old.length);
            createNodes(parent, vnodes, start, vnodes.length, hooks, nextSibling, ns);
          } else if (!isKeyed) {
            var commonLength = old.length < vnodes.length ? old.length : vnodes.length;
            start = start < oldStart ? start : oldStart;
            for (; start < commonLength; start++) {
              o = old[start];
              v = vnodes[start];
              if (o === v || o == null && v == null) continue;
              else if (o == null) createNode(parent, v, hooks, ns, getNextSibling(old, start + 1, nextSibling));
              else if (v == null) removeNode(parent, o);
              else updateNode(parent, o, v, hooks, getNextSibling(old, start + 1, nextSibling), ns);
            }
            if (old.length > commonLength) removeNodes(parent, old, start, old.length);
            if (vnodes.length > commonLength) createNodes(parent, vnodes, start, vnodes.length, hooks, nextSibling, ns);
          } else {
            var oldEnd = old.length - 1, end = vnodes.length - 1, map, o, v, oe, ve, topSibling;
            while (oldEnd >= oldStart && end >= start) {
              oe = old[oldEnd];
              ve = vnodes[end];
              if (oe.key !== ve.key) break;
              if (oe !== ve) updateNode(parent, oe, ve, hooks, nextSibling, ns);
              if (ve.dom != null) nextSibling = ve.dom;
              oldEnd--, end--;
            }
            while (oldEnd >= oldStart && end >= start) {
              o = old[oldStart];
              v = vnodes[start];
              if (o.key !== v.key) break;
              oldStart++, start++;
              if (o !== v) updateNode(parent, o, v, hooks, getNextSibling(old, oldStart, nextSibling), ns);
            }
            while (oldEnd >= oldStart && end >= start) {
              if (start === end) break;
              if (o.key !== ve.key || oe.key !== v.key) break;
              topSibling = getNextSibling(old, oldStart, nextSibling);
              moveDOM(parent, oe, topSibling);
              if (oe !== v) updateNode(parent, oe, v, hooks, topSibling, ns);
              if (++start <= --end) moveDOM(parent, o, nextSibling);
              if (o !== ve) updateNode(parent, o, ve, hooks, nextSibling, ns);
              if (ve.dom != null) nextSibling = ve.dom;
              oldStart++;
              oldEnd--;
              oe = old[oldEnd];
              ve = vnodes[end];
              o = old[oldStart];
              v = vnodes[start];
            }
            while (oldEnd >= oldStart && end >= start) {
              if (oe.key !== ve.key) break;
              if (oe !== ve) updateNode(parent, oe, ve, hooks, nextSibling, ns);
              if (ve.dom != null) nextSibling = ve.dom;
              oldEnd--, end--;
              oe = old[oldEnd];
              ve = vnodes[end];
            }
            if (start > end) removeNodes(parent, old, oldStart, oldEnd + 1);
            else if (oldStart > oldEnd) createNodes(parent, vnodes, start, end + 1, hooks, nextSibling, ns);
            else {
              var originalNextSibling = nextSibling, vnodesLength = end - start + 1, oldIndices = new Array(vnodesLength), li = 0, i = 0, pos = 2147483647, matched = 0, map, lisIndices;
              for (i = 0; i < vnodesLength; i++) oldIndices[i] = -1;
              for (i = end; i >= start; i--) {
                if (map == null) map = getKeyMap(old, oldStart, oldEnd + 1);
                ve = vnodes[i];
                var oldIndex = map[ve.key];
                if (oldIndex != null) {
                  pos = oldIndex < pos ? oldIndex : -1;
                  oldIndices[i - start] = oldIndex;
                  oe = old[oldIndex];
                  old[oldIndex] = null;
                  if (oe !== ve) updateNode(parent, oe, ve, hooks, nextSibling, ns);
                  if (ve.dom != null) nextSibling = ve.dom;
                  matched++;
                }
              }
              nextSibling = originalNextSibling;
              if (matched !== oldEnd - oldStart + 1) removeNodes(parent, old, oldStart, oldEnd + 1);
              if (matched === 0) createNodes(parent, vnodes, start, end + 1, hooks, nextSibling, ns);
              else {
                if (pos === -1) {
                  lisIndices = makeLisIndices(oldIndices);
                  li = lisIndices.length - 1;
                  for (i = end; i >= start; i--) {
                    v = vnodes[i];
                    if (oldIndices[i - start] === -1) createNode(parent, v, hooks, ns, nextSibling);
                    else {
                      if (lisIndices[li] === i - start) li--;
                      else moveDOM(parent, v, nextSibling);
                    }
                    if (v.dom != null) nextSibling = vnodes[i].dom;
                  }
                } else {
                  for (i = end; i >= start; i--) {
                    v = vnodes[i];
                    if (oldIndices[i - start] === -1) createNode(parent, v, hooks, ns, nextSibling);
                    if (v.dom != null) nextSibling = vnodes[i].dom;
                  }
                }
              }
            }
          }
        }
      }
      function updateNode(parent, old, vnode, hooks, nextSibling, ns) {
        var oldTag = old.tag, tag = vnode.tag;
        if (oldTag === tag && old.is === vnode.is) {
          vnode.state = old.state;
          vnode.events = old.events;
          if (shouldNotUpdate(vnode, old)) return;
          if (typeof oldTag === "string") {
            if (vnode.attrs != null) {
              updateLifecycle(vnode.attrs, vnode, hooks);
            }
            switch (oldTag) {
              case "#":
                updateText(old, vnode);
                break;
              case "<":
                updateHTML(parent, old, vnode, ns, nextSibling);
                break;
              case "[":
                updateFragment(parent, old, vnode, hooks, nextSibling, ns);
                break;
              default:
                updateElement(old, vnode, hooks, ns);
            }
          } else updateComponent(parent, old, vnode, hooks, nextSibling, ns);
        } else {
          removeNode(parent, old);
          createNode(parent, vnode, hooks, ns, nextSibling);
        }
      }
      function updateText(old, vnode) {
        if (old.children.toString() !== vnode.children.toString()) {
          old.dom.nodeValue = vnode.children;
        }
        vnode.dom = old.dom;
      }
      function updateHTML(parent, old, vnode, ns, nextSibling) {
        if (old.children !== vnode.children) {
          removeDOM(parent, old);
          createHTML(parent, vnode, ns, nextSibling);
        } else {
          vnode.dom = old.dom;
          vnode.domSize = old.domSize;
        }
      }
      function updateFragment(parent, old, vnode, hooks, nextSibling, ns) {
        updateNodes(parent, old.children, vnode.children, hooks, nextSibling, ns);
        var domSize = 0, children = vnode.children;
        vnode.dom = null;
        if (children != null) {
          for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (child != null && child.dom != null) {
              if (vnode.dom == null) vnode.dom = child.dom;
              domSize += child.domSize || 1;
            }
          }
        }
        vnode.domSize = domSize;
      }
      function updateElement(old, vnode, hooks, ns) {
        var element = vnode.dom = old.dom;
        ns = getNameSpace(vnode) || ns;
        if (old.attrs != vnode.attrs || vnode.attrs != null && !cachedAttrsIsStaticMap.get(vnode.attrs)) {
          updateAttrs(vnode, old.attrs, vnode.attrs, ns);
        }
        if (!maybeSetContentEditable(vnode)) {
          updateNodes(element, old.children, vnode.children, hooks, null, ns);
        }
      }
      function updateComponent(parent, old, vnode, hooks, nextSibling, ns) {
        vnode.instance = Vnode.normalize(callHook.call(vnode.state.view, vnode));
        if (vnode.instance === vnode) throw Error("A view cannot return the vnode it received as argument");
        updateLifecycle(vnode.state, vnode, hooks);
        if (vnode.attrs != null) updateLifecycle(vnode.attrs, vnode, hooks);
        if (vnode.instance != null) {
          if (old.instance == null) createNode(parent, vnode.instance, hooks, ns, nextSibling);
          else updateNode(parent, old.instance, vnode.instance, hooks, nextSibling, ns);
          vnode.dom = vnode.instance.dom;
          vnode.domSize = vnode.instance.domSize;
        } else {
          if (old.instance != null) removeNode(parent, old.instance);
          vnode.domSize = 0;
        }
      }
      function getKeyMap(vnodes, start, end) {
        var map = /* @__PURE__ */ Object.create(null);
        for (; start < end; start++) {
          var vnode = vnodes[start];
          if (vnode != null) {
            var key = vnode.key;
            if (key != null) map[key] = start;
          }
        }
        return map;
      }
      var lisTemp = [];
      function makeLisIndices(a) {
        var result = [0];
        var u = 0, v = 0, i = 0;
        var il = lisTemp.length = a.length;
        for (var i = 0; i < il; i++) lisTemp[i] = a[i];
        for (var i = 0; i < il; ++i) {
          if (a[i] === -1) continue;
          var j = result[result.length - 1];
          if (a[j] < a[i]) {
            lisTemp[i] = j;
            result.push(i);
            continue;
          }
          u = 0;
          v = result.length - 1;
          while (u < v) {
            var c = (u >>> 1) + (v >>> 1) + (u & v & 1);
            if (a[result[c]] < a[i]) {
              u = c + 1;
            } else {
              v = c;
            }
          }
          if (a[i] < a[result[u]]) {
            if (u > 0) lisTemp[i] = result[u - 1];
            result[u] = i;
          }
        }
        u = result.length;
        v = result[u - 1];
        while (u-- > 0) {
          result[u] = v;
          v = lisTemp[v];
        }
        lisTemp.length = 0;
        return result;
      }
      function getNextSibling(vnodes, i, nextSibling) {
        for (; i < vnodes.length; i++) {
          if (vnodes[i] != null && vnodes[i].dom != null) return vnodes[i].dom;
        }
        return nextSibling;
      }
      function moveDOM(parent, vnode, nextSibling) {
        if (vnode.dom != null) {
          var target;
          if (vnode.domSize == null || vnode.domSize === 1) {
            target = vnode.dom;
          } else {
            target = getDocument(parent).createDocumentFragment();
            for (var dom of domFor(vnode)) target.appendChild(dom);
          }
          insertDOM(parent, target, nextSibling);
        }
      }
      function insertDOM(parent, dom, nextSibling) {
        if (nextSibling != null) parent.insertBefore(dom, nextSibling);
        else parent.appendChild(dom);
      }
      function maybeSetContentEditable(vnode) {
        if (vnode.attrs == null || vnode.attrs.contenteditable == null && // attribute
        vnode.attrs.contentEditable == null) return false;
        var children = vnode.children;
        if (children != null && children.length === 1 && children[0].tag === "<") {
          var content = children[0].children;
          if (vnode.dom.innerHTML !== content) vnode.dom.innerHTML = content;
        } else if (children != null && children.length !== 0) throw new Error("Child node of a contenteditable must be trusted.");
        return true;
      }
      function removeNodes(parent, vnodes, start, end) {
        for (var i = start; i < end; i++) {
          var vnode = vnodes[i];
          if (vnode != null) removeNode(parent, vnode);
        }
      }
      function tryBlockRemove(parent, vnode, source, counter) {
        var original = vnode.state;
        var result = callHook.call(source.onbeforeremove, vnode);
        if (result == null) return;
        var generation = currentRender;
        for (var dom of domFor(vnode)) delayedRemoval.set(dom, generation);
        counter.v++;
        Promise.resolve(result).finally(function() {
          checkState(vnode, original);
          tryResumeRemove(parent, vnode, counter);
        });
      }
      function tryResumeRemove(parent, vnode, counter) {
        if (--counter.v === 0) {
          onremove(vnode);
          removeDOM(parent, vnode);
        }
      }
      function removeNode(parent, vnode) {
        var counter = { v: 1 };
        if (typeof vnode.tag !== "string" && typeof vnode.state.onbeforeremove === "function") tryBlockRemove(parent, vnode, vnode.state, counter);
        if (vnode.attrs && typeof vnode.attrs.onbeforeremove === "function") tryBlockRemove(parent, vnode, vnode.attrs, counter);
        tryResumeRemove(parent, vnode, counter);
      }
      function removeDOM(parent, vnode) {
        if (vnode.dom == null) return;
        if (vnode.domSize == null || vnode.domSize === 1) {
          parent.removeChild(vnode.dom);
        } else {
          for (var dom of domFor(vnode)) parent.removeChild(dom);
        }
      }
      function onremove(vnode) {
        if (typeof vnode.tag !== "string" && typeof vnode.state.onremove === "function") callHook.call(vnode.state.onremove, vnode);
        if (vnode.attrs && typeof vnode.attrs.onremove === "function") callHook.call(vnode.attrs.onremove, vnode);
        if (typeof vnode.tag !== "string") {
          if (vnode.instance != null) onremove(vnode.instance);
        } else {
          if (vnode.events != null) vnode.events._ = null;
          var children = vnode.children;
          if (Array.isArray(children)) {
            for (var i = 0; i < children.length; i++) {
              var child = children[i];
              if (child != null) onremove(child);
            }
          }
        }
      }
      function setAttrs(vnode, attrs, ns) {
        for (var key in attrs) {
          setAttr(vnode, key, null, attrs[key], ns);
        }
      }
      function setAttr(vnode, key, old, value, ns) {
        if (key === "key" || value == null || isLifecycleMethod(key) || old === value && !isFormAttribute(vnode, key) && typeof value !== "object") return;
        if (key[0] === "o" && key[1] === "n") return updateEvent(vnode, key, value);
        if (key.slice(0, 6) === "xlink:") vnode.dom.setAttributeNS("http://www.w3.org/1999/xlink", key.slice(6), value);
        else if (key === "style") updateStyle(vnode.dom, old, value);
        else if (hasPropertyKey(vnode, key, ns)) {
          if (key === "value") {
            if ((vnode.tag === "input" || vnode.tag === "textarea") && vnode.dom.value === "" + value) return;
            if (vnode.tag === "select" && old !== null && vnode.dom.value === "" + value) return;
            if (vnode.tag === "option" && old !== null && vnode.dom.value === "" + value) return;
            if (vnode.tag === "input" && vnode.attrs.type === "file" && "" + value !== "") {
              console.error("`value` is read-only on file inputs!");
              return;
            }
          }
          if (vnode.tag === "input" && key === "type") vnode.dom.setAttribute(key, value);
          else vnode.dom[key] = value;
        } else {
          if (typeof value === "boolean") {
            if (value) vnode.dom.setAttribute(key, "");
            else vnode.dom.removeAttribute(key);
          } else vnode.dom.setAttribute(key === "className" ? "class" : key, value);
        }
      }
      function removeAttr(vnode, key, old, ns) {
        if (key === "key" || old == null || isLifecycleMethod(key)) return;
        if (key[0] === "o" && key[1] === "n") updateEvent(vnode, key, void 0);
        else if (key === "style") updateStyle(vnode.dom, old, null);
        else if (hasPropertyKey(vnode, key, ns) && key !== "className" && key !== "title" && !(key === "value" && (vnode.tag === "option" || vnode.tag === "select" && vnode.dom.selectedIndex === -1 && vnode.dom === activeElement(vnode.dom))) && !(vnode.tag === "input" && key === "type")) {
          vnode.dom[key] = null;
        } else {
          var nsLastIndex = key.indexOf(":");
          if (nsLastIndex !== -1) key = key.slice(nsLastIndex + 1);
          if (old !== false) vnode.dom.removeAttribute(key === "className" ? "class" : key);
        }
      }
      function setLateSelectAttrs(vnode, attrs) {
        if ("value" in attrs) {
          if (attrs.value === null) {
            if (vnode.dom.selectedIndex !== -1) vnode.dom.value = null;
          } else {
            var normalized = "" + attrs.value;
            if (vnode.dom.value !== normalized || vnode.dom.selectedIndex === -1) {
              vnode.dom.value = normalized;
            }
          }
        }
        if ("selectedIndex" in attrs) setAttr(vnode, "selectedIndex", null, attrs.selectedIndex, void 0);
      }
      function updateAttrs(vnode, old, attrs, ns) {
        var val;
        if (old != null) {
          if (old === attrs && !cachedAttrsIsStaticMap.has(attrs)) {
            console.warn("Don't reuse attrs object, use new object for every redraw, this will throw in next major");
          }
          for (var key in old) {
            if ((val = old[key]) != null && (attrs == null || attrs[key] == null)) {
              removeAttr(vnode, key, val, ns);
            }
          }
        }
        if (attrs != null) {
          for (var key in attrs) {
            setAttr(vnode, key, old && old[key], attrs[key], ns);
          }
        }
      }
      function isFormAttribute(vnode, attr) {
        return attr === "value" || attr === "checked" || attr === "selectedIndex" || attr === "selected" && (vnode.dom === activeElement(vnode.dom) || vnode.tag === "option" && vnode.dom.parentNode === activeElement(vnode.dom));
      }
      function isLifecycleMethod(attr) {
        return attr === "oninit" || attr === "oncreate" || attr === "onupdate" || attr === "onremove" || attr === "onbeforeremove" || attr === "onbeforeupdate";
      }
      function hasPropertyKey(vnode, key, ns) {
        return ns === void 0 && // If it's a custom element, just keep it.
        (vnode.tag.indexOf("-") > -1 || vnode.is || // If it's a normal element, let's try to avoid a few browser bugs.
        key !== "href" && key !== "list" && key !== "form" && key !== "width" && key !== "height") && key in vnode.dom;
      }
      function updateStyle(element, old, style) {
        if (old === style) {
        } else if (style == null) {
          element.style = "";
        } else if (typeof style !== "object") {
          element.style = style;
        } else if (old == null || typeof old !== "object") {
          element.style = "";
          for (var key in style) {
            var value = style[key];
            if (value != null) {
              if (key.includes("-")) element.style.setProperty(key, String(value));
              else element.style[key] = String(value);
            }
          }
        } else {
          for (var key in old) {
            if (old[key] != null && style[key] == null) {
              if (key.includes("-")) element.style.removeProperty(key);
              else element.style[key] = "";
            }
          }
          for (var key in style) {
            var value = style[key];
            if (value != null && (value = String(value)) !== String(old[key])) {
              if (key.includes("-")) element.style.setProperty(key, value);
              else element.style[key] = value;
            }
          }
        }
      }
      function EventDict() {
        this._ = currentRedraw;
      }
      EventDict.prototype = /* @__PURE__ */ Object.create(null);
      EventDict.prototype.handleEvent = function(ev) {
        var handler = this["on" + ev.type];
        var result;
        if (typeof handler === "function") result = handler.call(ev.currentTarget, ev);
        else if (typeof handler.handleEvent === "function") handler.handleEvent(ev);
        var self = this;
        if (self._ != null) {
          if (ev.redraw !== false) (0, self._)();
          if (result != null && typeof result.then === "function") {
            Promise.resolve(result).then(function() {
              if (self._ != null && ev.redraw !== false) (0, self._)();
            });
          }
        }
        if (result === false) {
          ev.preventDefault();
          ev.stopPropagation();
        }
      };
      function updateEvent(vnode, key, value) {
        if (vnode.events != null) {
          vnode.events._ = currentRedraw;
          if (vnode.events[key] === value) return;
          if (value != null && (typeof value === "function" || typeof value === "object")) {
            if (vnode.events[key] == null) vnode.dom.addEventListener(key.slice(2), vnode.events, false);
            vnode.events[key] = value;
          } else {
            if (vnode.events[key] != null) vnode.dom.removeEventListener(key.slice(2), vnode.events, false);
            vnode.events[key] = void 0;
          }
        } else if (value != null && (typeof value === "function" || typeof value === "object")) {
          vnode.events = new EventDict();
          vnode.dom.addEventListener(key.slice(2), vnode.events, false);
          vnode.events[key] = value;
        }
      }
      function initLifecycle(source, vnode, hooks) {
        if (typeof source.oninit === "function") callHook.call(source.oninit, vnode);
        if (typeof source.oncreate === "function") hooks.push(callHook.bind(source.oncreate, vnode));
      }
      function updateLifecycle(source, vnode, hooks) {
        if (typeof source.onupdate === "function") hooks.push(callHook.bind(source.onupdate, vnode));
      }
      function shouldNotUpdate(vnode, old) {
        do {
          if (vnode.attrs != null && typeof vnode.attrs.onbeforeupdate === "function") {
            var force = callHook.call(vnode.attrs.onbeforeupdate, vnode, old);
            if (force !== void 0 && !force) break;
          }
          if (typeof vnode.tag !== "string" && typeof vnode.state.onbeforeupdate === "function") {
            var force = callHook.call(vnode.state.onbeforeupdate, vnode, old);
            if (force !== void 0 && !force) break;
          }
          return false;
        } while (false);
        vnode.dom = old.dom;
        vnode.domSize = old.domSize;
        vnode.instance = old.instance;
        vnode.attrs = old.attrs;
        vnode.children = old.children;
        vnode.text = old.text;
        return true;
      }
      var currentDOM;
      return function(dom, vnodes, redraw2) {
        if (!dom) throw new TypeError("DOM element being rendered to does not exist.");
        if (currentDOM != null && dom.contains(currentDOM)) {
          throw new TypeError("Node is currently being rendered to and thus is locked.");
        }
        var prevRedraw = currentRedraw;
        var prevDOM = currentDOM;
        var hooks = [];
        var active = activeElement(dom);
        var namespace = dom.namespaceURI;
        currentDOM = dom;
        currentRedraw = typeof redraw2 === "function" ? redraw2 : void 0;
        currentRender = {};
        try {
          if (dom.vnodes == null) dom.textContent = "";
          vnodes = Vnode.normalizeChildren(Array.isArray(vnodes) ? vnodes : [vnodes]);
          updateNodes(dom, dom.vnodes, vnodes, hooks, null, namespace === "http://www.w3.org/1999/xhtml" ? void 0 : namespace);
          dom.vnodes = vnodes;
          if (active != null && activeElement(dom) !== active && typeof active.focus === "function") active.focus();
          for (var i = 0; i < hooks.length; i++) hooks[i]();
        } finally {
          currentRedraw = prevRedraw;
          currentDOM = prevDOM;
        }
      };
    };
  }
});

// node_modules/mithril/render.js
var require_render2 = __commonJS({
  "node_modules/mithril/render.js"(exports2, module2) {
    "use strict";
    module2.exports = require_render()();
  }
});

// node_modules/mithril/api/mount-redraw.js
var require_mount_redraw = __commonJS({
  "node_modules/mithril/api/mount-redraw.js"(exports2, module2) {
    "use strict";
    var Vnode = require_vnode();
    module2.exports = function(render, schedule, console2) {
      var subscriptions = [];
      var pending = false;
      var offset = -1;
      function sync() {
        for (offset = 0; offset < subscriptions.length; offset += 2) {
          try {
            render(subscriptions[offset], Vnode(subscriptions[offset + 1]), redraw2);
          } catch (e) {
            console2.error(e);
          }
        }
        offset = -1;
      }
      function redraw2() {
        if (!pending) {
          pending = true;
          schedule(function() {
            pending = false;
            sync();
          });
        }
      }
      redraw2.sync = sync;
      function mount(root, component) {
        if (component != null && component.view == null && typeof component !== "function") {
          throw new TypeError("m.mount expects a component, not a vnode.");
        }
        var index = subscriptions.indexOf(root);
        if (index >= 0) {
          subscriptions.splice(index, 2);
          if (index <= offset) offset -= 2;
          render(root, []);
        }
        if (component != null) {
          subscriptions.push(root, component);
          render(root, Vnode(component), redraw2);
        }
      }
      return { mount, redraw: redraw2 };
    };
  }
});

// node_modules/mithril/mount-redraw.js
var require_mount_redraw2 = __commonJS({
  "node_modules/mithril/mount-redraw.js"(exports2, module2) {
    "use strict";
    var render = require_render2();
    module2.exports = require_mount_redraw()(render, typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : null, typeof console !== "undefined" ? console : null);
  }
});

// node_modules/mithril/querystring/build.js
var require_build = __commonJS({
  "node_modules/mithril/querystring/build.js"(exports2, module2) {
    "use strict";
    module2.exports = function(object) {
      if (Object.prototype.toString.call(object) !== "[object Object]") return "";
      var args = [];
      for (var key in object) {
        destructure(key, object[key]);
      }
      return args.join("&");
      function destructure(key2, value) {
        if (Array.isArray(value)) {
          for (var i = 0; i < value.length; i++) {
            destructure(key2 + "[" + i + "]", value[i]);
          }
        } else if (Object.prototype.toString.call(value) === "[object Object]") {
          for (var i in value) {
            destructure(key2 + "[" + i + "]", value[i]);
          }
        } else args.push(encodeURIComponent(key2) + (value != null && value !== "" ? "=" + encodeURIComponent(value) : ""));
      }
    };
  }
});

// node_modules/mithril/pathname/build.js
var require_build2 = __commonJS({
  "node_modules/mithril/pathname/build.js"(exports2, module2) {
    "use strict";
    var buildQueryString = require_build();
    module2.exports = function(template, params) {
      if (/:([^\/\.-]+)(\.{3})?:/.test(template)) {
        throw new SyntaxError("Template parameter names must be separated by either a '/', '-', or '.'.");
      }
      if (params == null) return template;
      var queryIndex = template.indexOf("?");
      var hashIndex = template.indexOf("#");
      var queryEnd = hashIndex < 0 ? template.length : hashIndex;
      var pathEnd = queryIndex < 0 ? queryEnd : queryIndex;
      var path = template.slice(0, pathEnd);
      var query = {};
      Object.assign(query, params);
      var resolved = path.replace(/:([^\/\.-]+)(\.{3})?/g, function(m, key, variadic) {
        delete query[key];
        if (params[key] == null) return m;
        return variadic ? params[key] : encodeURIComponent(String(params[key]));
      });
      var newQueryIndex = resolved.indexOf("?");
      var newHashIndex = resolved.indexOf("#");
      var newQueryEnd = newHashIndex < 0 ? resolved.length : newHashIndex;
      var newPathEnd = newQueryIndex < 0 ? newQueryEnd : newQueryIndex;
      var result = resolved.slice(0, newPathEnd);
      if (queryIndex >= 0) result += template.slice(queryIndex, queryEnd);
      if (newQueryIndex >= 0) result += (queryIndex < 0 ? "?" : "&") + resolved.slice(newQueryIndex, newQueryEnd);
      var querystring = buildQueryString(query);
      if (querystring) result += (queryIndex < 0 && newQueryIndex < 0 ? "?" : "&") + querystring;
      if (hashIndex >= 0) result += template.slice(hashIndex);
      if (newHashIndex >= 0) result += (hashIndex < 0 ? "" : "&") + resolved.slice(newHashIndex);
      return result;
    };
  }
});

// node_modules/mithril/request/request.js
var require_request = __commonJS({
  "node_modules/mithril/request/request.js"(exports2, module2) {
    "use strict";
    var buildPathname = require_build2();
    var hasOwn = require_hasOwn();
    module2.exports = function($window, oncompletion) {
      function PromiseProxy(executor) {
        return new Promise(executor);
      }
      function makeRequest(url, args) {
        return new Promise(function(resolve, reject) {
          url = buildPathname(url, args.params);
          var method = args.method != null ? args.method.toUpperCase() : "GET";
          var body = args.body;
          var assumeJSON = (args.serialize == null || args.serialize === JSON.serialize) && !(body instanceof $window.FormData || body instanceof $window.URLSearchParams);
          var responseType = args.responseType || (typeof args.extract === "function" ? "" : "json");
          var xhr = new $window.XMLHttpRequest(), aborted = false, isTimeout = false;
          var original = xhr, replacedAbort;
          var abort = xhr.abort;
          xhr.abort = function() {
            aborted = true;
            abort.call(this);
          };
          xhr.open(method, url, args.async !== false, typeof args.user === "string" ? args.user : void 0, typeof args.password === "string" ? args.password : void 0);
          if (assumeJSON && body != null && !hasHeader(args, "content-type")) {
            xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");
          }
          if (typeof args.deserialize !== "function" && !hasHeader(args, "accept")) {
            xhr.setRequestHeader("Accept", "application/json, text/*");
          }
          if (args.withCredentials) xhr.withCredentials = args.withCredentials;
          if (args.timeout) xhr.timeout = args.timeout;
          xhr.responseType = responseType;
          for (var key in args.headers) {
            if (hasOwn.call(args.headers, key)) {
              xhr.setRequestHeader(key, args.headers[key]);
            }
          }
          xhr.onreadystatechange = function(ev) {
            if (aborted) return;
            if (ev.target.readyState === 4) {
              try {
                var success = ev.target.status >= 200 && ev.target.status < 300 || ev.target.status === 304 || /^file:\/\//i.test(url);
                var response = ev.target.response, message;
                if (responseType === "json") {
                  if (!ev.target.responseType && typeof args.extract !== "function") {
                    try {
                      response = JSON.parse(ev.target.responseText);
                    } catch (e) {
                      response = null;
                    }
                  }
                } else if (!responseType || responseType === "text") {
                  if (response == null) response = ev.target.responseText;
                }
                if (typeof args.extract === "function") {
                  response = args.extract(ev.target, args);
                  success = true;
                } else if (typeof args.deserialize === "function") {
                  response = args.deserialize(response);
                }
                if (success) {
                  if (typeof args.type === "function") {
                    if (Array.isArray(response)) {
                      for (var i = 0; i < response.length; i++) {
                        response[i] = new args.type(response[i]);
                      }
                    } else response = new args.type(response);
                  }
                  resolve(response);
                } else {
                  var completeErrorResponse = function() {
                    try {
                      message = ev.target.responseText;
                    } catch (e) {
                      message = response;
                    }
                    var error = new Error(message);
                    error.code = ev.target.status;
                    error.response = response;
                    reject(error);
                  };
                  if (xhr.status === 0) {
                    setTimeout(function() {
                      if (isTimeout) return;
                      completeErrorResponse();
                    });
                  } else completeErrorResponse();
                }
              } catch (e) {
                reject(e);
              }
            }
          };
          xhr.ontimeout = function(ev) {
            isTimeout = true;
            var error = new Error("Request timed out");
            error.code = ev.target.status;
            reject(error);
          };
          if (typeof args.config === "function") {
            xhr = args.config(xhr, args, url) || xhr;
            if (xhr !== original) {
              replacedAbort = xhr.abort;
              xhr.abort = function() {
                aborted = true;
                replacedAbort.call(this);
              };
            }
          }
          if (body == null) xhr.send();
          else if (typeof args.serialize === "function") xhr.send(args.serialize(body));
          else if (body instanceof $window.FormData || body instanceof $window.URLSearchParams) xhr.send(body);
          else xhr.send(JSON.stringify(body));
        });
      }
      PromiseProxy.prototype = Promise.prototype;
      PromiseProxy.__proto__ = Promise;
      function hasHeader(args, name) {
        for (var key in args.headers) {
          if (hasOwn.call(args.headers, key) && key.toLowerCase() === name) return true;
        }
        return false;
      }
      return {
        request: function(url, args) {
          if (typeof url !== "string") {
            args = url;
            url = url.url;
          } else if (args == null) args = {};
          var promise = makeRequest(url, args);
          if (args.background === true) return promise;
          var count = 0;
          function complete() {
            if (--count === 0 && typeof oncompletion === "function") oncompletion();
          }
          return wrap(promise);
          function wrap(promise2) {
            var then = promise2.then;
            promise2.constructor = PromiseProxy;
            promise2.then = function() {
              count++;
              var next = then.apply(promise2, arguments);
              next.then(complete, function(e) {
                complete();
                if (count === 0) throw e;
              });
              return wrap(next);
            };
            return promise2;
          }
        }
      };
    };
  }
});

// node_modules/mithril/request.js
var require_request2 = __commonJS({
  "node_modules/mithril/request.js"(exports2, module2) {
    "use strict";
    var mountRedraw = require_mount_redraw2();
    module2.exports = require_request()(typeof window !== "undefined" ? window : null, mountRedraw.redraw);
  }
});

// node_modules/mithril/util/decodeURIComponentSafe.js
var require_decodeURIComponentSafe = __commonJS({
  "node_modules/mithril/util/decodeURIComponentSafe.js"(exports2, module2) {
    "use strict";
    var validUtf8Encodings = /%(?:[0-7]|(?!c[01]|e0%[89]|ed%[ab]|f0%8|f4%[9ab])(?:c|d|(?:e|f[0-4]%[89ab])[\da-f]%[89ab])[\da-f]%[89ab])[\da-f]/gi;
    module2.exports = function(str) {
      return String(str).replace(validUtf8Encodings, decodeURIComponent);
    };
  }
});

// node_modules/mithril/querystring/parse.js
var require_parse = __commonJS({
  "node_modules/mithril/querystring/parse.js"(exports2, module2) {
    "use strict";
    var decodeURIComponentSafe = require_decodeURIComponentSafe();
    module2.exports = function(string) {
      if (string === "" || string == null) return {};
      if (string.charAt(0) === "?") string = string.slice(1);
      var entries = string.split("&"), counters = {}, data = {};
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i].split("=");
        var key = decodeURIComponentSafe(entry[0]);
        var value = entry.length === 2 ? decodeURIComponentSafe(entry[1]) : "";
        if (value === "true") value = true;
        else if (value === "false") value = false;
        var levels = key.split(/\]\[?|\[/);
        var cursor = data;
        if (key.indexOf("[") > -1) levels.pop();
        for (var j = 0; j < levels.length; j++) {
          var level = levels[j], nextLevel = levels[j + 1];
          var isNumber = nextLevel == "" || !isNaN(parseInt(nextLevel, 10));
          if (level === "") {
            var key = levels.slice(0, j).join();
            if (counters[key] == null) {
              counters[key] = Array.isArray(cursor) ? cursor.length : 0;
            }
            level = counters[key]++;
          } else if (level === "__proto__") break;
          if (j === levels.length - 1) cursor[level] = value;
          else {
            var desc = Object.getOwnPropertyDescriptor(cursor, level);
            if (desc != null) desc = desc.value;
            if (desc == null) cursor[level] = desc = isNumber ? [] : {};
            cursor = desc;
          }
        }
      }
      return data;
    };
  }
});

// node_modules/mithril/pathname/parse.js
var require_parse2 = __commonJS({
  "node_modules/mithril/pathname/parse.js"(exports2, module2) {
    "use strict";
    var parseQueryString = require_parse();
    module2.exports = function(url) {
      var queryIndex = url.indexOf("?");
      var hashIndex = url.indexOf("#");
      var queryEnd = hashIndex < 0 ? url.length : hashIndex;
      var pathEnd = queryIndex < 0 ? queryEnd : queryIndex;
      var path = url.slice(0, pathEnd).replace(/\/{2,}/g, "/");
      if (!path) path = "/";
      else {
        if (path[0] !== "/") path = "/" + path;
      }
      return {
        path,
        params: queryIndex < 0 ? {} : parseQueryString(url.slice(queryIndex + 1, queryEnd))
      };
    };
  }
});

// node_modules/mithril/pathname/compileTemplate.js
var require_compileTemplate = __commonJS({
  "node_modules/mithril/pathname/compileTemplate.js"(exports2, module2) {
    "use strict";
    var parsePathname = require_parse2();
    module2.exports = function(template) {
      var templateData = parsePathname(template);
      var templateKeys = Object.keys(templateData.params);
      var keys = [];
      var regexp = new RegExp("^" + templateData.path.replace(
        // I escape literal text so people can use things like `:file.:ext` or
        // `:lang-:locale` in routes. This is all merged into one pass so I
        // don't also accidentally escape `-` and make it harder to detect it to
        // ban it from template parameters.
        /:([^\/.-]+)(\.{3}|\.(?!\.)|-)?|[\\^$*+.()|\[\]{}]/g,
        function(m, key, extra) {
          if (key == null) return "\\" + m;
          keys.push({ k: key, r: extra === "..." });
          if (extra === "...") return "(.*)";
          if (extra === ".") return "([^/]+)\\.";
          return "([^/]+)" + (extra || "");
        }
      ) + "\\/?$");
      return function(data) {
        for (var i = 0; i < templateKeys.length; i++) {
          if (templateData.params[templateKeys[i]] !== data.params[templateKeys[i]]) return false;
        }
        if (!keys.length) return regexp.test(data.path);
        var values = regexp.exec(data.path);
        if (values == null) return false;
        for (var i = 0; i < keys.length; i++) {
          data.params[keys[i].k] = keys[i].r ? values[i + 1] : decodeURIComponent(values[i + 1]);
        }
        return true;
      };
    };
  }
});

// node_modules/mithril/util/censor.js
var require_censor = __commonJS({
  "node_modules/mithril/util/censor.js"(exports2, module2) {
    "use strict";
    var hasOwn = require_hasOwn();
    var magic = /^(?:key|oninit|oncreate|onbeforeupdate|onupdate|onbeforeremove|onremove)$/;
    module2.exports = function(attrs, extras) {
      var result = {};
      if (extras != null) {
        for (var key in attrs) {
          if (hasOwn.call(attrs, key) && !magic.test(key) && extras.indexOf(key) < 0) {
            result[key] = attrs[key];
          }
        }
      } else {
        for (var key in attrs) {
          if (hasOwn.call(attrs, key) && !magic.test(key)) {
            result[key] = attrs[key];
          }
        }
      }
      return result;
    };
  }
});

// node_modules/mithril/api/router.js
var require_router = __commonJS({
  "node_modules/mithril/api/router.js"(exports2, module2) {
    "use strict";
    var Vnode = require_vnode();
    var hyperscript = require_hyperscript();
    var decodeURIComponentSafe = require_decodeURIComponentSafe();
    var buildPathname = require_build2();
    var parsePathname = require_parse2();
    var compileTemplate = require_compileTemplate();
    var censor = require_censor();
    module2.exports = function($window, mountRedraw) {
      var p = Promise.resolve();
      var scheduled = false;
      var ready = false;
      var hasBeenResolved = false;
      var dom, compiled, fallbackRoute;
      var currentResolver, component, attrs, currentPath, lastUpdate;
      var RouterRoot = {
        onremove: function() {
          ready = hasBeenResolved = false;
          $window.removeEventListener("popstate", fireAsync, false);
        },
        view: function() {
          var vnode = Vnode(component, attrs.key, attrs);
          if (currentResolver) return currentResolver.render(vnode);
          return [vnode];
        }
      };
      var SKIP = route.SKIP = {};
      function resolveRoute() {
        scheduled = false;
        var prefix = $window.location.hash;
        if (route.prefix[0] !== "#") {
          prefix = $window.location.search + prefix;
          if (route.prefix[0] !== "?") {
            prefix = $window.location.pathname + prefix;
            if (prefix[0] !== "/") prefix = "/" + prefix;
          }
        }
        var path = decodeURIComponentSafe(prefix).slice(route.prefix.length);
        var data = parsePathname(path);
        Object.assign(data.params, $window.history.state);
        function reject(e) {
          console.error(e);
          route.set(fallbackRoute, null, { replace: true });
        }
        loop(0);
        function loop(i) {
          for (; i < compiled.length; i++) {
            if (compiled[i].check(data)) {
              var payload = compiled[i].component;
              var matchedRoute = compiled[i].route;
              var localComp = payload;
              var update = lastUpdate = function(comp) {
                if (update !== lastUpdate) return;
                if (comp === SKIP) return loop(i + 1);
                component = comp != null && (typeof comp.view === "function" || typeof comp === "function") ? comp : "div";
                attrs = data.params, currentPath = path, lastUpdate = null;
                currentResolver = payload.render ? payload : null;
                if (hasBeenResolved) mountRedraw.redraw();
                else {
                  hasBeenResolved = true;
                  mountRedraw.mount(dom, RouterRoot);
                }
              };
              if (payload.view || typeof payload === "function") {
                payload = {};
                update(localComp);
              } else if (payload.onmatch) {
                p.then(function() {
                  return payload.onmatch(data.params, path, matchedRoute);
                }).then(update, path === fallbackRoute ? null : reject);
              } else update(
                /* "div" */
              );
              return;
            }
          }
          if (path === fallbackRoute) {
            throw new Error("Could not resolve default route " + fallbackRoute + ".");
          }
          route.set(fallbackRoute, null, { replace: true });
        }
      }
      function fireAsync() {
        if (!scheduled) {
          scheduled = true;
          setTimeout(resolveRoute);
        }
      }
      function route(root, defaultRoute, routes) {
        if (!root) throw new TypeError("DOM element being rendered to does not exist.");
        compiled = Object.keys(routes).map(function(route2) {
          if (route2[0] !== "/") throw new SyntaxError("Routes must start with a '/'.");
          if (/:([^\/\.-]+)(\.{3})?:/.test(route2)) {
            throw new SyntaxError("Route parameter names must be separated with either '/', '.', or '-'.");
          }
          return {
            route: route2,
            component: routes[route2],
            check: compileTemplate(route2)
          };
        });
        fallbackRoute = defaultRoute;
        if (defaultRoute != null) {
          var defaultData = parsePathname(defaultRoute);
          if (!compiled.some(function(i) {
            return i.check(defaultData);
          })) {
            throw new ReferenceError("Default route doesn't match any known routes.");
          }
        }
        dom = root;
        $window.addEventListener("popstate", fireAsync, false);
        ready = true;
        resolveRoute();
      }
      route.set = function(path, data, options) {
        if (lastUpdate != null) {
          options = options || {};
          options.replace = true;
        }
        lastUpdate = null;
        path = buildPathname(path, data);
        if (ready) {
          fireAsync();
          var state = options ? options.state : null;
          var title = options ? options.title : null;
          if (options && options.replace) $window.history.replaceState(state, title, route.prefix + path);
          else $window.history.pushState(state, title, route.prefix + path);
        } else {
          $window.location.href = route.prefix + path;
        }
      };
      route.get = function() {
        return currentPath;
      };
      route.prefix = "#!";
      route.Link = {
        view: function(vnode) {
          var child = hyperscript(
            vnode.attrs.selector || "a",
            censor(vnode.attrs, ["options", "params", "selector", "onclick"]),
            vnode.children
          );
          var options, onclick, href;
          if (child.attrs.disabled = Boolean(child.attrs.disabled)) {
            child.attrs.href = null;
            child.attrs["aria-disabled"] = "true";
          } else {
            options = vnode.attrs.options;
            onclick = vnode.attrs.onclick;
            href = buildPathname(child.attrs.href, vnode.attrs.params);
            child.attrs.href = route.prefix + href;
            child.attrs.onclick = function(e) {
              var result;
              if (typeof onclick === "function") {
                result = onclick.call(e.currentTarget, e);
              } else if (onclick == null || typeof onclick !== "object") {
              } else if (typeof onclick.handleEvent === "function") {
                onclick.handleEvent(e);
              }
              if (
                // Skip if `onclick` prevented default
                result !== false && !e.defaultPrevented && // Ignore everything but left clicks
                (e.button === 0 || e.which === 0 || e.which === 1) && // Let the browser handle `target=_blank`, etc.
                (!e.currentTarget.target || e.currentTarget.target === "_self") && // No modifier keys
                !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey
              ) {
                e.preventDefault();
                e.redraw = false;
                route.set(href, null, options);
              }
            };
          }
          return child;
        }
      };
      route.param = function(key) {
        return attrs && key != null ? attrs[key] : attrs;
      };
      return route;
    };
  }
});

// node_modules/mithril/route.js
var require_route = __commonJS({
  "node_modules/mithril/route.js"(exports2, module2) {
    "use strict";
    var mountRedraw = require_mount_redraw2();
    module2.exports = require_router()(typeof window !== "undefined" ? window : null, mountRedraw);
  }
});

// node_modules/mithril/index.js
var require_mithril = __commonJS({
  "node_modules/mithril/index.js"(exports2, module2) {
    "use strict";
    var hyperscript = require_hyperscript2();
    var mountRedraw = require_mount_redraw2();
    var request = require_request2();
    var router = require_route();
    var m = function m2() {
      return hyperscript.apply(this, arguments);
    };
    m.m = hyperscript;
    m.trust = hyperscript.trust;
    m.fragment = hyperscript.fragment;
    m.Fragment = "[";
    m.mount = mountRedraw.mount;
    m.route = router;
    m.render = require_render2();
    m.redraw = mountRedraw.redraw;
    m.request = request.request;
    m.parseQueryString = require_parse();
    m.buildQueryString = require_build();
    m.parsePathname = require_parse2();
    m.buildPathname = require_build2();
    m.vnode = require_vnode();
    m.censor = require_censor();
    m.domFor = require_domFor();
    module2.exports = m;
  }
});

// scripts/store-test.ts
var import_node_assert = __toESM(require("node:assert"), 1);

// src/store.ts
var import_mithril = __toESM(require_mithril(), 1);

// src/merge.ts
var STEP_FIELDS = ["type", "statement", "rule", "references", "note", "counterexample", "alternative"];
function sideRefTokens(step, side) {
  return step.references.map((id) => side.idToKey.get(id) ?? id);
}
function hashStep(step, refs) {
  if (!step) return void 0;
  const body = STEP_FIELDS.filter((field) => field !== "references").map((field) => String(step[field])).join("");
  return `${body}${[...new Set(refs)].sort().join(",")}`;
}
function buildSide(steps) {
  const map = /* @__PURE__ */ new Map();
  const idToKey = /* @__PURE__ */ new Map();
  const order = [];
  steps.forEach((step) => {
    if (!step.key || map.has(step.key)) return;
    map.set(step.key, step);
    idToKey.set(step.id, step.key);
    order.push(step.key);
  });
  return { steps: map, order, idToKey };
}
function normalizeBundle(raw) {
  const bundle2 = structuredClone(raw);
  bundle2.format = "sologsb-proof-bundle";
  bundle2.version = 1;
  bundle2.steps ??= [];
  bundle2.symbols ??= {};
  bundle2.versions ??= [];
  bundle2.goal ??= "";
  bundle2.baselineId ??= null;
  let seq = Math.max(0, bundle2.stepSeq ?? 0);
  const used = /* @__PURE__ */ new Set();
  bundle2.steps.forEach((step) => {
    if (!step.key) {
      do {
        seq += 1;
        step.key = `S${seq}`;
      } while (used.has(step.key));
    }
    used.add(step.key);
    ["note", "counterexample", "alternative"].forEach((field) => {
      if (typeof step[field] !== "string") {
        step[field] = "";
      }
    });
    step.references ??= [];
  });
  bundle2.stepSeq = Math.max(seq, ...[...used].map((key) => Number(key.slice(1)) || 0), 0);
  bundle2.versions.forEach((version) => {
    version.symbols ??= {};
  });
  return bundle2;
}
var MergeSession = class {
  legacy;
  baselineId;
  localSide;
  incomingSide;
  baseSide;
  baseGoal;
  baseSymbols;
  baseVersions;
  stepRows = [];
  stepStatus = /* @__PURE__ */ new Map();
  symbolStatus = /* @__PURE__ */ new Map();
  goalStatus;
  stepOrder = [];
  symbolOrder = [];
  incoming;
  localGoal;
  localSymbols;
  constructor(local, incoming) {
    this.incoming = incoming;
    this.localGoal = local.goal;
    this.localSymbols = { ...local.symbols };
    this.localSide = buildSide(local.steps);
    this.incomingSide = buildSide(incoming.steps);
    const baseline = incoming.baselineId ? incoming.versions.find((version) => version.id === incoming.baselineId) : void 0;
    this.legacy = !baseline;
    this.baselineId = baseline?.id ?? null;
    this.baseVersions = incoming.versions;
    if (baseline) {
      this.baseSide = buildSide(baseline.steps);
      this.baseGoal = baseline.goal;
      this.baseSymbols = { ...baseline.symbols };
    } else {
      const commonSteps = local.steps.filter((localStep) => {
        const other = incoming.steps.find((candidate) => candidate.key === localStep.key);
        return other && hashStep(localStep, sideRefTokens(localStep, this.localSide)) === hashStep(other, sideRefTokens(other, this.incomingSide));
      });
      this.baseSide = buildSide(commonSteps);
      this.baseGoal = local.goal === incoming.goal ? local.goal : null;
      this.baseSymbols = Object.fromEntries(
        Object.entries(local.symbols).filter(([key, value]) => incoming.symbols[key] === value)
      );
    }
    this.buildStepRows();
    this.goalStatus = this.computeGoalStatus(local.goal, incoming.goal);
    this.buildSymbolRows(local.symbols, incoming.symbols);
    this.stepOrder = this.computeOrder(this.localSide.order, this.incomingSide.order);
    this.symbolOrder = this.computeOrder(Object.keys(local.symbols), Object.keys(incoming.symbols));
  }
  buildStepRows() {
    const keys = /* @__PURE__ */ new Set([
      ...this.baseSide.steps.keys(),
      ...this.localSide.steps.keys(),
      ...this.incomingSide.steps.keys()
    ]);
    keys.forEach((key) => {
      const local = this.localSide.steps.get(key);
      const incoming = this.incomingSide.steps.get(key);
      const inBase = this.baseSide.steps.has(key);
      let status;
      if (local && incoming) {
        const baseStepHere = this.baseSide.steps.get(key);
        const hb = hashStep(baseStepHere, baseStepHere ? sideRefTokens(baseStepHere, this.baseSide) : []);
        const hl = hashStep(local, sideRefTokens(local, this.localSide));
        const hi = hashStep(incoming, sideRefTokens(incoming, this.incomingSide));
        if (hl === hi) status = "unchanged";
        else if (!inBase || hb === void 0) status = "changed-both";
        else if (hl === hb) status = "changed-incoming";
        else if (hi === hb) status = "changed-local";
        else status = "changed-both";
      } else if (local) {
        const baseStepHere = this.baseSide.steps.get(key);
        const hb = hashStep(baseStepHere, baseStepHere ? sideRefTokens(baseStepHere, this.baseSide) : []);
        const hl = hashStep(local, sideRefTokens(local, this.localSide));
        status = inBase && hb !== void 0 && hl !== hb ? "changed-local-deleted-incoming" : "deleted-incoming";
        if (!inBase) status = "local-only";
      } else if (incoming) {
        const baseStepHere = this.baseSide.steps.get(key);
        const hb = hashStep(baseStepHere, baseStepHere ? sideRefTokens(baseStepHere, this.baseSide) : []);
        const hi = hashStep(incoming, sideRefTokens(incoming, this.incomingSide));
        status = inBase && hb !== void 0 && hi !== hb ? "deleted-local-changed-incoming" : "deleted-local";
        if (!inBase) status = "incoming-only";
      } else {
        return;
      }
      this.stepStatus.set(key, status);
      this.stepRows.push({ key, status, local, incoming });
    });
  }
  computeGoalStatus(localGoal, incomingGoal) {
    if (localGoal === incomingGoal) return "unchanged";
    if (this.baseGoal === null) return "changed-both";
    if (localGoal === this.baseGoal) return "changed-incoming";
    if (incomingGoal === this.baseGoal) return "changed-local";
    return "changed-both";
  }
  buildSymbolRows(localSymbols, incomingSymbols) {
    const keys = /* @__PURE__ */ new Set([...Object.keys(this.baseSymbols), ...Object.keys(localSymbols), ...Object.keys(incomingSymbols)]);
    keys.forEach((key) => {
      const local = localSymbols[key];
      const incoming = incomingSymbols[key];
      const base = this.baseSymbols[key];
      const localExists = key in localSymbols;
      const incomingExists = key in incomingSymbols;
      let status;
      if (localExists && incomingExists) {
        if (local === incoming) status = "unchanged";
        else if (!(key in this.baseSymbols)) status = "changed-both";
        else if (local === base) status = "changed-incoming";
        else if (incoming === base) status = "changed-local";
        else status = "changed-both";
      } else if (localExists) {
        status = key in this.baseSymbols && local !== base ? "changed-local-deleted-incoming" : "deleted-incoming";
        if (!(key in this.baseSymbols)) status = "local-only";
      } else if (incomingExists) {
        status = key in this.baseSymbols && incoming !== base ? "deleted-local-changed-incoming" : "deleted-local";
        if (!(key in this.baseSymbols)) status = "incoming-only";
      } else {
        return;
      }
      this.symbolStatus.set(key, status);
    });
  }
  /** 以本地顺序为基线，把另一侧独有步骤按相邻锚点插入；纯删除不留空 */
  computeOrder(localOrder, incomingOrder) {
    const ordered = [...localOrder];
    const present = new Set(ordered);
    incomingOrder.forEach((key) => {
      if (present.has(key)) return;
      const index = incomingOrder.indexOf(key);
      let anchor = -1;
      for (let i = index - 1; i >= 0; i -= 1) {
        anchor = ordered.indexOf(incomingOrder[i]);
        if (anchor >= 0) break;
      }
      if (anchor >= 0) {
        ordered.splice(anchor + 1, 0, key);
      } else {
        let nextAnchor = -1;
        for (let i = index + 1; i < incomingOrder.length; i += 1) {
          nextAnchor = ordered.indexOf(incomingOrder[i]);
          if (nextAnchor >= 0) break;
        }
        if (nextAnchor >= 0) ordered.splice(nextAnchor, 0, key);
        else ordered.push(key);
      }
      present.add(key);
    });
    return ordered;
  }
  /** 合并后仍保留的步骤编号 */
  survivingKeys(resolutions) {
    const forced = /* @__PURE__ */ new Set();
    resolutions.forEach((value, id) => {
      if (id.startsWith("dangling:") && value === "keep") forced.add(id.split(":")[2]);
    });
    const result = /* @__PURE__ */ new Set();
    this.stepStatus.forEach((status, key) => {
      switch (status) {
        case "unchanged":
        case "changed-local":
        case "changed-incoming":
        case "changed-both":
        case "local-only":
        case "incoming-only":
          result.add(key);
          break;
        case "deleted-local":
        case "deleted-incoming":
          if (forced.has(key)) result.add(key);
          break;
        case "changed-local-deleted-incoming":
        case "deleted-local-changed-incoming":
          if (resolutions.get(`moddelete-step:${key}`) === "keep" || forced.has(key)) result.add(key);
          break;
      }
    });
    return result;
  }
  /** 当前裁决下每个保留步骤实际采用的版本（local / incoming） */
  chosenSteps(resolutions) {
    const alive = this.survivingKeys(resolutions);
    return this.stepOrder.filter((key) => alive.has(key)).map((key) => {
      const status = this.stepStatus.get(key);
      const local = this.localSide.steps.get(key);
      const incoming = this.incomingSide.steps.get(key);
      let origin;
      switch (status) {
        case "changed-incoming":
        case "incoming-only":
        case "deleted-local-changed-incoming":
          origin = "incoming";
          break;
        case "changed-local":
        case "local-only":
        case "changed-local-deleted-incoming":
          origin = "local";
          break;
        case "changed-both":
          origin = resolutions.get(`step:${key}`) === "keep-incoming" ? "incoming" : "local";
          break;
        default:
          origin = local ? "local" : "incoming";
      }
      const step = (origin === "local" ? local : incoming) ?? local ?? incoming;
      return { key, origin, step };
    });
  }
  chosenGoal(resolutions) {
    switch (this.goalStatus) {
      case "changed-incoming":
        return this.incoming.goal;
      case "changed-local":
        return this.localGoal;
      case "changed-both":
        return resolutions.get("goal") === "keep-incoming" ? this.incoming.goal : this.localGoal;
      default:
        return this.localGoal || this.incoming.goal;
    }
  }
  chosenSymbols(resolutions) {
    const result = {};
    const localSymbols = this.localSymbols;
    this.symbolOrder.forEach((key) => {
      const status = this.symbolStatus.get(key);
      const localExists = key in localSymbols;
      const incomingExists = key in this.incoming.symbols;
      const decision = resolutions.get(`moddelete-symbol:${key}`) ?? resolutions.get(`symbol:${key}`);
      switch (status) {
        case "unchanged":
        case "changed-local":
        case "local-only":
          if (localExists) result[key] = localSymbols[key];
          break;
        case "changed-incoming":
        case "incoming-only":
          if (incomingExists) result[key] = this.incoming.symbols[key];
          break;
        case "changed-both":
          if (decision === "keep-incoming" && incomingExists) result[key] = this.incoming.symbols[key];
          else if (localExists) result[key] = localSymbols[key];
          break;
        case "changed-local-deleted-incoming":
          if (decision !== "delete" && localExists) result[key] = localSymbols[key];
          break;
        case "deleted-local-changed-incoming":
          if (decision === "keep" && incomingExists) result[key] = this.incoming.symbols[key];
          break;
        case "deleted-local":
        case "deleted-incoming":
          break;
      }
    });
    return result;
  }
  /** 引用边：from → 引用目标编号；含相对基线的新旧与来源侧标记 */
  effectiveEdges(resolutions) {
    const chosen = this.chosenSteps(resolutions);
    const alive = new Set(chosen.map((item) => item.key));
    const edges = [];
    chosen.forEach(({ key, origin, step }) => {
      const side = origin === "local" ? this.localSide : this.incomingSide;
      const tokens = sideRefTokens(step, side);
      const baseStep = this.baseSide.steps.get(key);
      const baseTokens = baseStep ? new Set(sideRefTokens(baseStep, this.baseSide)) : /* @__PURE__ */ new Set();
      tokens.forEach((to) => {
        if (!alive.has(to)) {
          if (this.isKnownKey(to)) return;
        }
        const localStep = this.localSide.steps.get(key);
        const incomingStep = this.incomingSide.steps.get(key);
        edges.push({
          from: key,
          to,
          isNew: !baseTokens.has(to),
          inLocal: !!localStep && sideRefTokens(localStep, this.localSide).includes(to),
          inIncoming: !!incomingStep && sideRefTokens(incomingStep, this.incomingSide).includes(to)
        });
      });
    });
    return edges;
  }
  isKnownKey(token) {
    return this.localSide.steps.has(token) || this.incomingSide.steps.has(token) || this.baseSide.steps.has(token);
  }
  /** 当前裁决下仍需人工处理的条目 */
  listPending(resolutions) {
    const pending = [];
    this.stepRows.forEach(({ key, status, local, incoming }) => {
      if (status === "changed-both" && !resolutions.get(`step:${key}`)) {
        pending.push({
          id: `step:${key}`,
          kind: "step",
          stepKey: key,
          localSummary: local?.statement ?? "",
          incomingSummary: incoming?.statement ?? ""
        });
      }
      if ((status === "changed-local-deleted-incoming" || status === "deleted-local-changed-incoming") && !resolutions.get(`moddelete-step:${key}`) && !this.danglingKeepFor(key, resolutions)) {
        const changed = status === "changed-local-deleted-incoming" ? local : incoming;
        pending.push({
          id: `moddelete-step:${key}`,
          kind: "step-moddelete",
          stepKey: key,
          localSummary: status === "changed-local-deleted-incoming" ? changed.statement : "\uFF08\u672C\u5730\u5DF2\u5220\u9664\u8BE5\u6B65\u9AA4\uFF09",
          incomingSummary: status === "deleted-local-changed-incoming" ? changed.statement : "\uFF08\u5BFC\u5165\u4FA7\u5DF2\u5220\u9664\u8BE5\u6B65\u9AA4\uFF09"
        });
      }
    });
    if (this.goalStatus === "changed-both" && !resolutions.get("goal")) {
      pending.push({ id: "goal", kind: "goal", localSummary: this.localGoal, incomingSummary: this.incoming.goal });
    }
    this.symbolStatus.forEach((status, key) => {
      if (status === "changed-both" && !resolutions.get(`symbol:${key}`)) {
        pending.push({
          id: `symbol:${key}`,
          kind: "symbol",
          symbol: key,
          localSummary: this.localSymbols[key] ?? "",
          incomingSummary: this.incoming.symbols[key] ?? ""
        });
      }
      if ((status === "changed-local-deleted-incoming" || status === "deleted-local-changed-incoming") && !resolutions.get(`moddelete-symbol:${key}`)) {
        pending.push({
          id: `moddelete-symbol:${key}`,
          kind: "symbol-moddelete",
          symbol: key,
          localSummary: status === "changed-local-deleted-incoming" ? this.localSymbols[key] : "\uFF08\u672C\u5730\u5DF2\u5220\u9664\uFF09",
          incomingSummary: status === "deleted-local-changed-incoming" ? this.incoming.symbols[key] : "\uFF08\u5BFC\u5165\u4FA7\u5DF2\u5220\u9664\uFF09"
        });
      }
    });
    const alive = this.survivingKeys(resolutions);
    this.chosenSteps(resolutions).forEach(({ key, origin, step }) => {
      const side = origin === "local" ? this.localSide : this.incomingSide;
      const baseStep = this.baseSide.steps.get(key);
      const baseTokens = baseStep ? new Set(sideRefTokens(baseStep, this.baseSide)) : /* @__PURE__ */ new Set();
      sideRefTokens(step, side).forEach((to) => {
        if (alive.has(to) || !this.isKnownKey(to) || baseTokens.has(to)) return;
        const id = `dangling:${key}:${to}`;
        if (resolutions.has(id)) return;
        const targetStatus = this.stepStatus.get(to);
        pending.push({
          id,
          kind: "dangling",
          stepKey: to,
          referrerKeys: [key],
          targetKey: to,
          localSummary: `\u6B65\u9AA4 ${key} \u4ECD\u9700\u5F15\u7528 ${to}\uFF08${targetStatus === "deleted-local" ? "\u672C\u5730\u5DF2\u5220\u9664" : "\u5BFC\u5165\u4FA7\u5DF2\u5220\u9664"}\uFF09`,
          incomingSummary: "\u4FDD\u7559\u8BE5\u6B65\u9AA4\u5E76\u6062\u590D\u4F9D\u636E\uFF0C\u6216\u4ECE\u6B64\u6B65\u5220\u53BB\u8FD9\u6761\u5F15\u7528"
        });
      });
    });
    const cycleEdges = this.cyclicNewEdges(resolutions);
    if (cycleEdges.size && !resolutions.get("cycle")) {
      const nodes = /* @__PURE__ */ new Set();
      cycleEdges.forEach((edge) => {
        const [from, to] = edge.split("\u2192");
        nodes.add(from);
        nodes.add(to);
      });
      pending.push({
        id: "cycle",
        kind: "cycle",
        referrerKeys: [...nodes],
        localSummary: "\u4E24\u4FA7\u65B0\u589E\u7684\u5F15\u7528\u5F62\u6210\u95ED\u73AF",
        incomingSummary: `\u6D89\u53CA\u6B65\u9AA4\uFF1A${[...nodes].join("\u3001")}`
      });
    }
    return pending;
  }
  danglingKeepFor(target, resolutions) {
    let found = false;
    resolutions.forEach((value, id) => {
      if (id.startsWith("dangling:") && id.endsWith(`:${target}`) && value === "keep") found = true;
    });
    return found;
  }
  cyclicNewEdges(resolutions) {
    const edges = this.effectiveEdges(resolutions).filter((edge) => edge.isNew && this.survivingKeys(resolutions).has(edge.to));
    return cyclicEdges(edges.map((edge) => [edge.from, edge.to]));
  }
  /**
   * 生成合并后的完整文档。
   * 仍有未裁决条目时抛错——调用方据此保证“中途失败不写入任何内容”。
   */
  buildMerged(local, resolutions, createId, nowIso) {
    const unresolved = this.listPending(resolutions);
    if (unresolved.length) {
      throw new Error(`\u8FD8\u6709 ${unresolved.length} \u9879\u5F85\u5904\u7406\uFF0C\u65E0\u6CD5\u786E\u8BA4\u5408\u5E76`);
    }
    const chosen = this.chosenSteps(resolutions);
    const alive = new Set(chosen.map((item) => item.key));
    const droppedEdges = /* @__PURE__ */ new Set();
    const cycleDecision = resolutions.get("cycle");
    if (cycleDecision) {
      const allEdges = this.effectiveEdges(resolutions).filter((edge) => edge.isNew);
      let candidates = allEdges.filter(
        (edge) => cycleDecision === "break-local" ? edge.inLocal && !edge.inIncoming : edge.inIncoming && !edge.inLocal
      );
      let cyclic = cyclicEdges(
        allEdges.filter((edge) => alive.has(edge.to)).map((edge) => [edge.from, edge.to])
      );
      candidates.forEach((edge) => {
        if (cyclic.has(`${edge.from}\u2192${edge.to}`)) droppedEdges.add(`${edge.from}\u2192${edge.to}`);
      });
      const stillCyclic = () => cyclicEdges(
        allEdges.filter((edge) => alive.has(edge.to) && !droppedEdges.has(`${edge.from}\u2192${edge.to}`)).map((edge) => [edge.from, edge.to])
      );
      cyclic = stillCyclic();
      if (cyclic.size) {
        allEdges.filter(
          (edge) => cycleDecision === "break-local" ? edge.inLocal : edge.inIncoming
        ).forEach((edge) => {
          if (cyclic.has(`${edge.from}\u2192${edge.to}`)) droppedEdges.add(`${edge.from}\u2192${edge.to}`);
          cyclic = stillCyclic();
        });
      }
    }
    const keyToMergedId = /* @__PURE__ */ new Map();
    const usedIds = /* @__PURE__ */ new Set();
    chosen.forEach(({ key, step }) => {
      let id = step.id;
      if (usedIds.has(id)) id = createId("step");
      usedIds.add(id);
      keyToMergedId.set(key, id);
    });
    const steps = chosen.map(({ key, origin, step }) => {
      const side = origin === "local" ? this.localSide : this.incomingSide;
      const references = [];
      sideRefTokens(step, side).forEach((token, index) => {
        if (droppedEdges.has(`${key}\u2192${token}`)) return;
        if (resolutions.get(`dangling:${key}:${token}`) === "delete") return;
        if (keyToMergedId.has(token)) references.push(keyToMergedId.get(token));
        else if (!this.isKnownKey(token)) references.push(step.references[index] ?? token);
      });
      return { ...structuredClone(step), id: keyToMergedId.get(key), references: [...new Set(references)] };
    });
    const versionMap = /* @__PURE__ */ new Map();
    [...local.versions, ...this.baseVersions].forEach((version) => {
      if (!versionMap.has(version.id)) versionMap.set(version.id, structuredClone(version));
    });
    const versions = [...versionMap.values()].sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
    const maxKeySeq = Math.max(0, ...[...keyToMergedId.keys()].map((key) => Number(key.slice(1)) || 0));
    return {
      ...structuredClone(local),
      goal: this.chosenGoal(resolutions),
      symbols: this.chosenSymbols(resolutions),
      steps,
      versions,
      stepSeq: Math.max(local.stepSeq ?? 0, this.incoming.stepSeq ?? 0, maxKeySeq),
      updatedAt: nowIso
    };
  }
};
function cyclicEdges(edges) {
  const graph = /* @__PURE__ */ new Map();
  edges.forEach(([from, to]) => {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from).push(to);
    if (!graph.has(to)) graph.set(to, []);
  });
  let index = 0;
  const indices = /* @__PURE__ */ new Map();
  const low = /* @__PURE__ */ new Map();
  const stack = [];
  const onStack = /* @__PURE__ */ new Set();
  const component = /* @__PURE__ */ new Map();
  let componentCount = 0;
  const strongConnect = (node) => {
    indices.set(node, index);
    low.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);
    (graph.get(node) ?? []).forEach((next) => {
      if (!indices.has(next)) {
        strongConnect(next);
        low.set(node, Math.min(low.get(node), low.get(next)));
      } else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node), indices.get(next)));
      }
    });
    if (low.get(node) === indices.get(node)) {
      let member;
      do {
        member = stack.pop();
        onStack.delete(member);
        component.set(member, componentCount);
      } while (member !== node);
      componentCount += 1;
    }
  };
  graph.forEach((_, node) => {
    if (!indices.has(node)) strongConnect(node);
  });
  const componentSize = /* @__PURE__ */ new Map();
  component.forEach((c) => componentSize.set(c, (componentSize.get(c) ?? 0) + 1));
  const result = /* @__PURE__ */ new Set();
  edges.forEach(([from, to]) => {
    const c = component.get(from);
    if (component.get(to) === c && (from === to || (componentSize.get(c) ?? 0) > 1)) {
      result.add(`${from}\u2192${to}`);
    }
  });
  return result;
}
function createMergeSession(local, bundle2) {
  return new MergeSession(local, normalizeBundle(bundle2));
}
function buildBundle(document, baseline, nowIso) {
  return {
    format: "sologsb-proof-bundle",
    version: 1,
    exportedAt: nowIso,
    docId: document.id,
    title: document.title,
    baselineId: baseline.id,
    steps: structuredClone(document.steps),
    goal: document.goal,
    symbols: structuredClone(document.symbols),
    stepSeq: document.stepSeq,
    versions: structuredClone(document.versions)
  };
}

// src/store.ts
var STORAGE_KEY = "sologsb-1014-proof-workspace-v1";
var uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
var clone = (value) => structuredClone(value);
function migrateDocument(document) {
  let seq = document.stepSeq ?? 0;
  const used = /* @__PURE__ */ new Set();
  document.steps.forEach((step) => {
    if (!step.key || used.has(step.key)) {
      do {
        seq += 1;
        step.key = `S${seq}`;
      } while (used.has(step.key));
    }
    used.add(step.key);
  });
  document.stepSeq = Math.max(seq, ...[...used].map((key) => Number(key.slice(1)) || 0), 0);
  document.versions?.forEach((version) => {
    version.symbols ??= {};
  });
  document.versions ??= [];
  return document;
}
function nextStepKey(document) {
  return `S${(document.stepSeq ?? 0) + 1}`;
}
function parseBundle(raw) {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw;
  const hasSteps = Array.isArray(data.steps);
  if (data.format === "sologsb-proof-bundle") {
    if (!hasSteps) return null;
    return data;
  }
  if (hasSteps && (typeof data.goal === "string" || typeof data.title === "string")) {
    return {
      format: "sologsb-proof-bundle",
      version: 1,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      docId: typeof data.docId === "string" ? data.docId : uid("doc"),
      title: typeof data.title === "string" ? data.title : "\u5BFC\u5165\u7684\u65E7\u7A3F",
      baselineId: null,
      steps: data.steps,
      goal: typeof data.goal === "string" ? data.goal : "",
      symbols: data.symbols && typeof data.symbols === "object" ? data.symbols : {},
      stepSeq: typeof data.stepSeq === "number" ? data.stepSeq : 0,
      versions: Array.isArray(data.versions) ? data.versions : []
    };
  }
  return null;
}
function sampleSteps() {
  return [
    { id: "s1", key: "S1", type: "premise", statement: "$a,b$ \u662F\u5B9E\u6570", rule: "\u524D\u63D0", references: [], note: "\u91C7\u7528\u5B9E\u6570\u57DF\u4E2D\u7684\u4EA4\u6362\u5F8B\u4E0E\u5206\u914D\u5F8B\u3002", counterexample: "", alternative: "" },
    { id: "s2", key: "S2", type: "derivation", statement: "$(a+b)^2=(a+b)(a+b)$", rule: "\u5B9A\u4E49\u5C55\u5F00", references: ["s1"], note: "\u628A\u5E73\u65B9\u5199\u6210\u4E24\u4E2A\u76F8\u540C\u56E0\u5F0F\u4E4B\u79EF\u3002", counterexample: "", alternative: "" },
    { id: "s3", key: "S3", type: "derivation", statement: "$(a+b)(a+b)=a^2+ab+ba+b^2$", rule: "\u5206\u914D\u5F8B", references: ["s2"], note: "", counterexample: "", alternative: "\u4E5F\u53EF\u5148\u5C55\u5F00\u540E\u534A\u90E8\u5206\u3002" },
    { id: "s4", key: "S4", type: "derivation", statement: "$a^2+ab+ba+b^2=a^2+2ab+b^2$", rule: "\u540C\u7C7B\u9879\u5408\u5E76", references: ["s3"], note: "\u7531\u5B9E\u6570\u7684\u4EA4\u6362\u5F8B\uFF0C$ab=ba$\u3002", counterexample: "", alternative: "" },
    { id: "s5", key: "S5", type: "goal", statement: "$(a+b)^2=a^2+2ab+b^2$", rule: "\u7ED3\u8BBA", references: ["s4"], note: "\u76EE\u6807\u5DF2\u7531\u6B65\u9AA4 1 \u81F3 4 \u9010\u9879\u63A8\u51FA\u3002", counterexample: "", alternative: "" }
  ];
}
function issueSteps() {
  return [
    { id: "i1", key: "S1", type: "premise", statement: "$n$ \u662F\u6B63\u6574\u6570", rule: "\u524D\u63D0", references: [], note: "", counterexample: "", alternative: "" },
    { id: "i2", key: "S2", type: "derivation", statement: "$P(1)$ \u6210\u7ACB", rule: "\u524D\u63D0", references: ["i1"], note: "\u5F52\u7EB3\u57FA\u4F8B\u3002", counterexample: "", alternative: "" },
    { id: "i3", key: "S3", type: "derivation", statement: "\u82E5 $P(k)$ \u6210\u7ACB\uFF0C\u5219 $P(k+1)$ \u4E5F\u6210\u7ACB", rule: "\u6570\u5B66\u5F52\u7EB3", references: ["missing-step"], note: "\u8FD9\u91CC\u6545\u610F\u4FDD\u7559\u4E00\u4E2A\u5931\u6548\u5F15\u7528\uFF0C\u7528\u4E8E\u6F14\u793A\u68C0\u67E5\u3002", counterexample: "", alternative: "" },
    { id: "i4", key: "S4", type: "goal", statement: "$P(n)$ \u5BF9\u6240\u6709\u6B63\u6574\u6570 $n$ \u6210\u7ACB", rule: "\u7ED3\u8BBA", references: ["i3"], note: "\u5C1A\u672A\u8865\u9F50\u5F52\u7EB3\u5047\u8BBE\u3002", counterexample: "", alternative: "" }
  ];
}
function initialDocuments() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return [
    {
      id: "doc-algebra",
      title: "\u5B8C\u5168\u5E73\u65B9\u516C\u5F0F\u8BC1\u660E",
      author: "\u6570\u5B66\u7EC4",
      goal: "$(a+b)^2=a^2+2ab+b^2$",
      symbols: { a: "\u5B9E\u6570", b: "\u5B9E\u6570", P: "\u5173\u4E8E\u6B63\u6574\u6570\u7684\u547D\u9898", n: "\u6B63\u6574\u6570", k: "\u6B63\u6574\u6570" },
      steps: sampleSteps(),
      versions: [],
      stepSeq: 5,
      updatedAt: now
    },
    {
      id: "doc-induction",
      title: "\u6570\u5B66\u5F52\u7EB3\u6CD5\u5F85\u6838\u5BF9\u7A3F",
      author: "\u5B66\u751F\u5DE5\u4F5C\u533A",
      goal: "$P(n)$ \u5BF9\u6240\u6709\u6B63\u6574\u6570 $n$ \u6210\u7ACB",
      symbols: { P: "\u5173\u4E8E\u6B63\u6574\u6570\u7684\u547D\u9898", n: "\u6B63\u6574\u6570", k: "\u6B63\u6574\u6570" },
      steps: issueSteps(),
      versions: [],
      stepSeq: 4,
      updatedAt: now
    }
  ];
}
function loadDocuments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialDocuments();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return initialDocuments();
    return parsed.map((document) => migrateDocument(document));
  } catch {
    return initialDocuments();
  }
}
var ProofStore = class {
  documents = loadDocuments();
  activeId = this.documents[0]?.id ?? "";
  selectedStepId = this.documents[0]?.steps[0]?.id ?? "";
  compareVersionId = "";
  dragStepId = "";
  lastInput = null;
  undoStack = [];
  redoStack = [];
  toast = "";
  mergeSession = null;
  mergeResolutions = /* @__PURE__ */ new Map();
  mergeFileName = "";
  get current() {
    return this.documents.find((item) => item.id === this.activeId) ?? this.documents[0];
  }
  get selectedStep() {
    return this.current?.steps.find((step) => step.id === this.selectedStepId);
  }
  get checks() {
    if (!this.current) return [];
    return validate(this.current);
  }
  save() {
    this.current.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.documents));
  }
  update(mutator) {
    this.undoStack.push(clone(this.documents));
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack = [];
    mutator(this.current);
    this.save();
  }
  undo() {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(clone(this.documents));
    this.documents = previous;
    this.ensureSelection();
    this.save();
  }
  redo() {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(clone(this.documents));
    this.documents = next;
    this.ensureSelection();
    this.save();
  }
  selectDocument(id) {
    this.activeId = id;
    this.compareVersionId = "";
    this.selectedStepId = this.current?.steps[0]?.id ?? "";
  }
  selectStep(id) {
    this.selectedStepId = id;
  }
  ensureSelection() {
    if (!this.documents.some((item) => item.id === this.activeId)) this.activeId = this.documents[0]?.id ?? "";
    if (!this.current?.steps.some((step) => step.id === this.selectedStepId)) {
      this.selectedStepId = this.current?.steps[0]?.id ?? "";
    }
  }
  addDocument() {
    const id = uid("doc");
    const document = {
      id,
      title: "\u672A\u547D\u540D\u8BC1\u660E",
      author: "\u672C\u5730\u7528\u6237",
      goal: "$A=B$",
      symbols: { A: "\u5F85\u5B9A\u4E49\u5BF9\u8C61", B: "\u5F85\u5B9A\u4E49\u5BF9\u8C61" },
      steps: [{ id: uid("step"), key: "S1", type: "premise", statement: "\u5728\u8FD9\u91CC\u8F93\u5165\u524D\u63D0", rule: "\u524D\u63D0", references: [], note: "", counterexample: "", alternative: "" }],
      versions: [],
      stepSeq: 1,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.undoStack.push(clone(this.documents));
    this.documents.unshift(document);
    this.activeId = id;
    this.selectedStepId = document.steps[0].id;
    this.save();
  }
  removeDocument(id) {
    if (this.documents.length <= 1) {
      this.notify("\u81F3\u5C11\u4FDD\u7559\u4E00\u4E2A\u8BC1\u660E\u6587\u6863");
      return;
    }
    this.undoStack.push(clone(this.documents));
    this.documents = this.documents.filter((item) => item.id !== id);
    this.ensureSelection();
    this.save();
  }
  addStep(type = "derivation") {
    const key = nextStepKey(this.current);
    const step = {
      id: uid("step"),
      key,
      type,
      statement: type === "goal" ? "$A=B$" : "\u8F93\u5165\u65B0\u7684\u63A8\u5BFC\u5F0F",
      rule: type === "goal" ? "\u7ED3\u8BBA" : "\u7B49\u5F0F\u53D8\u5F62",
      references: this.selectedStepId ? [this.selectedStepId] : [],
      note: "",
      counterexample: "",
      alternative: ""
    };
    this.update((document) => {
      document.stepSeq += 1;
      const selectedIndex = document.steps.findIndex((item) => item.id === this.selectedStepId);
      document.steps.splice(type === "goal" ? document.steps.length : selectedIndex + 1, 0, step);
    });
    this.selectedStepId = step.id;
  }
  removeStep(id) {
    this.update((document) => {
      document.steps = document.steps.filter((step) => step.id !== id);
      document.steps.forEach((step) => {
        step.references = step.references.filter((reference) => reference !== id);
      });
    });
    this.ensureSelection();
  }
  moveStep(sourceId, targetId) {
    if (sourceId === targetId) return;
    this.update((document) => {
      const from = document.steps.findIndex((step) => step.id === sourceId);
      const to = document.steps.findIndex((step) => step.id === targetId);
      if (from < 0 || to < 0) return;
      const [moved] = document.steps.splice(from, 1);
      document.steps.splice(to, 0, moved);
    });
  }
  updateStep(patch) {
    const id = this.selectedStepId;
    this.update((document) => {
      const step = document.steps.find((item) => item.id === id);
      if (step) Object.assign(step, patch);
    });
  }
  createVersion() {
    let version;
    this.update((document) => {
      version = {
        id: uid("version"),
        name: `\u7248\u672C ${document.versions.length + 1}`,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        steps: clone(document.steps),
        goal: document.goal,
        symbols: clone(document.symbols)
      };
      document.versions.unshift(version);
      this.compareVersionId = version.id;
    });
    this.notify("\u5DF2\u4FDD\u5B58\u5F53\u524D\u8BC1\u660E\u5FEB\u7167");
    return version;
  }
  /** 导出离线合并包：先留下当时的版本快照（基线），再打包 */
  exportBundle() {
    const baseline = {
      id: uid("version"),
      name: `\u5BFC\u51FA\u57FA\u7EBF ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      steps: clone(this.current.steps),
      goal: this.current.goal,
      symbols: clone(this.current.symbols)
    };
    this.update((document) => {
      if (!document.versions.some((version) => version.id === baseline.id)) {
        document.versions.unshift(baseline);
      }
    });
    this.notify("\u5DF2\u56FA\u5316\u5BFC\u51FA\u57FA\u7EBF\u5E76\u751F\u6210\u4EA4\u6362\u5305");
    return buildBundle(this.current, baseline, (/* @__PURE__ */ new Date()).toISOString());
  }
  /** 读取交换包并生成合并预览；旧稿没有快照时按共同内容建立基线 */
  importBundle(raw, fileName) {
    const bundle2 = parseBundle(raw);
    if (!bundle2) {
      this.notify("\u5BFC\u5165\u5931\u8D25\uFF1A\u4E0D\u662F\u6709\u6548\u7684\u8BC1\u660E\u4EA4\u6362\u5305");
      return false;
    }
    this.mergeSession = createMergeSession(this.current, bundle2);
    this.mergeResolutions = /* @__PURE__ */ new Map();
    this.mergeFileName = fileName;
    this.notify(this.mergeSession.legacy ? "\u65E7\u7A3F\u65E0\u5FEB\u7167\uFF1A\u5DF2\u628A\u5171\u540C\u5185\u5BB9\u4F5C\u4E3A\u57FA\u7EBF" : "\u5DF2\u6309\u5BFC\u51FA\u57FA\u7EBF\u751F\u6210\u5408\u5E76\u9884\u89C8");
    return true;
  }
  get mergePending() {
    return this.mergeSession?.listPending(this.mergeResolutions) ?? [];
  }
  setMergeResolution(id, resolution) {
    this.mergeResolutions.set(id, resolution);
    if (id.startsWith("moddelete-step:")) {
      const key = id.slice("moddelete-step:".length);
      if (resolution === "keep") {
        this.mergePending.forEach((pending) => {
          if (pending.kind === "dangling" && pending.targetKey === key) {
            this.mergeResolutions.set(pending.id, "keep");
          }
        });
      } else {
        this.mergePending.forEach((pending) => {
          if (pending.kind === "dangling" && pending.targetKey === key) {
            this.mergeResolutions.set(pending.id, "delete");
          }
        });
      }
    }
  }
  /** 确认合并：先在内存中构造完整结果并校验，再一次写入；失败不改任何数据 */
  confirmMerge() {
    if (!this.mergeSession) return false;
    let merged;
    try {
      merged = this.mergeSession.buildMerged(this.current, this.mergeResolutions, uid, (/* @__PURE__ */ new Date()).toISOString());
      const introduced = mergeIntroducedErrors(this.current, this.mergeSession.incoming.steps, merged);
      if (introduced.length) throw new Error(`\u5408\u5E76\u5C06\u5F15\u5165\u65AD\u94FE\u6216\u5FAA\u73AF\u5F15\u7528\uFF1A${introduced.join("\uFF1B")}`);
    } catch (error) {
      this.notify(error instanceof Error ? error.message : "\u4ECD\u6709\u5F85\u5904\u7406\u9879\uFF0C\u672A\u5199\u5165\u4EFB\u4F55\u5185\u5BB9");
      return false;
    }
    this.undoStack.push(clone(this.documents));
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack = [];
    const index = this.documents.findIndex((item) => item.id === this.current.id);
    this.documents[index] = merged;
    this.selectedStepId = merged.steps[0]?.id ?? "";
    this.save();
    this.cancelMerge();
    this.notify("\u5408\u5E76\u5B8C\u6210\uFF1A\u6B65\u9AA4\u3001\u5F15\u7528\u4E0E\u5386\u53F2\u5FEB\u7167\u5DF2\u4E00\u5E76\u5199\u5165");
    return true;
  }
  cancelMerge() {
    this.mergeSession = null;
    this.mergeResolutions = /* @__PURE__ */ new Map();
    this.mergeFileName = "";
  }
  notify(message) {
    this.toast = message;
    window.setTimeout(() => {
      if (this.toast === message) {
        this.toast = "";
        (0, import_mithril.redraw)();
      }
    }, 2200);
  }
};
function stripLatexCommands(text) {
  return text.replace(/\\[A-Za-z]+/g, " ").replace(/[{}_^]/g, " ");
}
function validate(document) {
  const checks = [];
  const ids = new Set(document.steps.map((step) => step.id));
  const symbolKeys = new Set(Object.keys(document.symbols));
  const ignored = /* @__PURE__ */ new Set(["a", "A", "b", "B", "n", "k", "P", "Q", "R", "x", "y", "to", "text", "frac", "sqrt"]);
  document.steps.forEach((step, index) => {
    const tokens = stripLatexCommands(step.statement).match(/\b[A-Za-z][A-Za-z0-9']*\b/g) ?? [];
    const unknown = [...new Set(tokens.filter((token) => !symbolKeys.has(token) && !ignored.has(token)))];
    if (unknown.length) {
      checks.push({ id: `symbol-${step.id}`, severity: "warning", title: "\u53D1\u73B0\u672A\u5B9A\u4E49\u7B26\u53F7", detail: `\u6B65\u9AA4 ${index + 1} \u4F7F\u7528\u4E86\uFF1A${unknown.join("\u3001")}`, stepId: step.id });
    }
    step.references.forEach((reference) => {
      if (!ids.has(reference)) {
        checks.push({ id: `missing-${step.id}-${reference}`, severity: "error", title: "\u5F15\u7528\u6B65\u9AA4\u4E0D\u5B58\u5728", detail: `\u6B65\u9AA4 ${index + 1} \u5F15\u7528\u4E86\u5DF2\u5220\u9664\u7684\u6B65\u9AA4 ${reference}`, stepId: step.id });
      }
    });
  });
  const graph = new Map(document.steps.map((step) => [step.id, step.references.filter((id) => ids.has(id))]));
  const visiting = /* @__PURE__ */ new Set();
  const visited = /* @__PURE__ */ new Set();
  const cycleStep = /* @__PURE__ */ new Set();
  const visit = (id, path) => {
    if (visiting.has(id)) {
      path.slice(path.indexOf(id)).forEach((item) => cycleStep.add(item));
      return true;
    }
    if (visited.has(id)) return false;
    visiting.add(id);
    const hasCycle = (graph.get(id) ?? []).some((next) => visit(next, [...path, id]));
    visiting.delete(id);
    visited.add(id);
    return hasCycle;
  };
  [...graph.keys()].forEach((id) => visit(id, []));
  if (cycleStep.size) {
    checks.push({ id: "cycle", severity: "error", title: "\u68C0\u6D4B\u5230\u5FAA\u73AF\u5F15\u7528", detail: "\u5F15\u7528\u94FE\u5F62\u6210\u95ED\u73AF\uFF0C\u8BF7\u8C03\u6574\u6B65\u9AA4\u5173\u7CFB\u3002", stepId: [...cycleStep][0] });
  }
  const goalStep = document.steps.find((step) => step.type === "goal" && step.rule === "\u7ED3\u8BBA");
  if (!goalStep) {
    checks.push({ id: "goal-missing", severity: "error", title: "\u76EE\u6807\u672A\u88AB\u8BC1\u660E", detail: "\u8BF7\u6DFB\u52A0\u201C\u7ED3\u8BBA\u201D\u7C7B\u578B\u7684\u6700\u7EC8\u6B65\u9AA4\u3002" });
  } else if (goalStep.references.length === 0) {
    checks.push({ id: "goal-unlinked", severity: "warning", title: "\u7ED3\u8BBA\u5C1A\u65E0\u63A8\u5BFC\u652F\u6491", detail: "\u6700\u7EC8\u6B65\u9AA4\u6CA1\u6709\u5F15\u7528\u4EFB\u4F55\u524D\u7F6E\u6B65\u9AA4\u3002", stepId: goalStep.id });
  }
  if (!checks.some((check) => check.severity === "error")) {
    checks.push({ id: "proof-ok", severity: "info", title: "\u7ED3\u6784\u68C0\u67E5\u901A\u8FC7", detail: "\u672A\u53D1\u73B0\u7F3A\u5931\u5F15\u7528\u3001\u5FAA\u73AF\u5F15\u7528\u6216\u672A\u8BC1\u660E\u76EE\u6807\u3002" });
  }
  return checks;
}
function mergeIntroducedErrors(local, incomingSteps, after) {
  const problems = [];
  const edgeKey = (fromKey, rawRef, steps) => {
    const target = steps.find((step) => step.id === rawRef);
    return `${fromKey}\u2192${target?.key ?? rawRef}`;
  };
  const danglingBefore = /* @__PURE__ */ new Set();
  const collectDangling = (steps) => {
    const ids = new Set(steps.map((step) => step.id));
    steps.forEach((step) => {
      step.references.forEach((rawRef) => {
        if (!ids.has(rawRef)) danglingBefore.add(edgeKey(step.key, rawRef, steps));
      });
    });
  };
  collectDangling(local.steps);
  collectDangling(incomingSteps);
  const afterIds = new Set(after.steps.map((step) => step.id));
  after.steps.forEach((step, index) => {
    step.references.forEach((rawRef) => {
      if (!afterIds.has(rawRef) && !danglingBefore.has(edgeKey(step.key, rawRef, after.steps))) {
        problems.push(`\u6B65\u9AA4 ${index + 1} \u51FA\u73B0\u65AD\u6389\u7684\u4F9D\u636E`);
      }
    });
  });
  if (detectCycle(after) && !detectCycle(local) && !detectCycle({ ...local, steps: incomingSteps })) {
    problems.push("\u5F15\u7528\u94FE\u5F62\u6210\u95ED\u73AF");
  }
  return problems;
}
function detectCycle(document) {
  const ids = new Set(document.steps.map((step) => step.id));
  const graph = new Map(document.steps.map((step) => [step.id, step.references.filter((id) => ids.has(id))]));
  const visiting = /* @__PURE__ */ new Set();
  const visited = /* @__PURE__ */ new Set();
  let cycle = false;
  const visit = (id) => {
    if (visiting.has(id)) {
      cycle = true;
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    graph.get(id)?.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };
  graph.forEach((_, id) => visit(id));
  return cycle;
}

// scripts/store-test.ts
var MemoryStorage = class {
  map = /* @__PURE__ */ new Map();
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, value);
  }
  removeItem(key) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
};
globalThis.localStorage = new MemoryStorage();
globalThis.window = { setTimeout };
process.on("uncaughtException", (error) => {
  if (error instanceof TypeError && /schedule/.test(error.message)) return;
  throw error;
});
var passed = 0;
var test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  \u2713 ${name}`);
};
localStorage.setItem("sologsb-1014-proof-workspace-v1", JSON.stringify([{
  id: "old-doc",
  title: "\u65E7\u7A3F",
  author: "a",
  goal: "G",
  symbols: { x: "X" },
  steps: [
    { id: "q1", type: "premise", statement: "s1", rule: "\u524D\u63D0", references: [], note: "", counterexample: "", alternative: "" },
    { id: "q2", type: "derivation", statement: "s2", rule: "\u7B49\u5F0F\u53D8\u5F62", references: ["q1"], note: "", counterexample: "", alternative: "" }
  ],
  versions: [{ id: "v-old", name: "n", createdAt: "2026-01-01T00:00:00.000Z", steps: [], goal: "G" }],
  updatedAt: "2026-01-01T00:00:00.000Z"
}]));
var storeA = new ProofStore();
test("\u65E7\u7A3F\u52A0\u8F7D\u65F6\u8865\u53D1\u7A33\u5B9A\u7F16\u53F7\u3001stepSeq \u4E0E\u5FEB\u7167 symbols", () => {
  const doc = storeA.documents[0];
  import_node_assert.default.equal(doc.steps[0].key, "S1");
  import_node_assert.default.equal(doc.steps[1].key, "S2");
  import_node_assert.default.equal(doc.stepSeq, 2);
  import_node_assert.default.deepEqual(doc.versions[0].symbols, {});
});
var bundle = storeA.exportBundle();
test("\u5BFC\u51FA\u5305\u5305\u542B\u57FA\u7EBF id \u4E0E\u57FA\u7EBF\u5FEB\u7167", () => {
  import_node_assert.default.equal(typeof bundle.baselineId, "string");
  import_node_assert.default.ok(bundle.versions.some((v) => v.id === bundle.baselineId));
  import_node_assert.default.equal(bundle.steps.length, 2);
});
localStorage.clear();
var baseDoc = structuredClone(storeA.documents[0]);
baseDoc.versions = [];
var storeB = new ProofStore();
storeB.documents = [baseDoc];
storeB.activeId = baseDoc.id;
storeB.selectStep(baseDoc.steps[0].id);
storeB.updateStep({ statement: "B \u673A\u4FEE\u6539\u540E\u7684\u547D\u9898" });
var incomingEdited = structuredClone(bundle);
incomingEdited.steps.find((s) => s.key === "S2").statement = "A \u673A\u7EE7\u7EED\u4FEE\u6539\u7684\u547D\u9898";
test("\u5BFC\u5165\u540E\u751F\u6210\u5408\u5E76\u9884\u89C8\uFF0C\u5355\u4FA7\u6539\u52A8\u65E0\u5F85\u5904\u7406", () => {
  import_node_assert.default.equal(storeB.importBundle(incomingEdited, "branch.json"), true);
  import_node_assert.default.equal(storeB.mergePending.length, 0);
});
storeB.cancelMerge();
var conflictBundle = structuredClone(incomingEdited);
conflictBundle.steps.find((s) => s.key === "S1").statement = "A \u5BF9 S1 \u7684\u53E6\u4E00\u79CD\u6539\u6CD5";
storeB.importBundle(conflictBundle, "conflict.json");
var versionsBefore = storeB.current.versions.length;
var stepsSnapshotBefore = structuredClone(storeB.current.steps);
test("\u4E24\u4FA7\u540C\u6539\u65F6\u786E\u8BA4\u5931\u8D25\uFF0C\u6587\u6863\u4E0E\u5FEB\u7167\u6570\u91CF\u4E0D\u53D8", () => {
  import_node_assert.default.equal(storeB.mergePending.length, 1);
  import_node_assert.default.equal(storeB.confirmMerge(), false);
  import_node_assert.default.equal(storeB.current.versions.length, versionsBefore);
  import_node_assert.default.deepEqual(storeB.current.steps, stepsSnapshotBefore);
  import_node_assert.default.ok(storeB.mergeSession);
});
test("\u88C1\u51B3\u540E\u91CD\u8BD5\u786E\u8BA4\u6210\u529F\uFF1B\u518D\u70B9\u786E\u8BA4\u4E0D\u4F1A\u91CD\u590D\u5199\u5165\u5FEB\u7167", () => {
  storeB.setMergeResolution("step:S1", "keep-local");
  import_node_assert.default.equal(storeB.mergePending.length, 0);
  import_node_assert.default.equal(storeB.confirmMerge(), true);
  const versionsAfterFirst = storeB.current.versions.length;
  const mergedSteps = storeB.current.steps;
  import_node_assert.default.ok(mergedSteps.some((s) => s.statement === "B \u673A\u4FEE\u6539\u540E\u7684\u547D\u9898"));
  import_node_assert.default.ok(mergedSteps.some((s) => s.statement === "A \u673A\u7EE7\u7EED\u4FEE\u6539\u7684\u547D\u9898"));
  import_node_assert.default.ok(storeB.current.versions.some((v) => v.id === bundle.baselineId));
  import_node_assert.default.equal(storeB.confirmMerge(), false);
  import_node_assert.default.equal(storeB.current.versions.length, versionsAfterFirst);
});
test("\u5408\u5E76\u7ED3\u679C\u65E0\u7F3A\u5931\u5F15\u7528\u3001\u65E0\u5FAA\u73AF\u5F15\u7528\uFF08\u65E7\u7A3F\u539F\u6709\u7684\u5185\u5BB9\u6027\u9519\u8BEF\u4E0D\u8BA1\uFF09", () => {
  const blocking = storeB.checks.filter(
    (c) => c.severity === "error" && (c.title === "\u5F15\u7528\u6B65\u9AA4\u4E0D\u5B58\u5728" || c.title === "\u68C0\u6D4B\u5230\u5FAA\u73AF\u5F15\u7528")
  );
  import_node_assert.default.deepEqual(blocking, []);
  const s2 = storeB.current.steps.find((s) => s.key === "S2");
  const s1 = storeB.current.steps.find((s) => s.key === "S1");
  import_node_assert.default.deepEqual(s2.references, [s1.id]);
});
localStorage.clear();
var storeC = new ProofStore();
var legacyLocal = structuredClone(baseDoc);
storeC.documents = [legacyLocal];
storeC.activeId = legacyLocal.id;
var legacyBundle = {
  format: "sologsb-proof-bundle",
  version: 1,
  exportedAt: "now",
  docId: legacyLocal.id,
  title: legacyLocal.title,
  baselineId: null,
  steps: structuredClone(legacyLocal.steps),
  goal: legacyLocal.goal,
  symbols: {},
  stepSeq: 2,
  versions: []
};
test("\u65E0\u5FEB\u7167\u65E7\u5305\u53EF\u5BFC\u5165\uFF0C\u6807\u8BB0 legacy \u4E14\u96F6\u51B2\u7A81", () => {
  import_node_assert.default.equal(storeC.importBundle(legacyBundle, "legacy.json"), true);
  import_node_assert.default.equal(storeC.mergeSession.legacy, true);
  import_node_assert.default.equal(storeC.mergePending.length, 0);
  import_node_assert.default.equal(storeC.confirmMerge(), true);
  import_node_assert.default.equal(storeC.current.steps.length, 2);
});
var reloaded = new ProofStore();
test("\u5408\u5E76\u7A3F\u6301\u4E45\u5316\u540E\u91CD\u65B0\u52A0\u8F7D\uFF0C\u7F16\u53F7\u4E0E\u5F15\u7528\u5B8C\u597D", () => {
  const doc = reloaded.current;
  import_node_assert.default.equal(doc.steps.length, 2);
  import_node_assert.default.deepEqual(doc.steps.map((s) => s.key), ["S1", "S2"]);
});
console.log(`
Store \u6D41\u7A0B ${passed} \u7EC4\u6D4B\u8BD5\u901A\u8FC7`);
