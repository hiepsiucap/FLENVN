#!/usr/bin/env python3
"""Deploy a tested image through SSM without transferring server secrets."""
import json
import os
from pathlib import Path
import shlex
import subprocess
import time


def aws(*args):
    return json.loads(subprocess.check_output(
        ["aws", *args, "--region", os.environ["AWS_DEFAULT_REGION"], "--output", "json"],
        text=True,
    ))


def main():
    artifact = json.loads(Path("deployment.json").read_text())
    image = artifact["image_uri"]
    repository = os.environ["ECR_REPOSITORY_URI"]
    if not image.startswith(repository + ":"):
        raise ValueError("Deployment image does not belong to the release repository")
    script = Path("infra/aws-pipeline/deploy-container.sh").read_text()
    command = "bash -s -- " + shlex.quote(image) + " " + shlex.quote(os.environ["AWS_DEFAULT_REGION"])
    command += " <<'FLENVN_DEPLOY_SCRIPT'\n" + script + "\nFLENVN_DEPLOY_SCRIPT"
    result = aws("ssm", "send-command", "--document-name", "AWS-RunShellScript",
                 "--instance-ids", os.environ["INSTANCE_ID"],
                 "--comment", "Deploy tested FLENVN API image " + artifact["revision"],
                 "--parameters", json.dumps({"commands": [command], "executionTimeout": ["600"]}))
    command_id = result["Command"]["CommandId"]
    print("SSM deployment command:", command_id, flush=True)
    for _ in range(90):
        time.sleep(5)
        try:
            invocation = aws("ssm", "get-command-invocation", "--command-id", command_id,
                             "--instance-id", os.environ["INSTANCE_ID"])
        except subprocess.CalledProcessError:
            continue
        status = invocation["Status"]
        if status in {"Pending", "InProgress", "Delayed"}:
            continue
        print(invocation.get("StandardOutputContent", ""))
        if status != "Success":
            raise RuntimeError("Deployment ended with status " + status)
        return
    raise TimeoutError("SSM deployment did not finish within the polling window")


if __name__ == "__main__":
    main()
