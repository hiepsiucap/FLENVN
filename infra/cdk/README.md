# FLENVN AWS CDK Infra

This CDK app creates a small EC2 setup for the FLENVN API and local PostgreSQL.

It creates:

- A new VPC with public subnets and no NAT Gateway.
- One EC2 instance.
- Security group rules for SSH, HTTP, and HTTPS.
- An encrypted GP3 root EBS volume.
- An Elastic IP.
- An IAM role with SSM access.
- An encrypted SQS vocabulary-labeling queue and dead-letter queue.
- EC2 IAM permissions to publish and consume vocabulary-labeling jobs.
- A first-boot script that installs Docker and writes a local Postgres `docker-compose.yml`.

PostgreSQL is bound to `127.0.0.1:5432` on the EC2 instance, so it is not publicly reachable.

## Prerequisites

Install AWS CLI and configure credentials:

```bash
aws configure
```

Install dependencies:

```bash
cd infra/cdk
npm install
```

Bootstrap CDK once per AWS account and region:

```bash
npx cdk bootstrap
```

## Deploy On-Demand

Use your EC2 key pair name, not the `.pem` file path.

```bash
npx cdk deploy \
  -c keyName=keyec2 \
  -c sshCidr=<your-public-ip>/32
```

Example instance sizing:

```bash
npx cdk deploy \
  -c keyName=keyec2 \
  -c sshCidr=<your-public-ip>/32 \
  -c instanceClass=t2 \
  -c instanceSize=micro \
  -c volumeSizeGiB=30
```

If AWS says your vCPU limit is `1`, use `t2.micro`. `t3.small` needs 2 vCPU and will fail until AWS increases your EC2 vCPU quota.

## Deploy Spot

Spot is cheaper, but AWS can interrupt the instance. Avoid Spot for a production database unless downtime is acceptable and backups are solid.

This stack currently deploys On-Demand. Keep `useSpot=false` for the first production deploy.

```bash
npx cdk deploy \
  -c keyName=keyec2 \
  -c sshCidr=<your-public-ip>/32 \
  -c useSpot=true \
  -c spotMaxPrice=0.012
```

## After Deploy

SSH into the server:

```bash
ssh -i C:\Users\billh\Downloads\keyec2.pem ec2-user@ec2-18-138-34-60.ap-southeast-1.compute.amazonaws.com
```

Edit the generated Postgres password before starting it:

```bash
cd /opt/flenvn
nano docker-compose.yml
docker compose up -d postgres
```

Then point the API `.env` on EC2 at local Postgres:

```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=flenvn_user
DB_PASS=<same-password-from-docker-compose>
DB_NAME=flenvn_db
DB_SSL=false
DB_SYNCHRONIZE=false
```

Copy the `VocabularyLabelingQueueUrl` value printed by CDK into the API
environment, then enable automatic labeling:

```env
AWS_REGION=ap-southeast-1
AUTO_LABELING_ENABLED=true
AUTO_LABELING_QUEUE_URL=<VocabularyLabelingQueueUrl>
AUTO_LABELING_GEMINI_TIMEOUT_MS=20000
AUTO_LABELING_PENDING_RECOVERY_MINUTES=5

GOOGLE_CLOUD_PROJECT=<your-google-cloud-project>
GOOGLE_CLOUD_LOCATION=global
GOOGLE_APPLICATION_CREDENTIALS=/secure/path/google-service-account.json
```

Store the Google credential file outside the repository with restrictive file
permissions. If Vertex authentication is already configured through workload
identity or another Application Default Credentials method, omit the credential
path.

The API consumes one message at a time inside the existing NestJS process to
avoid the memory overhead of a second process on `t2.micro`.

## Useful Commands

Preview CloudFormation:

```bash
npm run synth
```

Show AWS changes before deploying:

```bash
npm run diff
```

Deploy:

```bash
npm run deploy
```

Destroy the stack:

```bash
npx cdk destroy
```
