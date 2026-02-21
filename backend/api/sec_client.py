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
