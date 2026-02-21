import yfinance as yf
from typing import Dict, Any, Optional

class YahooClient:
    """Client for fetching data from Yahoo Finance."""
    
    def get_stock_info(self, ticker: str) -> Optional[Dict[str, Any]]:
        """Fetches basic stock information including price, PEG, P/E, P/B."""
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            
            return {
                "ticker": ticker,
                "short_name": info.get("shortName", info.get("longName", "Unknown Company")),
                "current_price": info.get("currentPrice", info.get("regularMarketPrice")),
                "forward_pe": info.get("forwardPE"),
                "trailing_pe": info.get("trailingPE", info.get("forwardPE")),
                "price_to_book": info.get("priceToBook"),
                "peg_ratio": info.get("pegRatio", info.get("trailingPegRatio")),
                "free_cashflow": info.get("freeCashflow"),
                "market_cap": info.get("marketCap"),
                "currency": info.get("currency")
            }
        except Exception as e:
            print(f"Error fetching data for {ticker} from Yahoo Finance: {e}")
            return None
