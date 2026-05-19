"""
Add the api/ directory to sys.path so tests can import from
routers/, services/, and config without installing the package.

Run from within the Docker container:
    docker compose exec api pip install pytest
    docker compose exec api pytest tests/ -v
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
