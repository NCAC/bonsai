import { VDom, _, DataTypes, TTemplateFunction, VNode, VNodeChildren, VNodeData, VNodeOn } from "bonsai"
export default function pageViewTemplate(data, uiEventsBindings) {
  if (!VDom) {
    throw "VDom not found.";
  }
  const n0Child = [];
  var n1Child = [];
  var n2Child = [];
  n2Child.push(VDom.text("String"))
  var props2 = {}
  var n2 = VDom.h('title', props2, n2Child)
  n1Child.push(n2);
  var n3Child = [];
  n3Child.push(VDom.text("Boolean"))
  var props3 = {}
  var n3 = VDom.h('isLogged', props3, n3Child)
  n1Child.push(n3);
  var n4Child = [];
  n4Child.push(VDom.text("String"))
  var props4 = {}
  var n4 = VDom.h('userName', props4, n4Child)
  n1Child.push(n4);
  var props1 = {}
  var n1 = VDom.h('_data', props1, n1Child)
  n0Child.push(n1);
  var n5Child = [];
  if (data.isLogged) {
    var n6Child = [];
    n6Child.push(VDom.text("Bienvenue "))
    n6Child = n6Child.concat(VDom.text(data.userName))
    n6Child.push(VDom.text(" sur "))
    n6Child = n6Child.concat(VDom.text(data.title))
    var props6 = {}
    props6.attrs = {};
    props6.attrs.class = "Page-welcome"
    props6.attrs["data-logged"] = "true";
    props6.on = {}
    if (Object.keys(uiEventsBindings).includes(".Page-welcome")) {
      uiEventsBindings[".Page-welcome"].forEach((eventBinding) => {
        props6.on[eventBinding.event] = eventBinding.callback;
      });
    }
    if (Object.keys(uiEventsBindings).includes("[data-logged]")) {
      uiEventsBindings["[data-logged]"].forEach((eventBinding) => {
        props6.on[eventBinding.event] = eventBinding.callback;
      });
    }
    var n6 = VDom.h('h1', props6, n6Child)
    n5Child.push(n6);
  } else {
    var n7Child = [];
    n7Child.push(VDom.text("Bienvenue sur "))
    n7Child = n7Child.concat(VDom.text(data.title))
    var props7 = {}
    props7.attrs = {};
    props7.attrs.class = "Page-welcome"
    props7.attrs["data-logged"] = "false";
    props7.on = {}
    if (Object.keys(uiEventsBindings).includes(".Page-welcome")) {
      uiEventsBindings[".Page-welcome"].forEach((eventBinding) => {
        props7.on[eventBinding.event] = eventBinding.callback;
      });
    }
    if (Object.keys(uiEventsBindings).includes("[data-logged]")) {
      uiEventsBindings["[data-logged]"].forEach((eventBinding) => {
        props7.on[eventBinding.event] = eventBinding.callback;
      });
    }
    var n7 = VDom.h('h1', props7, n7Child)
    n5Child.push(n7);
    var n8Child = [];
    n8Child.push(VDom.text("S'identifier"))
    var props8 = {}
    props8.attrs = {};
    props8.attrs.class = "Page-login"
    props8.on = {}
    if (Object.keys(uiEventsBindings).includes(".Page-login")) {
      uiEventsBindings[".Page-login"].forEach((eventBinding) => {
        props8.on[eventBinding.event] = eventBinding.callback;
      });
    }
    var n8 = VDom.h('button', props8, n8Child)
    n5Child.push(n8);
  }
  var props5 = {}
  props5.key = 'page-view';
  props5.attrs = {};
  props5.attrs.class = "Page"
  props5.attrs.id = 'page-view';
  props5.on = {}
  if (Object.keys(uiEventsBindings).includes(".Page")) {
    uiEventsBindings[".Page"].forEach((eventBinding) => {
      props5.on[eventBinding.event] = eventBinding.callback;
    });
  }
  if (Object.keys(uiEventsBindings).includes("#page-view")) {
    uiEventsBindings["#page-view"].forEach((eventBinding) => {
      props5.on[eventBinding.event] = eventBinding.callback;
    });
  }
  var n5 = VDom.h('div', props5, n5Child)
  n0Child.push(n5);
  return n0Child;
}
