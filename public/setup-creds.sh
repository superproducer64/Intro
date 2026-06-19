#!/bin/bash
set -e

echo "==> Creating build setup folder..."
mkdir -p ~/intro-eas-setup
cd ~/intro-eas-setup

echo "==> Writing app config..."
cat > app.json << 'JSON'
{
  "expo": {
    "name": "Intro",
    "slug": "intro",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.bgpstudios.intro",
      "buildNumber": "2"
    },
    "extra": {
      "eas": {
        "projectId": "a20334ee-337d-429e-a09a-4a756a24ee17"
      }
    }
  }
}
JSON

cat > eas.json << 'JSON'
{
  "cli": { "version": ">= 16.0.0" },
  "build": {
    "production": {
      "node": "20.19.0",
      "ios": { "buildConfiguration": "Release" }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "nu2u@sbcglobal.net",
        "ascAppId": "6761438541",
        "appleTeamId": "4JZRW3MPP2"
      }
    }
  }
}
JSON

echo "==> Installing EAS CLI..."
npm install -g eas-cli --silent

echo ""
echo "==> Logging in to Expo..."
eas login

echo ""
echo "==> Setting up iOS credentials (follow the prompts)..."
echo "    - Choose 'Add new credentials'"
echo "    - When asked about certificates, choose 'Generate new'"
echo "    - Enter your Apple ID: nu2u@sbcglobal.net"
echo "    - Enter your Apple ID password when prompted"
echo ""
eas credentials --platform ios

echo ""
echo "✓ Done! Come back to Replit — the build can now run from there."
