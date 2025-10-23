// transforms ["classA", "classB", "classC"] into "classA classB classC"
export function transformClassArray(vals: string[]): string {
  let value = "";
  for (let i = 0; i < vals.length; i += 1) {
    if (i < vals.length - 1) {
      value += `${vals[i]} `;
    } else {
      value += vals[i];
    }
  }
  return value;
}
