# AWS backend pipeline

This stack runs CI and deployment in AWS, independently of GitHub Actions.
It targets the existing ARM64 EC2 instance and ECR repository in Singapore.
It does not create or replace the API server, database, proxy, or network.

## Flow

Pull requests to `main` run `flenvn-api-checks` in CodeBuild. The GitHub status
context is `AWS API checks`. A passing check is required before merging.

A push to `main` starts the V1 `flenvn-api` pipeline:

1. CodeConnections downloads the committed source from GitHub.
2. CodeBuild installs dependencies, runs tests, builds the application, and
   pushes an ARM64 container image tagged with the full Git commit SHA to ECR.
3. A separate CodeBuild project sends the deployment script to the existing
   instance through Systems Manager. It replaces only `flenvn-api`, keeps the
   instance's environment files and Google credential mount, checks the new
   container's own HTTP endpoint, and restores the previous container if the
   health check fails.

Deployment briefly stops the API container. The database and proxy keep running.
The previous stopped container remains available as `flenvn-api-rollback` until
the next deployment. Schema changes require their own reviewed migration plan;
container rollback cannot undo database migrations.

## Provision

Create a GitHub CodeConnection in `ap-southeast-1` and complete its one-time
GitHub authorization in the AWS console. It must show `AVAILABLE` and have
access to `hiepsiucap/FLENVN`.

```bash
aws cloudformation deploy \
  --region ap-southeast-1 \
  --stack-name FlenvnPipelineStack \
  --template-file infra/aws-pipeline/stack.json \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    ConnectionArn=<available-connection-arn> \
    InstanceId=<existing-instance-id> \
    RepositoryName=flenvn-prod-api \
    EnableGithubWebhook=true
```

The instance must be online in SSM and its instance role must allow pulling
from that ECR repository. Existing `/opt/flenvn/api.env`, Docker network
`flenvn`, and container `flenvn-api` are required. No secrets are stored in the
pipeline definition or source repository.

After provisioning, run the PR check before switching the required status to
`AWS API checks`. Preserve other branch protection settings. The GitHub Actions
CI and EC2 deployment workflows are replaced by these AWS projects.

```bash
aws codebuild start-build --region ap-southeast-1 \
  --project-name flenvn-api-checks --source-version <branch-or-commit>
aws codepipeline start-pipeline-execution --region ap-southeast-1 --name flenvn-api
```

The first pipeline run can fail before these files are merged to `main`, because
`main` does not yet contain the buildspec. Merging the setup starts a fresh run.

## Validation and cost controls

```bash
python3 -B -m unittest discover -s infra/aws-pipeline -p 'test_*.py' -v
bash -n infra/aws-pipeline/deploy-container.sh
aws cloudformation validate-template --region ap-southeast-1 \
  --template-body file://infra/aws-pipeline/stack.json
```

Projects use small on-demand ARM builders, one concurrent build each, and a
15-minute timeout. Artifact versions and logs expire after seven days. The
pipeline uses V1 pricing; existing EC2, ECR, and application costs remain separate.
PR checks also consume build minutes. No NAT gateway, extra EC2 instance, or
reserved build capacity is provisioned.
