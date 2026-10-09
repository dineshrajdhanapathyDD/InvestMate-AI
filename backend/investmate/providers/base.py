"""The MarketDataProvider interface shared by all providers."""
from __future__ import annotations

from typing import Protocol

from ..models import ProviderResult


class MarketDataProvider(Protocol):
    name: str

    def search_symbol(self, query: str, limit: int = 10) -> ProviderResult: ...

    def get_quote(self, symbol: str) -> ProviderResult: ...

    def get_history(self, symbol: str, period: str) -> ProviderResult: ...

    def get_index_overview(self) -> ProviderResult: ...
