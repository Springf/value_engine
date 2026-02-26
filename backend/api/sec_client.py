import requests
from typing import Dict, Any, Optional

class SECClient:
    """Client for interacting with the SEC EDGAR API."""
    
    BASE_URL = "https://data.sec.gov"
    TICKER_TO_CIK_URL = "https://www.sec.gov/files/company_tickers.json"
    
    def __init__(self, user_agent: str = "ValueEngineApp contact@example.com"):
        self.headers = {
            "User-Agent": user_agent,
            "Accept-Encoding": "gzip, deflate"
        }
        self.ticker_to_cik_map: Optional[Dict[str, str]] = None

    def _load_tickers(self) -> None:
        """Loads and caches the mapping from ticker to CIK."""
        if self.ticker_to_cik_map is not None:
            return
            
        try:
            response = requests.get(self.TICKER_TO_CIK_URL, headers=self.headers)
            response.raise_for_status()
            data = response.json()
            # The API returns a dict of dicts: {"0": {"cik_str": 320193, "ticker": "AAPL", ...}}
            self.ticker_to_cik_map = {
                item["ticker"].upper(): str(item["cik_str"]).zfill(10)
                for item in data.values()
            }
        except Exception as e:
            print(f"Error loading SEC tickers: {e}")
            self.ticker_to_cik_map = {}

    def get_cik(self, ticker: str) -> Optional[str]:
        """Returns the 10-digit CIK for a given ticker symbol."""
        self._load_tickers()
        return self.ticker_to_cik_map.get(ticker.upper())

    def get_company_facts(self, ticker: str) -> Optional[Dict[str, Any]]:
        """Fetches all company facts (financials) available in EDGAR for a ticker."""
        cik = self.get_cik(ticker)
        if not cik:
            return None

        url = f"{self.BASE_URL}/api/xbrl/companyfacts/CIK{cik}.json"
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching facts for CIK {cik}: {e}")
            return None

    def _get_most_recent_value(self, facts: Dict[str, Any], concept: str) -> Optional[float]:
        """
        Extracts the most recent annual or quarterly value for a given US-GAAP concept
        from SEC XBRL company facts.
        """
        try:
            units = facts.get("facts", {}).get("us-gaap", {}).get(concept, {}).get("units", {})
            # Equity is in USD, shares are in 'shares'
            values = units.get("USD") or units.get("shares") or []

            # Filter to 10-K (annual) or 10-Q (quarterly) filings only — exclude 8-Ks, DEF14As, etc.
            filings = [v for v in values if v.get("form") in ("10-K", "10-Q") and "end" in v]
            if not filings:
                return None

            # Sort by end date descending and return the most recent value
            filings.sort(key=lambda v: v["end"], reverse=True)
            return float(filings[0]["val"])
        except Exception:
            return None

    def get_book_value_data(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Returns the most recent stockholders' equity and total shares outstanding
        from SEC EDGAR, which allows accurate P/B calculation for multi-class share structures.
        """
        facts = self.get_company_facts(ticker)
        if not facts:
            return None

        # Try primary equity concept, fall back to the consolidated version
        equity = self._get_most_recent_value(facts, "StockholdersEquity")
        if equity is None:
            equity = self._get_most_recent_value(
                facts, "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"
            )

        # Total shares outstanding (all classes)
        shares = self._get_most_recent_value(facts, "CommonStockSharesOutstanding")

        if equity is None or shares is None or shares <= 0:
            return None

        return {
            "stockholders_equity": equity,
            "total_shares_outstanding": shares,
            "book_value_per_share": equity / shares,
        }
