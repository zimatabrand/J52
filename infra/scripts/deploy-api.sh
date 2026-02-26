#!/bin/bash
# Deploy j52-api to Cloud Run
# Usage: ./deploy-api.sh [--region us-east1]

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-radpowersports-458409}"
REGION="${1:-us-east1}"
SERVICE_NAME="j52-api"

echo "=== Deploying j52-api to Cloud Run ==="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"

# Build and deploy from repo root
cd "$(git rev-parse --show-toplevel)"

gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --source . \
  --dockerfile packages/api/Dockerfile \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$PROJECT_ID"

echo ""
echo "=== Deploy Complete ==="
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format "value(status.url)")
echo "URL: $SERVICE_URL"
echo "Health: curl $SERVICE_URL/health"
