# RDS DBA Tools

A lightweight web-based toolbox for DBAs to manage AWS RDS instances. Features include AWS SSO config generation and RDS error log viewing across MySQL, Aurora MySQL, PostgreSQL, Aurora PostgreSQL, and DocumentDB.

---

## Prerequisites

- Python 3.11 or higher
- AWS CLI installed and available in your PATH
- Git

---

## Getting Started

### 1. Clone the repository

```bash
git clone git@github.com:ParTechZen/Zen.git
cd Zen/rds-dba-tools
```

### 2. Create a Python virtual environment

**Mac / Linux:**
```bash
python3 -m venv .venv
```

**Windows:**
```bash
python -m venv .venv
```

### 3. Install dependencies

**Mac / Linux:**
```bash
.venv/bin/pip install -r server/requirements.txt
```

**Windows:**
```bash
.venv\Scripts\pip install -r server\requirements.txt
```

### 4. Start the server

**Mac / Linux:**
```bash
sh run.sh
```

**Windows:**
```bash
python run.py
```

### 5. Open the app

Once the server is running, open your browser and go to:

**http://localhost:3002**

---

## Features

### SSO Setup Tab
- Enter your SSO Start URL and region to discover all accessible AWS accounts and roles
- Generates or updates `~/.aws/config` with named profiles ready for use with the AWS CLI

### RDS Logs Tab
- Select a profile and region to list all RDS instances
- Toggle which instances to query
- Set a date range and filter by log category (errors, deadlocks, slow queries, connections, replication, storage)
- Stream results in real time, search inline, and export to CSV
