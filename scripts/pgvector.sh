#!/bin/bash

check_pgvector_installed() {
  if [ -f "$(pg_config --pkglibdir)/vector.so" ]; then
    return 0
  else
    return 1
  fi
}

if check_pgvector_installed; then
  echo "pgvector is already installed. No action needed."
  exit 0
fi

echo "pgvector is not installed. Installation required."
apt-get update
apt-get install -y build-essential git postgresql-server-dev-$(pg_config --version | sed 's/[^0-9]*\([0-9]*\).*/\1/')

cd /tmp
git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git
cd pgvector
make
make install

cd ..
rm -rf pgvector

echo "pgvector installed successfully"
