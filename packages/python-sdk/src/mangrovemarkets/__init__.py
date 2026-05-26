"""Backwards-compatibility shim for the old `mangrovemarkets` import path.

The Mangrove Markets Python SDK kept its PyPI distribution name as
`mangrovemarkets` but renamed the import path to `mangrove_markets`
starting in v1.0.2 so the import is unambiguous next to the
MangroveMarkets backend repo.

This shim aliases the old name to the new one at module-import time,
so `from mangrovemarkets import MangroveMarkets` and `from
mangrovemarkets.models import Whatever` both continue to work — they're
forwarded to the `mangrove_markets` package and emit a
DeprecationWarning on first import.

Will be removed in v2.0.0.
"""
from __future__ import annotations

import sys
import warnings

import mangrove_markets as _mangrove_markets

warnings.warn(
    "`mangrovemarkets` is the deprecated import path. Use `from mangrove_markets "
    "import ...` instead. The PyPI distribution name `mangrovemarkets` is "
    "unchanged — only the import path was renamed. This shim will be removed in "
    "v2.0.0.",
    DeprecationWarning,
    stacklevel=2,
)

sys.modules[__name__] = _mangrove_markets
