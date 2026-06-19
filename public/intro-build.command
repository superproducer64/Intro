#!/bin/bash
# Double-click this file to set up and open the Intro Xcode project

cd ~/Downloads

echo "========================================"
echo "  Intro iOS Build Setup"
echo "========================================"
echo ""

# Extract the project
if [ -f "intro-ios.tar.gz" ]; then
  echo "Extracting project files..."
  tar -xzf intro-ios.tar.gz
  echo "Done."
else
  echo "ERROR: intro-ios.tar.gz not found in Downloads."
  echo "Please download it from:"
  echo "https://intro-bgpstudioshou.replit.app/intro-ios.tar.gz"
  read -p "Press Enter to exit..."
  exit 1
fi

# Install CocoaPods if needed
if ! command -v pod &> /dev/null; then
  echo ""
  echo "Installing CocoaPods (may take a minute)..."
  sudo gem install cocoapods
fi

# Run pod install
echo ""
echo "Installing iOS dependencies..."
cd ~/Downloads/mobile/ios
pod install

# Open in Xcode
echo ""
echo "Opening Xcode..."
open ~/Downloads/mobile/ios/Intro.xcworkspace

echo ""
echo "========================================"
echo "  Xcode is opening!"
echo ""
echo "  Next steps in Xcode:"
echo "  1. Select 'Intro' in the left panel"
echo "  2. Signing & Capabilities → set Team to 'BGP Studios'"
echo "  3. Product menu → Archive"
echo "  4. Click 'Distribute App' → App Store Connect"
echo "========================================"
read -p "Press Enter to close this window..."
