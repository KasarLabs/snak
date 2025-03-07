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
CopyPOSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
POSTGRES_ROOT_DB=your_database
POSTGRES_HOST=your_host
POSTGRES_PORT=your_port
```

## Using the Database in Your Plugins
To use PostgreSQL in your plugins, initialize the database with:
```js
// Initialize a database for your plugin
const db = await agent.createDatabase('name_of_your_db');

// Example usage with direct query
const query = await db.query('SELECT * FROM your_table');

// Example usage CRUD(insert) agent function
const query_insert = await database.insert({
      table_name: 'sak_table_chat',
      fields: new Map<string, string>([
        ['instruction', `'${params.instruction}'`],
      ]),
    });
```

