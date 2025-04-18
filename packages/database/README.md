# Database

This package contains the database logic of `Snak`. We use a containerized version of [`PostgreSQL`]
as our backend with [`pgvector`] installed.

> [!WARNING]
> We use two versions of the same `compose.yaml` file: one for [`testing`], and the other for 
> [`production`]. **Only the production container persists storage between restarts**. This is saved
> under `packages/database/data/`.

## Environment

The `snak` database requires the following to be set in your root `.env`:

```env
POSTGRES_USER=...
POSTGRES_HOST=...
POSTGRES_DB=...
POSTGRES_PASSWORD=...
```

The exact values of these are not important. Note that `snak` assumes that you have port `5454` free
as this is used by default to connect the PostgreSQL container. If you need to change this, for
example to use a local database, you can set the `POSTGRES_PORT` environment variable.

## Usage

The database exposes query functions to be used by other packages. To start using the db, add it to
your `package.json`.

```json
  "dependencies": {
    "@snak/database": "workspace:*"
  }
```

Here is an example of how you would use it:

```ts
import { scarb } from "@snak/database/queries";
import { Id } from "@snak/database/common";

async function getProject(projectName: string): Promise<scarb.Project<Id.Id>> {
    return await scarb.selectProject(projectName);
}
```

> [!IMPORTANT]
> You should **NOT** be writing raw SQL queries outside of the database package. Instead, external
> packages should only be able to interface with the database through a series of type-safe
> functions which wrap the raw SQL query and handle errors.

## Structure

The database package is split up into different _query modules_. Each module is responsible for 
handling queries for a set of related tables, as well as providing a way to create those tables.
These functions are defined in the `queries.ts` file inside each module. A module also includes a 
`__test__` folder which should contain tests for all the queries it provides, including failure 
cases and edge cases. A module's `queries.ts` is the **only** place where you should be writing raw
SQL queries.

```bash
src
├── database.ts
├── error.ts
└── queries
    ├── common.ts
    └── module
        ├── queries.ts
        └── __tests__
            └── queries.spec.ts
```

## Testing

You can test all the queries provided by the database by running the following command:

```bash
pnpm turbo run test --filter=@snak/database
```

Keep in mind that a _single_ database instance, although ephemeral, will be used throughout _all_
the tests. This essentially makes sure that all database queries are compatible with each other and
that we are not, for example, defining duplicate tables or invalid insertions.

## Extending the database

If you need to add some new functionality to the database, please follow the above recommended
structure. Also:

- Modules should contain a single `queries.ts` file.
- Table types should be clearly defined and exported so that external packages can use them.
- All queries should be tested -you might find it handy to write some extra queries to set up state
  during tests, even if they are not used by any outside package.
- Queries which are re-used inside a single module should be refactored into a SQL function.
- Code which is common across multiple `queries.ts` files should be hoisted to `common.ts`.

Here is an example of a dummy `queries.ts` file:

```ts
import { query, transaction, Query } from "../../database.js"
import { Id } from "../common.js";

export namespace dummy {
    // This function must be indemptotent. More on this later.
    export async function init() {
        const t = [
            new Query(`
                CREATE TABLE IF NOT EXISTS users(
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    surname TEXT NOT NULL,
                    UNIQUE (name, surname)
                );
            `),
            new Query(`
                CREATE OR REPLACE FUNCTION insert_user(
                    name text,
                    surname text
                ) RETURNS integer AS $$
                    INSERT INTO user (
                        name,
                        surname
                    ) VALUES (
                        $1,
                        $2
                    ) RETURNING (
                        id
                    );
                $$ LANGUAGE sql
            `)
        ];
        await transaction(t);
    }

    // We provide a type-safe interface for each table. We use the version 
    // without an id for insertions, and the version with an id for retrievals.
    // This avoids marking id as `?`, which would require users of this api to
    // know the implementation details of each function to know when id should
    // and should not treated as null.
    interface UserBase {
        name: string,
        surname: number
    }
    interface UserWithId extends UserBase{
        id: number
    }
    export type User<HasId extends Id = Id.NoId> = 
        hasId extends Id.Id ? UserWithId : UserBase;

    // The logic for `insert_user` is used multiple times, so we have refactored
    // it into an SQL function.
    export async function insertUser(user: User): Promise<number | undefined> {
        const q = new Query(
            `SELECT * FROM insert_user($1, $2)`,
            [user.id, user.surname]
        );
        return await query(q);
    }
    // Multiple related operations on the database should be transactional. More
    // on this later.
    export async function insertUsers(users: User[]): Promise<number[]> {
        const t = users.map((user) => new Query(
            `SELECT * FROM insert_user($1, $2)`,
            [user.id, user.surname]
        ));
        return (await transaction(t)) ?? [];
    }
    // Operations which are not reused are fine to be written in-place.
    export async function selectUserId(
        user: User
    ): Promise<number | undefined> {
        const q = new Query(
            `SELECT
                id,
            FROM
                users
            WHERE
                name = $1 AND surname = $2`,
            [user.name, user.surname]
        );
        return await query(q);
    }
    // Notice we are returning the version of `User` with an id.
    export async function selectUserbySurname(
        surname: string
    ): Promise<User<Id.Id>[]> {
        const q = new Query(
            `SELECT
                id,
                name,
                surname
            FROM
                users
            WHERE
                surname = $1`,
            [surname]
        );
        return (await query(q)) ?? [];
    }
    export async function selectUserbyName(
        name: string
    ): Promise<User<Id.Id>[]> {
        const q = new Query(
            `SELECT
                id,
                name,
                surname
            FROM
                users
            WHERE
                name = $1`,
            [name]
        );
        return (await query(q)) ?? [];
    }
}
```

