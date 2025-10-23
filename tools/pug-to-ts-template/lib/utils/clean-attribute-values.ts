import { isNonNull } from "remeda";
type TCleanAttributesValuesParams = {
  isStyle: boolean;
  isInterpolate: boolean;
};
export function cleanAttributeValues(
  str: string,
  params: TCleanAttributesValuesParams
): string {
  // let match: RegExpMatchArray;
  let result: string = "";
  if (params.isStyle) {
    // console.log(str);
    const strRegex = /([a-zA-Z0-9:;\s\-\.]+)/;
    const objRegex = /(\{.*?\})/;
    const objMatch = str.match(objRegex);
    // console.log(objMatch);
    const strMatch = str.match(strRegex);
    if (isNonNull(objMatch)) {
      try {
        const obj = JSON.parse(objMatch[1]);
        // console.log(obj);
        Object.entries(obj).forEach(([key, val], index) => {
          result += `${key}: ${val};`;
        });
      } catch (err) {
        result = "";
      }
    } else {
      const match = strMatch;
      result = isNonNull(match) ? match[1] : "";
    }
  } else if (!params.isInterpolate) {
    const regex = /([a-zA-Z-_]+)/;
    const match = str.match(regex);
    result = isNonNull(match) ? match[1] : "";
  } else {
    const regex = /([a-z\.A-Z-_]+)/;
    const match = str.match(regex);
    result = isNonNull(match) ? match[1] : "";
  }
  // const regex = isStyle ? /([a-zA-Z0-9:;\s\-\.]+)/ : /([a-zA-Z-_]+)/;
  // // const match = str.match(regex);
  // if (!isNull(match)) {
  //   return match[1];
  // } else {
  //   return "";
  // }
  return result;
}
