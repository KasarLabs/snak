export class Query {
  constructor(public sql: string, public params: unknown[] = []) {}
}

export class Postgres {
  static query = jest.fn();
  static Query = jest.fn().mockImplementation((sql: string, params: unknown[] = []) => {
    return new Query(sql, params);
  });
} 