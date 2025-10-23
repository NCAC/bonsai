import { DataTypes, Model, TDataTypesFromStructure } from "bonsai";

const pageModelStructure = {
  theme: DataTypes.String(),
  isLogged: DataTypes.Boolean(),
  hasHeader: DataTypes.Boolean({ default: true }),
  testArray: DataTypes.Array({
    element: DataTypes.String({})
  })
};
export type TPageModelStructure = TDataTypesFromStructure<
  typeof pageModelStructure
>;
export class PageModel extends Model<PageModel, TPageModelStructure> {
  structure() {
    return pageModelStructure;
  }
}
