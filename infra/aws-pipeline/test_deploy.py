"""Exercise container replacement and rollback with a fake Docker daemon."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("deploy-container.sh")
IMAGE = "123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/flenvn-prod-api:" + "a" * 40

DOCKER = r'''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
path = Path(os.environ["DOCKER_STATE"])
state = json.loads(path.read_text())
args = sys.argv[1:]
def finish(code=0):
    path.write_text(json.dumps(state))
    sys.exit(code)
if args[0] == 'inspect':
    name = args[-1]
    if name not in state: finish(1)
    if '--format' in args: print(str(state[name]['running']).lower())
elif args[:2] == ['container', 'inspect']:
    finish(0 if args[2] in state else 1)
elif args[0] == 'login': sys.stdin.read()
elif args[0] == 'network': pass
elif args[0] == 'pull':
    finish(1 if os.environ.get('FAIL_PULL') else 0)
elif args[0] == 'stop': state[args[-1]]['running'] = False
elif args[0] == 'rename': state[args[2]] = state.pop(args[1])
elif args[0] == 'rm': state.pop(args[-1], None)
elif args[0] == 'start': state[args[-1]]['running'] = True
elif args[0] == 'run': state['flenvn-api'] = {'image':args[-1], 'running':True}
elif args[0] == 'exec': finish(1 if os.environ.get('FAIL_HEALTH') else 0)
else: finish(2)
finish()
'''


class DeploymentTests(unittest.TestCase):
    def run_deploy(self, **flags):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            config = root / "config"
            config.mkdir()
            (config / "api.env").write_text("NODE_ENV=production\n")
            state = root / "docker-state.json"
            state.write_text(json.dumps({"flenvn-api": {"image": "previous", "running": True}}))
            for name, content in {
                "docker": DOCKER,
                "aws": "#!/bin/sh\nprintf 'test-password'\n",
                "sleep": "#!/bin/sh\nexit 0\n",
                "flock": "#!/bin/sh\nexit 0\n",
            }.items():
                target = root / name
                target.write_text(content)
                target.chmod(0o700)
            script = root / "deploy.sh"
            script.write_text(SCRIPT.read_text().replace("/opt/flenvn", str(config))
                              .replace("/var/lock/flenvn-deploy.lock", str(root / "lock")))
            result = subprocess.run(["bash", str(script), IMAGE, "ap-southeast-1"],
                                    env={**os.environ, "PATH": str(root) + ":" + os.environ["PATH"],
                                         "DOCKER_STATE": str(state), **flags},
                                    text=True, capture_output=True, timeout=30)
            return result, json.loads(state.read_text())

    def test_success_retains_previous_container_for_rollback(self):
        result, state = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(state["flenvn-api"]["image"], IMAGE)
        self.assertTrue(state["flenvn-api"]["running"])
        self.assertFalse(state["flenvn-api-rollback"]["running"])

    def test_failed_health_check_restores_previous_container(self):
        result, state = self.run_deploy(FAIL_HEALTH="true")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(state["flenvn-api"]["image"], "previous")
        self.assertTrue(state["flenvn-api"]["running"])
        self.assertNotIn("flenvn-api-rollback", state)

    def test_failed_pull_keeps_current_container_running(self):
        result, state = self.run_deploy(FAIL_PULL="true")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(state["flenvn-api"]["image"], "previous")
        self.assertTrue(state["flenvn-api"]["running"])


if __name__ == "__main__":
    unittest.main()
