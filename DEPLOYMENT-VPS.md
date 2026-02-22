# Hetzner VPS Deployment Guide — Alpha Monorepo

Step-by-step guide to deploy the Alpha ecosystem on a Hetzner VPS.

## Prerequisites

- Hetzner Cloud account with a VPS (Ubuntu 24.04 recommended, minimum 4GB RAM)
- Domain name with DNS access (for subdomain routing)
- GitHub repository: `pmindl/Alpha`

---

## Phase 1: VPS Initial Setup

### 1.1 Create the VPS

1. Go to [Hetzner Cloud Console](https://console.hetzner.cloud)
2. Create a new server:
   - **Image**: Ubuntu 24.04
   - **Type**: CX22 (2 vCPU, 4GB RAM) or higher
   - **Location**: Choose closest to you (e.g., `fsn1` for Frankfurt)
   - **SSH Key**: Add your public SSH key
3. Note the server IP address

### 1.2 Harden SSH

```bash
# SSH into the VPS as root
ssh root@YOUR_VPS_IP

# Update system
apt update && apt upgrade -y

# Create deploy user
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy

# Set up SSH for deploy user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Harden SSH config
cat >> /etc/ssh/sshd_config << 'EOF'
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
EOF

systemctl restart sshd
```

> [!CAUTION]
> Before closing your root SSH session, verify you can SSH as `deploy` in a new terminal: `ssh deploy@YOUR_VPS_IP`

### 1.3 Configure Firewall

```bash
# As root (before disabling root login) or via deploy with sudo
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

---

## Phase 2: Install Runtime

SSH in as the `deploy` user for all remaining steps.

```bash
ssh deploy@YOUR_VPS_IP
```

### 2.1 Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v  # Should show v20.x
```

### 2.2 PM2 (Process Manager)

```bash
sudo npm install -g pm2
pm2 startup  # Follow the output instructions to enable auto-start on boot
```

### 2.3 Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### 2.4 Docker & Docker Compose (for LibreChat)

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy

# Log out and back in for docker group to take effect
exit
ssh deploy@YOUR_VPS_IP

# Verify
docker --version
docker compose version
```

### 2.5 Certbot (SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## Phase 3: Clone & Configure

### 3.1 Clone the Repository

```bash
cd ~
git clone https://github.com/pmindl/Alpha.git alpha
cd alpha
```

### 3.2 Set Up Secrets

**Option A — Vault mode (recommended):**

```bash
# Create the .env file with your master key
echo 'ALPHA_MASTER_KEY=your_master_key_here' > .env

# Copy the encrypted vault from your local machine
# Run this FROM YOUR LOCAL machine:
scp secrets/vault.encrypted.json deploy@YOUR_VPS_IP:~/alpha/secrets/
```

**Option B — Standalone .env.local per app:**

Create `.env.local` files in each app directory with the required environment variables.

### 3.3 Build Everything

```bash
npm ci
npx turbo run build
```

---

## Phase 4: Start Services

### 4.1 Start PM2 Apps

```bash
cd ~/alpha
pm2 start ecosystem.config.cjs
pm2 save  # Persist process list across reboots
```

Verify all processes are running:

```bash
pm2 status
pm2 logs --lines 20
```

### 4.2 Start LibreChat (Docker)

```bash
cd ~/alpha/apps/librechat
# Configure .env file for LibreChat (copy from your local)
docker compose up -d
docker compose ps  # Verify all containers
```

---

## Phase 5: Configure Nginx & SSL

### 5.1 Set Up DNS

Add A records for your subdomains pointing to the VPS IP:

| Subdomain | Type | Value |
|-----------|------|-------|
| `master.yourdomain.com` | A | YOUR_VPS_IP |
| `invoices.yourdomain.com` | A | YOUR_VPS_IP |
| `processor.yourdomain.com` | A | YOUR_VPS_IP |
| `responder.yourdomain.com` | A | YOUR_VPS_IP |
| `chat.yourdomain.com` | A | YOUR_VPS_IP |

### 5.2 Install Nginx Config

```bash
# Copy the template and replace YOUR_DOMAIN
cd ~/alpha
sudo cp nginx/alpha.conf /etc/nginx/sites-available/alpha.conf
sudo sed -i 's/YOUR_DOMAIN/yourdomain.com/g' /etc/nginx/sites-available/alpha.conf

# Enable the config
sudo ln -sf /etc/nginx/sites-available/alpha.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 5.3 Enable SSL

```bash
sudo certbot --nginx \
  -d master.yourdomain.com \
  -d invoices.yourdomain.com \
  -d processor.yourdomain.com \
  -d responder.yourdomain.com \
  -d chat.yourdomain.com
```

Certbot will automatically modify nginx config to redirect HTTP → HTTPS.

---

## Phase 6: Set Up GitHub Actions Deployment

### 6.1 Generate Deploy SSH Key

```bash
# On the VPS as deploy user
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_deploy  # Copy this private key
```

### 6.2 Add GitHub Secrets

Go to `GitHub → pmindl/Alpha → Settings → Secrets and variables → Actions` and add:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | Your VPS IP address |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Contents of `~/.ssh/github_deploy` (private key) |

### 6.3 Test the Pipeline

Push a commit to `main` and watch the Actions tab. The workflow will:

1. Build & test on GitHub runners
2. SSH into VPS
3. Pull, build, reload all services

---

## Verification Checklist

```bash
# On the VPS:
pm2 status                                    # All apps "online"
curl -s http://localhost:3000 | head -5       # Master responds
curl -s http://localhost:3001 | head -5       # Invoice Downloader responds
curl -s http://localhost:3002 | head -5       # Invoice Processor responds
curl -s http://localhost:3004 | head -5       # Customer Responder responds
docker compose -f apps/librechat/docker-compose.yml ps  # LibreChat containers up
```

Then visit each subdomain in your browser and verify the SSL lock icon.

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `pm2 status` | Show all process statuses |
| `pm2 logs` | Tail all logs |
| `pm2 logs master` | Tail logs for master only |
| `pm2 reload all` | Zero-downtime reload all |
| `pm2 restart all` | Hard restart all |
| `pm2 monit` | Interactive monitoring dashboard |
| `pm2 save` | Save current process list |
| `docker compose -f apps/librechat/docker-compose.yml logs -f` | LibreChat logs |
