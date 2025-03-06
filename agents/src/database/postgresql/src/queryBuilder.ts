import { DEFAULT } from "./types/database";

export class QueryBuilder {
  private query: string[] = [];

  append(text: string): QueryBuilder {
    this.query.push(text);
    return this;
  }

  appendIf(condition: boolean, text: string): QueryBuilder {
    if (condition === true) {
      this.query.push(text);
    }
    return this;
  }

  appendJoinedList(list?: Array<string | number | DEFAULT>, separator : string = ', '): QueryBuilder {
    if (list?.length) {
      this.query.push(list.join(separator));
    }
    return this;
  }

  build(): string {
    const query_build = this.query.join(' ');
    return query_build + ';';
  }
}
