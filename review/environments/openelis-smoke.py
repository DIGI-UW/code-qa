#!/usr/bin/env python3
"""Authentication checks against the disposable OpenELIS database only."""
import json
import os
from pathlib import Path
import shlex
import ssl
import subprocess
import urllib.error
import urllib.parse
import urllib.request

root = Path.home() / "review" / "source"
env = {**os.environ, "LETSENCRYPT_DOMAIN": "localhost", "DEV_STACK_TLS": "self-signed"}
output = subprocess.check_output([str(root / "scripts/dev-stack"), "env"], cwd=root, env=env, text=True)
endpoints = {}
for line in output.splitlines():
    if line.startswith("export "):
        key, value = line[7:].split("=", 1)
        endpoints[key] = shlex.split(value)[0]
base = endpoints["BASE_URL"]
# The repository's unattended test mode uses a self-signed certificate inside this VM.
context = ssl._create_unverified_context()

def login(password):
    data = urllib.parse.urlencode({"loginName": "admin", "password": password}).encode()
    request = urllib.request.Request(base + "/api/OpenELIS-Global/ValidateLogin?apiCall=true", data=data)
    try:
        response = urllib.request.urlopen(request, context=context, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, json.loads(response.read())

status, allowed = login("adminADMIN!")
rejected_status, rejected = login("code-qa-deliberately-invalid-password")
with urllib.request.urlopen(base + "/login", context=context, timeout=30) as page:
    html = page.read().decode()
    page_ok = page.status == 200 and ('id="root"' in html or "id='root'" in html)
assertions = [
    {"name": "default test administrator can authenticate", "passed": status == 200 and (allowed.get("authenticated") is True or allowed.get("success") is True)},
    {"name": "incorrect password is rejected", "passed": rejected_status in (200, 400, 401, 403) and (rejected.get("authenticated") is False or rejected.get("success") is False) and not (rejected.get("authenticated") is True or rejected.get("success") is True)},
    {"name": "frontend login document contains the application root", "passed": page_ok},
]
head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
print(json.dumps({"head": head, "assertions": assertions, "endpoints": {"BASE_URL": base}}))
