#!/usr/bin/env bash
set -euo pipefail

# This script replaces only the API container. Database, proxy and environment
# files belong to the existing instance and are deliberately preserved.
image_uri=$1
region=$2
[[ "$image_uri" =~ ^[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/[a-z0-9._/-]+:[a-f0-9]{40}$ ]]
exec 9>/var/lock/flenvn-deploy.lock
flock -n 9 || { echo 'Another deployment is in progress'; exit 1; }
test -f /opt/flenvn/api.env
docker inspect flenvn-api >/dev/null
docker network inspect flenvn >/dev/null

registry=${image_uri%%/*}
aws ecr get-login-password --region "$region" | docker login --username AWS --password-stdin "$registry" >/dev/null
docker pull "$image_uri" >/dev/null

# A retained stopped container provides rollback without rebuilding an image.
if docker container inspect flenvn-api-rollback >/dev/null 2>&1; then
  if [[ $(docker inspect --format '{{.State.Running}}' flenvn-api-rollback) == true ]]; then
    echo 'Rollback container is running; investigate before deploying'
    exit 1
  fi
  docker rm flenvn-api-rollback >/dev/null
fi
rollback() {
  trap - ERR
  docker rm -f flenvn-api >/dev/null 2>&1 || true
  docker rename flenvn-api-rollback flenvn-api
  docker start flenvn-api >/dev/null
  echo 'Deployment failed; previous API container restored'
  exit 1
}
docker stop --time 30 flenvn-api >/dev/null
docker rename flenvn-api flenvn-api-rollback
trap rollback ERR

run_args=(--env-file /opt/flenvn/api.env)
if [[ -f /opt/flenvn/api.extra.env ]]; then
  run_args+=(--env-file /opt/flenvn/api.extra.env)
fi
if [[ -d /opt/flenvn/google-credentials ]]; then
  run_args+=(--mount type=bind,src=/opt/flenvn/google-credentials,dst=/run/google-credentials,readonly)
fi
docker run -d --name flenvn-api --restart unless-stopped --network flenvn \
  "${run_args[@]}" "$image_uri" >/dev/null

for attempt in $(seq 1 60); do
  if docker exec flenvn-api node -e 'fetch("http://127.0.0.1:3000/api/v1/").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then
    trap - ERR
    echo "API deployment healthy: $image_uri"
    exit 0
  fi
  sleep 2
done
false
