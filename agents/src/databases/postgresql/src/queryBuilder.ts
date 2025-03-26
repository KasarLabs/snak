import { DEFAULT } from './types/database.js';

/**
 * @class QueryBuilder
 * @description A fluent SQL query builder that helps construct SQL queries by chaining methods
 * @property {string[]} query - Internal array that stores query parts
 */
export class QueryBuilder {
  private query: string[] = [];

  /**
   * @function append
   * @description Appends text to the query
   * @param {string} text - Text to append to the query
   * @returns {QueryBuilder} Returns this instance for method chaining
   */
  append(text: string): QueryBuilder {
    this.query.push(text);
    return this;
  }

  /**
   * @function appendIf
   * @description Conditionally appends text to the query
   * @param {boolean} condition - If true, the text will be appended
   * @param {string} text - Text to append if condition is true
   * @returns {QueryBuilder} Returns this instance for method chaining
   */
  appendIf(condition: boolean, text: string): QueryBuilder {
    if (condition === true) {
      this.query.push(text);
    }
    return this;
  }

  /**
   * @function appendJoinedList
   * @description Appends a list of items joined by a separator
   * @param {Array<string|number|DEFAULT>} [list] - List of items to append
   * @param {string} [separator=', '] - Separator to use between items
   * @returns {QueryBuilder} Returns this instance for method chaining
   */
  appendJoinedList(
    list?: Array<string | number | DEFAULT>,
    separator: string = ', '
  ): QueryBuilder {
    if (list?.length) {
      this.query.push(list.join(separator));
    }
    return this;
  }

  /**
   * @function appendJoinedListType
   * @description Appends a list of items with type handling (strings are properly escaped)
   * @param {Array<string|number|DEFAULT|boolean|null|Array<string>>} [list] - List of items to append
   * @param {string} [separator=', '] - Separator to use between items
   * @returns {QueryBuilder} Returns this instance for method chaining
   */
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

  /**
   * @function build
   * @description Builds and returns the final SQL query string with semicolon
   * @returns {string} The complete SQL query
   */
  build(): string {
    const query_build = this.query.join(' ');
    return query_build + ';';
  }
}
