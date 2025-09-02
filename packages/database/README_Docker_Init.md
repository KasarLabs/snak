# Docker PostgreSQL Initialization Order

PostgreSQL Docker containers execute SQL files in **alphabetical order** by filename from the `/docker-entrypoint-initdb.d/` directory.

## Current File Structure

To ensure proper execution order, rename your files with numeric prefixes:

```bash
# Recommended file naming for proper execution order:
01-extensions.sql     # Database extensions (uuid-ossp, vector)
02-types.sql          # Custom composite types (memory, rag, model)  
03-agents.sql         # Agent tables and functions (with FK references)
04-messages.sql       # Message system with indexes (references agents)
05-memory.sql         # Memory system with indexes (independent)
06-models.sql         # Model configuration (independent)
07-indexes.sql        # Reference guide (optional)
```

## Docker Compose Setup

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: snak_db
      POSTGRES_USER: snak_user
      POSTGRES_PASSWORD: snak_password
    volumes:
      # Mount the initdb directory
      - ./packages/database/initdb:/docker-entrypoint-initdb.d/
      # Persistent data volume
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

## Execution Order Dependencies

The numeric prefixes ensure this dependency chain:

1. **01-extensions.sql** - Must run first (provides uuid-ossp, vector)
2. **02-types.sql** - Creates composite types used by tables
3. **03-agents.sql** - Creates agents table (referenced by messages)
4. **04-messages.sql** - Creates message table with FK to agents
5. **05-memory.sql** - Independent memory system
6. **06-models.sql** - Independent model configuration

## Renaming Commands

Run these commands to rename your files:

```bash
cd packages/database/initdb/

# Rename files with proper numeric prefixes
mv extensions.sql 01-extensions.sql
mv types.sql 02-types.sql  
mv agents.sql 03-agents.sql
mv messages.sql 04-messages.sql
mv memory.sql 05-memory.sql
mv models.sql 06-models.sql
mv indexes.sql 07-indexes.sql

# Keep existing files that are already numbered
# 01-init.sql (original - can be renamed to 99-original-backup.sql)
# memory-init.sql (original - can be renamed to 99-memory-backup.sql)
```

## Verification

After renaming, your directory should look like:

```
packages/database/initdb/
├── 01-extensions.sql    # Extensions first
├── 02-types.sql         # Types second  
├── 03-agents.sql        # Agents third
├── 04-messages.sql      # Messages fourth (depends on agents)
├── 05-memory.sql        # Memory fifth
├── 06-models.sql        # Models sixth
├── 07-indexes.sql       # Reference guide last
├── 99-original-init.sql # Backup of original
└── 99-memory-backup.sql # Backup of original
```

## Docker Initialization Process

1. When PostgreSQL container starts, it checks `/docker-entrypoint-initdb.d/`
2. Executes all `.sql` files in **alphabetical order**
3. If any file fails, initialization stops
4. Files only run on **first container startup** (when data directory is empty)

## Testing

To test the initialization:

```bash
# Remove existing container and volume
docker-compose down -v

# Start fresh (will run initialization scripts)
docker-compose up -d postgres

# Check logs for any errors
docker-compose logs postgres

# Connect and verify tables were created
docker-compose exec postgres psql -U snak_user -d snak_db -c "\dt"
```