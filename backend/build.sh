#!/bin/bash
# Build script for Render deployment
# This script runs before the app starts

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Initializing database..."
python init_db.py

echo "Build complete!"
