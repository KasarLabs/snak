export class Query {
  constructor(
    public sql: string,
    public params: unknown[] = []
  ) {}
}

export const Postgres = {
  connect: jest.fn().mockResolvedValue(undefined),
};

export const memory = {
  init: jest.fn().mockResolvedValue(undefined),
};

export const iterations = {
  init: jest.fn().mockResolvedValue(undefined),
};
