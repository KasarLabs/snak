import { DEFAULT } from './types/database.js';

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

  appendJoinedList(
    list?: Array<string | number | DEFAULT>,
    separator: string = ', '
  ): QueryBuilder {
    if (list?.length) {
      this.query.push(list.join(separator));
    }
    return this;
  }

  appendJoinedListType(
    list?: Array<string | number | DEFAULT | boolean | null | Array<string>>,
    separator: string = ', '
  ): QueryBuilder {
    const query: string[] = [];
    list?.map((item) => {
      if (item === 'DEFAULT') {
        query.push('DEFAULT');
      } else if (typeof item === 'string') {
        query.push(`'${item.replace(/'/g, "''")}'`);
      } else if (typeof item === 'number') {
        query.push(item.toString());
      } else if (typeof item === 'boolean') {
        query.push(item.toString());
      } else if (item === null) {
        query.push('NULL');
      } else if (Array.isArray(item)) {
        query.push(`'${item.join(',')}'`);
      }
    });
    this.query.push(query.join(separator));
    return this;
  }

  build(): string {
    const query_build = this.query.join(' ');
    return query_build + ';';
  }
}
