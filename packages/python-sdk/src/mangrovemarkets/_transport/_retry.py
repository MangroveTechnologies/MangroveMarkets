from __future__ import annotations

import logging
import random
import time

logger = logging.getLogger(__name__)


class RetryConfig:
    def __init__(self, max_retries: int = 3, auto_retry: bool = True) -> None:
        self.max_retries = max_retries
        self.auto_retry = auto_retry

    def should_retry(self, status_code: int, attempt: int) -> bool:
        if not self.auto_retry or attempt >= self.max_retries:
            return False
        return status_code in (429, 502, 503, 504)

    def wait_time(self, attempt: int, retry_after: int | None = None) -> float:
        if retry_after is not None:
            return float(retry_after)
        base = min(2**attempt, 30)
        jitter = random.uniform(0, base * 0.5)
        return base + jitter

    def wait(self, attempt: int, retry_after: int | None = None) -> None:
        wait = self.wait_time(attempt, retry_after)
        logger.debug(
            "Retrying in %.1fs (attempt %d/%d)", wait, attempt + 1, self.max_retries
        )
        time.sleep(wait)
