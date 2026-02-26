#!/bin/bash
# Provision GCP infrastructure for J52
# Run this once to create the VM and Cloud SQL instance
# Prerequisites: gcloud CLI authenticated with project owner

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-radpowersports-458409}"
REGION="us-east1"
ZONE="us-east1-b"

echo "=== J52 GCP Infrastructure Provisioning ==="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"

# Set project
gcloud config set project "$PROJECT_ID"

# ---- Cloud SQL ----
echo ""
echo "--- Creating Cloud SQL instance ---"
gcloud sql instances create j52-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region="$REGION" \
  --storage-size=10GB \
  --storage-type=SSD \
  --availability-type=zonal \
  --no-assign-ip \
  --network=default \
  2>/dev/null || echo "Cloud SQL instance may already exist"

# Create database
gcloud sql databases create j52 --instance=j52-db 2>/dev/null || echo "Database may already exist"

# Create user
echo "Creating database user..."
gcloud sql users create j52 \
  --instance=j52-db \
  --password="$(openssl rand -base64 24)" \
  2>/dev/null || echo "User may already exist"

# ---- GCE VM ----
echo ""
echo "--- Creating GCE VM ---"
gcloud compute instances create j52-vm \
  --zone="$ZONE" \
  --machine-type=e2-standard-2 \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --boot-disk-type=pd-ssd \
  --tags=j52-worker \
  --scopes=cloud-platform \
  --metadata-from-file=startup-script=infra/scripts/setup-vm.sh \
  2>/dev/null || echo "VM may already exist"

# ---- Firewall ----
echo ""
echo "--- Configuring firewall ---"
# Allow SSH only (worker doesn't need inbound HTTP)
gcloud compute firewall-rules create j52-allow-ssh \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:22 \
  --target-tags=j52-worker \
  2>/dev/null || echo "Firewall rule may already exist"

echo ""
echo "=== Provisioning Complete ==="
echo ""
echo "Cloud SQL: j52-db ($REGION)"
echo "VM: j52-vm ($ZONE)"
echo ""
echo "Next steps:"
echo "  1. Get Cloud SQL connection name:"
echo "     gcloud sql instances describe j52-db --format='value(connectionName)'"
echo "  2. SSH into VM:"
echo "     gcloud compute ssh j52-vm --zone=$ZONE"
echo "  3. Store database URL in Secret Manager:"
echo "     echo -n 'postgresql://j52:PASSWORD@/j52?host=/cloudsql/CONNECTION_NAME' | \\"
echo "       gcloud secrets create j52-database-url --data-file=-"
echo "  4. Run migrations from VM"
