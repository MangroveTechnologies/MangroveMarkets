"""Release provenance must resolve SDK files from the nested working directory."""
import re
import subprocess
from pathlib import Path


def test_release_git_paths_resolve_the_sdk_metadata():
    package = Path(__file__).resolve().parents[1]
    repository = package.parents[1]
    workflow = repository / ".github/workflows/python-sdk-release.yml"
    paths = re.findall(r"git show HEAD:([^\s|)]+)", workflow.read_text())
    expected = {"packages/python-sdk/pyproject.toml", "packages/python-sdk/src/mangrove_markets/_version.py"}
    assert set(paths) == expected
    for path in paths:
        committed = subprocess.check_output(["git", "show", "HEAD:" + path], cwd=package)
        assert committed == (repository / path).read_bytes()
