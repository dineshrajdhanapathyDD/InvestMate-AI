# InvestMate AI - Deployment Guide

This guide covers local development, AWS deployment with SAM, frontend hosting
on S3 + CloudFront, verification, and teardown.

## Live deployment (reference)

The project was deployed and verified in `ap-south-1` (account `466742534146`):

- API base URL: `https://yrdnvo6e7c.execute-api.ap-south-1.amazonaws.com/prod`
- Public app URL: `https://d2x3869ki4yvj9.cloudfront.net`
- Model: `apac.amazon.nova-lite-v1:0` (Amazon Bedrock Nova Lite, APAC inference profile)

Your own deployment will produce different URLs; read them from the stack
outputs and the CloudFront distribution.

## Prerequisites

- AWS CLI v2, AWS SAM CLI, Node.js 18+, Python 3.13.
- AWS credentials with permission to deploy CloudFormation, Lambda, API Gateway,
  DynamoDB, IAM, S3, CloudFront, and to invoke Amazon Bedrock.
- Amazon Bedrock model access for Nova Lite in your target region.

### Region and model note (important)

- In `us-east-1`, Nova Lite can be invoked on-demand by its raw id
  `amazon.nova-lite-v1:0`.
- In `ap-south-1` (Mumbai), on-demand invocation of the raw id is NOT supported.
  You must use the cross-region inference profile id `apac.amazon.nova-lite-v1:0`.
  List available profiles with:
  ```
  aws bedrock list-inference-profiles --region ap-south-1
  ```

## 1. Local development

### Backend
```bash
cd backend
python -m venv .venv
. .venv/Scripts/activate          # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python -m pytest -q               # 31 tests
python local_server.py            # http://localhost:8000  (prefix /api/v1)
```
Local defaults: `DYNAMODB_ENABLED=false` (in-memory), `NSE_MCP_ENABLED=false`
(labelled sample data). Copy `.env.example` to `.env` to change anything.

### Frontend
```bash
cd frontend
npm install
npm test                          # 5 tests
npm run dev                       # http://localhost:5173
```
The dev app calls `http://localhost:8000` by default. Override with
`VITE_API_BASE_URL` in `frontend/.env`.

## 2. Deploy the backend (SAM)

```bash
cd backend
sam build --manifest requirements-lambda.txt
sam deploy \
  --stack-name investmate-ai \
  --region ap-south-1 \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --parameter-overrides "BedrockModelId=apac.amazon.nova-lite-v1:0 NseMcpEnabled=false"
```

Why `--manifest requirements-lambda.txt`: the deployed Lambda runs in sample
mode and only needs `boto3` (already in the runtime), so the manifest is empty.
The optional `mcp` SDK is not bundled; the code degrades gracefully without it.
To enable live NSE calls (see the NSE note below), add `mcp` and `httpx[http2]`
to the manifest and set `NseMcpEnabled=true`.

Read the outputs:
```bash
aws cloudformation describe-stacks --stack-name investmate-ai \
  --region ap-south-1 --query "Stacks[0].Outputs"
```
Note the `ApiBaseUrl`.

### Verify the backend
```bash
BASE=<ApiBaseUrl>/api/v1
curl -s "$BASE/health"
curl -s "$BASE/integrations/nse"
curl -s "$BASE/stocks/RELIANCE"
curl -s -X POST "$BASE/research" -H "Content-Type: application/json" \
  -d '{"question":"Explain TCS historical performance","symbol":"TCS","period":"3M","beginnerMode":true}'
```
A successful `/research` call returns a grounded answer whose numbers match the
`evidence` block, with `isSample: true` and source timestamps.

## 3. Deploy the frontend (S3 + CloudFront)

```bash
cd frontend
# Point the build at your deployed API:
echo "VITE_API_BASE_URL=<ApiBaseUrl>" > .env.production
npm run build

# Create a private bucket and upload the build:
aws s3api create-bucket --bucket <your-bucket> --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1
aws s3 sync dist s3://<your-bucket> --delete
```

Create a CloudFront Origin Access Control and a distribution whose origin is the
bucket's regional domain (`<your-bucket>.s3.ap-south-1.amazonaws.com`), with:
- Default root object `index.html`
- Viewer protocol policy `redirect-to-https`
- Custom error responses: 403 and 404 both return `/index.html` with HTTP 200
  (SPA client-side routing)

Then attach a bucket policy allowing `cloudfront.amazonaws.com` to `s3:GetObject`
restricted by `AWS:SourceArn` of your distribution. Keep S3 Block Public Access
on. Wait for the distribution to reach `Deployed`, then open its domain.

### Verify the frontend
```bash
curl -I https://<distribution-domain>/            # 200, text/html
curl -o /dev/null -w "%{http_code}" https://<distribution-domain>/research   # 200 (SPA fallback)
```

## 4. Operations and security notes

- IAM is least-privilege: Lambda may invoke only the Nova foundation models and
  inference profiles, and read/write only the one DynamoDB table.
- Health and integration endpoints return sanitized data (host only, no URLs or
  secrets, no stack traces).
- API Gateway stage throttling is set to 10 rps / burst 20.
- CloudWatch logs are emitted by Lambda and API Gateway.
- No secrets are required by this app. Secrets Manager would only be introduced
  if a third-party data provider key were added.

## 5. The NSE MCP integration

The official NSE MCP endpoints (`cm-market`, `nse-bhavcopy`, transport
`streamable-http`, no auth) sit behind Akamai bot management and respond only to
interactive browser/desktop clients (Claude Desktop, Claude.ai, ChatGPT). A
headless Lambda receives `504 Gateway Time-out`. This was verified during
development with curl, httpx, and the official MCP Python SDK.

InvestMate implements the real MCP `streamable-http` client (`NseMcpProvider`)
with discovery, timeouts, bounded retries, and clean teardown. Because the
endpoint is unreachable from a server runtime, the app defaults to a clearly
labelled, deterministic sample-data provider and never presents sample data as
live. The endpoint base URLs are configurable (`NSE_MCP_CM_URL`,
`NSE_MCP_BHAV_URL`), so pointing them at a browser-session proxy that solves the
Akamai challenge switches the app to live data with no code change.

## 6. Teardown (remove all billable resources)

```bash
# Backend stack
sam delete --stack-name investmate-ai --region ap-south-1

# Frontend: disable then delete the CloudFront distribution
# (fetch ETag, set Enabled=false via update-distribution, wait Deployed, then:)
aws cloudfront delete-distribution --id <distribution-id> --if-match <etag>

# Delete the Origin Access Control
aws cloudfront delete-origin-access-control --id <oac-id> --if-match <etag>

# Empty and remove the bucket
aws s3 rb s3://<your-bucket> --force

# Remove the budget
aws budgets delete-budget --account-id <account-id> --budget-name investmate-ai-monthly
```

## 7. Cost

All resources are serverless and pay-per-use (Lambda, API Gateway, DynamoDB
on-demand, Bedrock per token, CloudFront per request). There are no always-on
components, so idle cost is effectively zero. A `$5`/month AWS Budget named
`investmate-ai-monthly` was created for visibility.
