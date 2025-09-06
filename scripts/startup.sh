#!/bin/bash

# startup.sh - Application startup script
# This script ensures the database is ready before starting the application

set -e

# Function to wait for database
wait_for_db() {
  echo "Waiting for database to be ready..."
  
  # Extract database connection details from DATABASE_URL
  if [ -n "$DATABASE_URL" ]; then
    # Parse DATABASE_URL (postgresql://user:pass@host:port/db)
    DB_HOST=$(echo $DATABASE_URL | cut -d@ -f2 | cut -d: -f1)
    DB_PORT=$(echo $DATABASE_URL | cut -d: -f4 | cut -d/ -f1)
    
    if [ -z "$DB_PORT" ]; then
      DB_PORT=5432
    fi
    
    echo "Checking database connection to $DB_HOST:$DB_PORT"
    
    # Wait for database to be ready
    until nc -z "$DB_HOST" "$DB_PORT"; do
      echo "Database is unavailable - sleeping"
      sleep 2
    done
    
    echo "Database is ready!"
  else
    echo "DATABASE_URL not set, skipping database check"
  fi
}

# Function to run database migrations/initialization
init_db() {
  echo "Initializing database..."
  # The database initialization is handled by the application itself
  # when it first connects via the initDatabase() function
  echo "Database initialization will be handled by the application"
}

# Main execution
main() {
  echo "Starting TMSU.CC URL Shortener..."
  
  # Wait for database if DATABASE_URL is set
  if [ -n "$DATABASE_URL" ]; then
    wait_for_db
    init_db
  fi
  
  # Start the application
  echo "Starting Node.js application..."
  exec "$@"
}

# Run main function with all arguments
main "$@"
