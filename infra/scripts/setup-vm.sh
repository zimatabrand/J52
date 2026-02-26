#!/bin/bash
# J52 Worker VM Bootstrap Script
# Run on a fresh Ubuntu 22.04 LTS GCE instance
# Usage: curl -sSL <raw-url> | sudo bash

set -euo pipefail

echo "=== J52 Worker VM Setup ==="
echo "Date: $(date)"
echo "Hostname: $(hostname)"

# Update system
echo "--- Updating system packages ---"
apt-get update -y
apt-get upgrade -y

# Install essentials
echo "--- Installing essentials ---"
apt-get install -y \
  curl wget git build-essential \
  ca-certificates gnupg lsb-release \
  unzip jq htop tmux

# Install Node.js 20 LTS
echo "--- Installing Node.js 20 ---"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"

# Install Claude Code CLI
echo "--- Installing Claude Code CLI ---"
npm install -g @anthropic-ai/claude-code
echo "Claude Code version: $(claude --version 2>/dev/null || echo 'not yet configured')"

# Install PostgreSQL client (for connecting to Cloud SQL)
echo "--- Installing PostgreSQL client ---"
apt-get install -y postgresql-client

# Create j52 user and directories
echo "--- Setting up j52 user ---"
useradd -m -s /bin/bash j52 || true
mkdir -p /opt/j52
mkdir -p /opt/j52/repos
mkdir -p /opt/j52/logs
chown -R j52:j52 /opt/j52

# Clone the J52 repo
echo "--- Cloning J52 repo ---"
su - j52 -c "cd /opt/j52 && git clone https://github.com/zimatabrand/J52.git app || true"
su - j52 -c "cd /opt/j52/app && npm install || true"

# Create systemd service
echo "--- Creating systemd service ---"
cat > /etc/systemd/system/j52-worker.service << 'EOF'
[Unit]
Description=J52 Worker Daemon
After=network.target

[Service]
Type=simple
User=j52
Group=j52
WorkingDirectory=/opt/j52/app
ExecStart=/usr/bin/node packages/worker/dist/index.js
Restart=always
RestartSec=10
StandardOutput=append:/opt/j52/logs/worker.log
StandardError=append:/opt/j52/logs/worker.log
Environment=NODE_ENV=production
Environment=HOME=/home/j52

# Resource limits
MemoryMax=4G
CPUQuota=150%

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable j52-worker

echo ""
echo "=== Setup Complete ==="
echo "Next steps:"
echo "  1. Set up DATABASE_URL env var in /etc/systemd/system/j52-worker.service"
echo "  2. Set up TAVILY_API_KEY env var"
echo "  3. Configure Claude Code: su - j52 -c 'claude config'"
echo "  4. Build: su - j52 -c 'cd /opt/j52/app && npm run build'"
echo "  5. Start: systemctl start j52-worker"
echo "  6. Check: systemctl status j52-worker"
echo "  7. Logs: tail -f /opt/j52/logs/worker.log"
