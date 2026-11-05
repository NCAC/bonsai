/** Data of the todo list template: the output of `select` (strate 1c, lot 4). */
export type TTodo = { readonly id: string; readonly title: string; readonly done: boolean };
export type TTodoListData = { readonly todos: readonly TTodo[] };
