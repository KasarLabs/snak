export class Query {
  constructor(public sql: string, public params: any[] = []) {}
}

export class Postgres {
  static query = jest.fn();
  static Query = jest.fn().mockImplementation((sql: string, params: any[] = []) => {
    return new Query(sql, params);
  });
} 