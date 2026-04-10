#!/bin/bash

# Get absolute path of the directory containing the project
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Setting up AI File Organizer in $PROJECT_DIR"

# Ensure Python 3 is installed
if ! command -v python3 &> /dev/null
then
    echo "python3 could not be found. Please install Python 3."
    exit 1
fi

# Ensure Tesseract is installed
if ! command -v tesseract &> /dev/null
then
    echo "tesseract not found. Installing via homebrew..."
    brew install tesseract
fi

# Set up virtual environment
echo "Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install requirements
echo "Installing requirements..."
pip install --upgrade pip
pip install -r requirements.txt

# Make logs directory if it doesn't exist
mkdir -p "$PROJECT_DIR/logs"

# Configure the LaunchAgent
PLIST_NAME="com.fileorganizer.agent.plist"
SOURCE_PLIST="$PROJECT_DIR/launch_agent/$PLIST_NAME"
TARGET_PLIST="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo "Configuring macOS LaunchAgent..."
# Replace 'TARGET_DIR' in plist and save to ~/Library/LaunchAgents
PYTHON_BIN="$PROJECT_DIR/venv/bin/python3"
sed -e "s|TARGET_DIR|$PROJECT_DIR|g" -e "s|<string>python3</string>|<string>$PYTHON_BIN</string>|g" "$SOURCE_PLIST" > "$TARGET_PLIST"

# Make the python script executable
chmod +x "$PROJECT_DIR/main.py"

# Unload the old version if it exists
if launchctl list | grep -q "com.fileorganizer.agent"; then
    echo "Unloading existing LaunchAgent..."
    launchctl unload "$TARGET_PLIST"
fi

# Load the new LaunchAgent
echo "Loading LaunchAgent..."
launchctl load "$TARGET_PLIST"

echo ""
echo "Installation complete!"
echo "The file organizer is now running in the background."
echo "Logs can be found in $PROJECT_DIR/logs/"
echo ""
echo "To view live logs, run:"
echo "tail -f $PROJECT_DIR/logs/stdout.log"
echo ""
echo "If you want to manually trigger sorting of existing files, you can run:"
echo "$PROJECT_DIR/venv/bin/python3 $PROJECT_DIR/main.py --run-existing"
