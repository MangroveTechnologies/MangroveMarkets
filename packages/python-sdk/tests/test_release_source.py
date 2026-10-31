"""Release provenance must resolve SDK files from the nested working directory."""
import os
import re
import shlex
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


def test_release_configures_a_tagger_on_a_clean_runner(tmp_path):
    """Exercise the actual workflow identity commands in an isolated Git repo."""
    repository = Path(__file__).resolve().parents[3]
    workflow = repository / ".github/workflows/python-sdk-release.yml"
    tag_step = workflow.read_text().split("      - name: Tag release after artifact validation\n", 1)[1].split("      - name:", 1)[0]
    identity_commands = [shlex.split(line.strip()) for line in tag_step.splitlines()
                         if line.strip().startswith(("git config user.name ", "git config user.email "))]
    env = {key: value for key, value in os.environ.items()
           if not key.startswith("GIT_") and key != "EMAIL"}
    empty_global = tmp_path / "empty-global-config"
    empty_global.write_text("")
    env.update(GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL=str(empty_global))
    fixture = tmp_path / "fixture"
    fixture.mkdir()

    def git(*args, check=True):
        return subprocess.run(["git", *args], cwd=fixture, env=env,
                              text=True, capture_output=True, check=check)

    git("init", "--quiet")
    git("config", "user.useConfigOnly", "true")
    git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
        "commit", "--allow-empty", "--quiet", "-m", "fixture")
    failed = git("tag", "-a", "fixture-v1.1.1", "-m", "fixture", check=False)
    assert failed.returncode != 0
    assert "identity" in failed.stderr.lower() or "auto-detection" in failed.stderr.lower()
    for command in identity_commands:
        git(*command[1:])
    git("tag", "-a", "fixture-v1.1.1", "-m", "fixture")
    tagger = git("for-each-ref", "refs/tags/fixture-v1.1.1",
                 "--format=%(taggername) %(taggeremail)").stdout.strip()
    assert tagger == "github-actions[bot] <github-actions[bot]@users.noreply.github.com>"
    assert git("rev-parse", "fixture-v1.1.1^{commit}").stdout == git("rev-parse", "HEAD").stdout