## Considerations

The following is a list of _very important_ things to keep in mind as your are writing extensions to
the existing db code.

### Injections

> [!CAUTION]
> **Never** interpolate an SQL query string. **EVER**.

If you need to pass external data to an SQL query, use numbered parameters with the `$` syntax. You
can see examples of this above. For more information, check out the section of `node-postgres` on
[parametrized queries].

### Transactionality

> [!CAUTION]
> It should not be possible for the database to enter a state of partial read or partial write. 
> **You are responsible for ensuring this!**

When making multiple related operations on the database, you should always default to using a
[transaction]. You should _not_, for example, be aggregating the result of multiple queries inside a 
`for` loop. The following is _seriously_ wrong.

```ts
const users: dummy.User = [];
for (const name of ['Jeff', 'Joff', 'John', 'Joe']) {
    users.push(...(await dummy.selectUserByName(name)));
}
```

The reason this is wrong is that the state of the database could be changing _as we are performing
this query_. So Jeff or John could be removed or inserted midway during the loop and we could be
retrieving users which no longer exist -yikes! Generally speaking, you should be interfacing with
the state of the database as part of a single transaction. Any more complex logic such as looping 
should be moved inside of a [plpgsql] function. You can see [examples] of this in the existing query
modules.

> [!WARNING]
> This is _doubly true_ when inserting related information into the database. You **MUST NOT** be
> inserting related data using multiple queries/transactions. It would be enough for the server to
> shut down unexpectedly for only a portion of these writes to take effect, putting the database 
> into an invalid state! Use transactions!

### Indempotence

> _"Idempotence is the property of certain operations in mathematics and computer science whereby 
> they can be applied multiple times without changing the result beyond the initial application."_

Because of the way in which the server is set up, some functions such as `init` might and _will_ be
called multiple times. It is crucial that these functions do not cause errors when this is the case.
In you `init` logic, you should make sure to create tables only if they do not exist already. The
same goes for functions or extensions. Make sure to add indempotence tests as part of your module's
`query.spec.ts`.

### Normal Forms

[Database normalization] is a technique applied to limit data duplication and maintain data
integrity across a database. Beyond the academic definition of database normalization, please just
keep in mind that you should avoid duplicating data across tables and columns. Please check out
existing tables before adding information to the database which might already be present in another
module's `query.ts`. There are reasons _not_ to normalize a certain part of a database, most notably
for optimizing indexing speed, but that should not come across as a primary concern. Normalize your
data, then optimize for performance if needed.

### Up and Down migrations

> [!IMPORTANT]
> `snak` _does not_ currently support database migrations, so this section is not terribly relevant
> right now.

When updating an exiting module's table, please keep in mind that existing data will have to
_migrated_ to this new schema. Here are a few key points to keep in mind.

1. Additive changes are ok (adding a table, adding a column...).
2. Deletions are tricky (deleting a table, deleting a column...).
3. Modifications are a pain (renaming a table, changing a type...).
4. Changes should be easy to apply (UP migration).
5. Changes should be easy to revert (DOWN migration).
6. Back up the database before pushing changes to prod.

## Debugging

When implementing the above, you will most probably run into some misbehavior which needs to be
debugged. 

### Logging

While `console.log` can get the job done, you might also be needing a way to inspect the raw queries
inside the database. Logging is enabled by default and will run at the `debug` level during tests
(`info` during release). Logs are stored in the `log` folder, along with the date and time at which
they were saved. You can `cat` out the logs to view their contents.

```bash
cat log/* | grep -e ERROR -e INFO;
```

You might also want to log your own information. You can use [`RAISE INFO`] for this purpose.

```sql
RAISE INFO 'Hello World';
```

> [!TIP]
> Keep in mind that `RAISE` can only be used inside of `plpgsql` code.

### Connecting to the db

Alternatively, you might need to open an active `psql` session with the running database to run some
queries against it. First, make sure the database is running. This step is not required if you are
already running `snak`.

```bash
docker-compose -f packages/database/compose.test.yaml up # Test database (ephemeral)
docker-compose -f packages/database/compose.yaml up # Production database (packages/database/data)
```

You can then open a client connection in another terminal:

```bash
docker exec -i --tty -u postgres container-hash psql
```

Where you should replace `container-hash` with the hash of the running database container.

[`PostgreSQL`]: https://www.postgresql.org/docs/17/index.html
[`pgvector`]: https://github.com/pgvector/pgvector
[`testing`]: https://github.com/KasarLabs/snak/blob/main/packages/database/compose.test.yaml
[`production`]: https://github.com/KasarLabs/snak/blob/main/packages/database/compose.yaml
[parametrized queries]: https://node-postgres.com/features/queries#parameterized-query
[transaction]: https://www.postgresql.org/docs/current/tutorial-transactions.html
[plpgsql]: https://www.postgresql.org/docs/current/plpgsql.html
[examples]: https://github.com/KasarLabs/snak/blob/d91d99aa60a6d8c51b6eb48287b7e0793b1b57c3/packages/database/src/queries/scarb/queries.ts#L96C6-L127C25
[Database normalization]: https://en.wikipedia.org/wiki/Database_normalization
[`RAISE INFO`]: https://www.postgresql.org/docs/current/plpgsql-errors-and-messages.html
