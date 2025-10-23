export class Writer {
  buffer: string[] = [];
  indent: number = 1;

  constructor(indent?: number) {
    if (indent) {
      this.indent = indent;
    }
  }

  addLine(str: string) {
    if (this.indent === -1) {
      console.log(str);
    }
    // console.log(this.indent);
    this.buffer.push(`${Array(this.indent).join("  ")}${str}\r\n`);
  }
  add(str: string) {
    this.buffer.push(str);
  }
  write(): string {
    return this.buffer.join("");
  }
  getCurrentIndex() {
    return this.buffer.length - 1;
  }
  addLineAtIndex(str: string, index: number) {
    const inserted = `${Array(this.indent).join("  ")}${str}\r\n`;
    this.buffer.splice(index, 0, inserted);
  }
}
