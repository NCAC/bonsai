import { isEmpty, isNonNull } from "remeda";
import { cleanAttributeValues } from "./utils/clean-attribute-values.js";
import { transformClassArray } from "./utils/transform-class-array.js";

import {
  TPugAttribute,
  TPugTagNode,
  TPugTextNode,
  TPugBlockNode,
  TPugAnyNode,
  TPugInterpolatedTagNode,
  TPugCaseNode,
  TPugWhenNode,
  TPugMixinNode,
  TPugWhileNode,
  TPugEachNode,
  TPugCodeNode,
  TPugCommentNode,
  TPugBlockCommentNode,
  TPugConditionalNode,
  TPugIncludeNode
} from "./types/pug.types.js";

import { Writer } from "./writer.class.js";

export abstract class BaseCompiler {
  ast: TPugBlockNode;
  indent: number = 1;
  nodeId: number = 0;
  parentTagId: number = 0;
  buffer: string[] = [];
  body: Writer;

  constructor(ast: TPugBlockNode) {
    this.ast = ast;
    this.body = new Writer();
  }

  uid() {
    this.nodeId++;
    return this.nodeId;
  }

  compile() {
    return [this.body.write()].join("\n\n");
  }

  compileAttrs(
    attributes: TPugAttribute[],
    attributeBlocks: TPugTagNode["attributeBlocks"]
  ): {
    key?: string;
    attrs: {
      key?: string;
      class: string[];
      id: "string";
    };
  } {
    const propsObj: {
      key?: string;
      attrs?: {
        id?: { val: string; interpolate: boolean };
        class?: { val: string[]; interpolate: boolean };
      } & { [key: string]: { val: string | string[]; interpolate: boolean } };
    } = {};

    // console.log(attributeBlocks);

    let attrsObj = {};
    if (!attributeBlocks.length) {
      attrsObj = attributes.reduce((finalObj: typeof propsObj, attr) => {
        //#region test
        // if (!isNull(attr.val.match(/^(['"]{1})(.*)(['"]{1})$/))) {
        // }
        const isInterpolate = !isNonNull(
          attr.val.match(/^(['"]{1})(.*)(['"]{1})$/)
        );
        // if (attr.name === "style") {
        //   console.group(attr.val);
        //   console.log(attr.val.match(/^(['"]{1})(.*)(['"]{1})$/));
        //   console.groupEnd();
        // }
        // console.log(attr);
        // console.log(finalObj);
        // console.groupEnd();
        //#endregion test
        const val: string = cleanAttributeValues(attr.val, {
          isStyle: "style" === attr.name,
          isInterpolate
        });

        if (finalObj[attr.name]) {
          finalObj[attr.name]["val"].concat(val);
        } else {
          finalObj[attr.name] = {
            val: [val],
            interpolate: isInterpolate
          };
        }

        // finalObj[attr.name] = finalObj[attr.name]
        //   ? finalObj[attr.name].concat(val)
        //   : [val];
        return finalObj;
      }, {});
    } else {
      attrsObj = attributeBlocks.reduce(
        function (finalObj, currObj) {
          for (var propName in currObj) {
            (finalObj as any)[propName] = finalObj[propName]
              ? finalObj[propName].concat(currObj[propName])
              : [currObj[propName]];
          }
          return finalObj;
        },
        attributes.reduce(function (finalObj, attr) {
          var val = attr.val;
          finalObj[attr.name] = finalObj[attr.name]
            ? finalObj[attr.name].concat(val)
            : [val];
          return finalObj;
        }, {})
      );
    }

    for (var propName in attrsObj) {
      if ("class" !== propName) {
        // console.log(attrsObj[propName]);
        attrsObj[propName]["val"] = (
          attrsObj[propName]["val"] as string[]
        ).pop();
        if ("id" === propName) {
          propsObj.key = attrsObj[propName].val;
        }
      }
    }

    propsObj.attrs = attrsObj;
    return propsObj as any; /*{
      key?: string;
      attrs: {
        key?: string;
        class: string[];
        id: string;
      };
    };*/
  }

  visit(node: TPugAnyNode) {
    if (!this[`visit${node.type}`]) {
      throw new Error(`Node not handled: ${node.type}`);
    }
    this[`visit${node.type}`](node);
  }

  visitTag(node: TPugTagNode | TPugInterpolatedTagNode) {
    const props = this.compileAttrs(node.attrs, node.attributeBlocks);
    // console.log(props);
    const isFirstNode = this.nodeId === 0;

    const id = this.uid();

    this.body.addLine("");
    this.body.addLine(`const n${id}Child: VNodeChildren = [];`);

    const s = this.parentTagId;
    this.parentTagId = id;
    if (isNonNull(node.block)) {
      this.visitBlock(node.block);
    }
    this.body.addLine(`const props${id}: VNodeData = {}`);
    const selectors: {
      selector: string;
      value: string;
      total: string | null;
    }[] = [];

    for (const propKey in props) {
      const prop = props[propKey];

      if ("key" === propKey) {
        this.body.addLine(`props${id}.key = "${prop}";`);
      } else if ("attrs" === propKey) {
        if (!isEmpty(prop)) {
          Object.keys(prop).forEach((attr, index) => {
            const value = prop[attr]["val"];
            if (0 === index) {
              this.body.addLine(`props${id}.attrs = {};`);
            }
            switch (attr) {
              case "class":
                if (!prop[attr].interpolate) {
                  this.body.addLine(
                    `props${id}.attrs.class = "${transformClassArray(value)}";`
                  );
                  (value as string[]).forEach((className) => {
                    selectors.push({
                      selector: ".",
                      value: className,
                      total: `.${className}`
                    });
                  });
                } else {
                  this.body.addLine(`props${id}.attrs.class = ${value};`);
                  selectors.push({
                    selector: ".",
                    value,
                    total: null
                  });
                }

                break;
              case "id":
                if (!prop[attr].interpolate) {
                  this.body.addLine(`props${id}.attrs.id = "${value}";`);
                  selectors.push({ selector: "#", value, total: `#${value}` });
                } else {
                  this.body.addLine(`props${id}.attrs.id = ${value};`);
                  selectors.push({ selector: "#", value, total: null });
                }
                break;
              default:
                if (!prop[attr].interpolate) {
                  this.body.addLine(
                    `props${id}.attrs["${attr}"] = "${value}";`
                  );
                  if (/^data-[a-zA-Z]+$/.test(attr)) {
                    selectors.push({
                      selector: attr,
                      value,
                      total: `[${attr}]`
                    });
                  }
                } else {
                  this.body.addLine(`props${id}.attrs["${attr}"] = ${value};`);
                  if (/^data-[a-zA-Z]+$/.test(attr)) {
                    selectors.push({ selector: attr, value, total: null });
                  }
                }
            }
          });
        }
      }
    }
    if (selectors.length) {
      this.body.addLine(`props${id}.on = {}`);
      this.body.addLine(`props${id}.hook = {}`);
      // this.body.addLine(`const selectors${id} = ${JSON.stringify(selectors)}`);
      selectors.forEach((selector, i) => {
        if (isNonNull(selector.total)) {
          this.body.addLine(
            `const uiEventBinding_${id}_${i} = "${selector.total}";`
          );
        } else {
          this.body.addLine(
            `const uiEventBinding_${id}_${i} = ${selector.value};`
          );
        }
        this.body.addLine(
          `if (Object.keys(uiEventsBindings).includes(uiEventBinding_${id}_${i})) {`
        );
        this.body.indent++;
        // this.body.addLine(`const test__${id} = uiEventsBindings["${selector}"]`);
        this.body.addLine(
          `uiEventsBindings["${selector.total}"].forEach((eventBinding) => {`
        );
        this.body.indent++;
        this.body.addLine(
          `(props${id}.on as VNodeOn)[eventBinding.event] = eventBinding.callback;`
        );
        this.body.indent--;
        this.body.addLine("});");
        this.body.indent--;
        this.body.addLine("}");

        this.body.addLine("if (!_.isNull(regions)) {");
        this.body.indent++;
        this.body.addLine(
          "Object.values(regions as any).forEach((regionElement: any) => {"
        );
        this.body.indent++;
        this.body.addLine(
          `if (regionElement.selector === "${selector.selector}" && regionElement.value === "${selector.value}" ) {`
        );
        this.body.indent++;
        this.body.addLine(
          `(props${id}.hook as Hooks).insert = regionElement.insertCallback;`
        );
        this.body.addLine(
          `(props${id}.hook as Hooks).remove = regionElement.removeCallback;`
        );
        this.body.indent--;
        this.body.addLine("}");
        this.body.indent--;
        this.body.addLine("});");
        this.body.indent--;
        this.body.addLine("}");
      });
    }

    if (isFirstNode) {
      this.body.addLine(
        `return VDom.h(${
          (node as TPugTagNode).name
            ? `'${(node as TPugTagNode).name}'`
            : `${(node as TPugInterpolatedTagNode).expr}`
        }, props${id}, n${id}Child);`
      );
    } else {
      this.body.addLine(
        `var n${id} = VDom.h(${
          (node as TPugTagNode).name
            ? `'${(node as TPugTagNode).name}'`
            : `${(node as TPugInterpolatedTagNode).expr}`
        }, props${id}, n${id}Child);`
      );
      this.parentTagId = s;
      this.body.addLine(`n${s}Child.push(n${id});`);
    }
  }

  // visitBlock, when a node has block with many nodes to visit
  visitBlock(node: TPugBlockNode) {
    node.nodes.forEach((childNode) => {
      this.visit(childNode);
    });
  }

  visitInterpolatedTag(node: TPugInterpolatedTagNode) {
    this.visitTag(node);
  }

  visitText(node: TPugTextNode) {
    const val = node.val;
    const s = JSON.stringify(val);
    if (val[0] === "<") {
      this.body.addLine(
        `n${this.parentTagId}Child.push(VDom.makeHtmlNode(${s}))`
      );
    } else {
      this.body.addLine(`n${this.parentTagId}Child.push(VDom.text(${s}))`);
    }
  }

  visitCode(node: TPugCodeNode) {
    if (node.buffer) {
      this.body.addLine(
        `n${this.parentTagId}Child.push(${
          node.mustEscape
            ? `VDom.text(${node.val})`
            : `VDom.makeHtmlNode(${node.val})`
        })`
      );
    } else {
      this.body.addLine(node.val + "");
    }

    if (node.block) {
      this.body.addLine("{");
      this.body.indent++;
      this.visitBlock(node.block);
      this.body.indent--;
      this.body.addLine("}");
    }
  }

  visitConditional(node: TPugConditionalNode) {
    this.body.addLine(`if (${node.test}) {`);
    this.body.indent++;
    this.visitBlock(node.consequent);
    this.body.indent--;
    if (node.alternate) {
      this.body.addLine(`} else {`);
      this.body.indent++;
      this.visit(node.alternate);
      this.body.indent--;
    }
    this.body.addLine(`}`);
  }

  visitComment(node: TPugCommentNode) {}
  visitBlockComment(node: TPugBlockCommentNode) {}

  visitWhile(node: TPugWhileNode) {
    this.body.addLine(`while (${node.test}){`);
    this.body.indent++;
    this.visitBlock(node.block);
    this.body.indent--;
    this.body.addLine(`}`);
  }

  visitEach(node: TPugEachNode) {
    const tempVar = `v${this.uid()}`;
    const key = node.key || `k${this.uid()}`;

    this.body.addLine(`var ${tempVar} = ${node.obj}`);
    this.body.addLine(`Object.keys(${tempVar}).forEach((${key}) => {`);
    this.body.indent++;
    this.body.addLine(`const ${node.val} = ${tempVar}[${key}]`);
    this.visitBlock(node.block);
    this.body.indent--;
    this.body.addLine(`})`);
  }

  visitExtends(node) {
    throw new Error(
      "Extends nodes need to be resolved with pug-load and pug-linker"
    );
  }
}
