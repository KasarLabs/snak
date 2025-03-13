# PostgreSQL Adapter

A guide to setting up and using the PostgreSQL adapter with your application.

## Installing PostgreSQL

### For macOS

1. Install PostgreSQL using Homebrew:

```bash
brew install postgresql
```

2. Start PostgreSQL:

```bash
brew services start postgresql
```

### For Linux (Ubuntu/Debian)

1. Install PostgreSQL:

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

2. Start PostgreSQL:

```bash
bashCopysudo systemctl start postgresql
```

### Verifying Your Installation

To verify that PostgreSQL is running correctly:

```bash
# On macOS
psql postgres

# On Linux
sudo -u postgres psql
```

## Configuring Environment Variables

Update your .env file with the following information:

```bash
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
POSTGRES_ROOT_DB=your_database
POSTGRES_HOST=your_host
POSTGRES_PORT=your_port #Default Postgres Port : 5432
```

There's one field that isn't always present by default: the root DB. We recommend setting this to "postgres" which is a database created by default in PostgreSQL installations. The purpose of the root DB is to have a database where you can execute instructions that might not be executable in any other database.

## Using the Database in Your Plugins

To use PostgreSQL in your plugins, initialize the database with:

```js
// Initialize the database in your plugin

try {
  const database = await agent.createDatabase('KasarLabs');
  if (!database) {
      throw new Error('Database not found');
  }


  const query_create_table = await database.createTable({
        table_name: 'Kasar',
        fields: new Map<string, string>([
          ['id', `SERIAL PRIMARY KEY`],
          ['twitter', 'VARCHAR(100) UNIQUE'],
          ['projects', 'VARCHAR(255)[]']
        ]),
      });

  const query_insert = await database.insert({
      table_name : 'Kasar',
      fields: new Map<string, string | string[]>([
          ['id', `DEFAULT`],
          ['twitter', '@kasarLabs'],
          ['projects', ['Madara','Quaza','Snak']]
        ]),
  })
// Example usage with direct query
const query = await database.query('SELECT * FROM your_table');
} catch (error) {
  console.error(error);
}
```
