"""Verify the authoritative MIT notice in source copies and real SDK archives."""

import argparse
import hashlib
import json
import tarfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def verify_archive(path: Path, expected: bytes) -> dict[str, str]:
    """Read archive members without extracting or executing package contents."""
    if path.suffix == ".whl":
        with zipfile.ZipFile(path) as archive:
            names = [name for name in archive.namelist() if name.endswith(".dist-info/licenses/LICENSE")]
            contents = [archive.read(name) for name in names]
    else:
        with tarfile.open(path, "r:gz") as archive:
            names = []
            contents = []
            for member in archive.getmembers():
                if member.isfile() and member.name.count("/") == 1 and member.name.endswith("/LICENSE"):
                    stream = archive.extractfile(member)
                    if stream is None:
                        raise ValueError("License member is not a regular file")
                    names.append(member.name)
                    contents.append(stream.read())
    if len(contents) != 1 or contents[0] != expected:
        raise ValueError(f"{path.name}: expected one byte-identical complete source LICENSE")
    return {"archive": path.name, "member": names[0], "sha256": hashlib.sha256(expected).hexdigest()}


def main() -> None:
    """Fail before publication if source or archive license payload differs."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archives", nargs="*", type=Path)
    args = parser.parse_args()
    expected = (ROOT / "LICENSE").read_bytes()
    for directory in ("packages/sdk", "packages/python-sdk"):
        if (ROOT / directory / "LICENSE").read_bytes() != expected:
            raise ValueError(f"{directory}/LICENSE differs from the authoritative root LICENSE")
    print(json.dumps({"license_sha256": hashlib.sha256(expected).hexdigest(),
                      "archives": [verify_archive(path, expected) for path in args.archives]}, sort_keys=True))


if __name__ == "__main__":
    main()
