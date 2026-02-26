import yfinance as yf
from datetime import datetime
from typing import Dict, Any, Optional

class YahooClient:
    """Client for fetching data from Yahoo Finance."""
    
    def get_stock_info(self, ticker: str) -> Optional[Dict[str, Any]]:
        """Fetches basic stock information from Yahoo Finance."""
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            
            # Extract the next earnings date if available
            next_earnings_date = None
            if hasattr(stock, 'calendar') and isinstance(stock.calendar, dict):
                earnings_dates = stock.calendar.get('Earnings Date')
                if earnings_dates and len(earnings_dates) > 0:
                    next_earnings_date = str(earnings_dates[0])
                    
            return {
                "ticker": ticker,
                "short_name": info.get("shortName", info.get("longName", "Unknown Company")),
                "current_price": info.get("currentPrice", info.get("regularMarketPrice")),
                "forward_pe": info.get("forwardPE"),
                "trailing_pe": info.get("trailingPE"),
                "peg_ratio": info.get("pegRatio", info.get("trailingPegRatio")),
                "return_on_equity": info.get("returnOnEquity"),
                "operating_margin": info.get("operatingMargins"),
                "revenue_growth": info.get("revenueGrowth"),
                "book_value": info.get("bookValue"),
                "price_to_book": info.get("priceToBook"),
                "free_cashflow": info.get("freeCashflow"),
                "market_cap": info.get("marketCap"),
                "eps": info.get("trailingEps"),
                "forward_eps": info.get("forwardEps"),
                "currency": info.get("currency"),
                "financial_currency": info.get("financialCurrency"),
                "analyst_rating": info.get("recommendationKey"),
                "next_earnings_date": next_earnings_date,
                "debt_to_equity": info.get("debtToEquity"),
                "most_recent_quarter": (
                    datetime.utcfromtimestamp(info["mostRecentQuarter"]).strftime("%Y-%m-%d")
                    if info.get("mostRecentQuarter") else None
                ),
                "last_market_update": (
                    datetime.utcfromtimestamp(info["regularMarketTime"]).strftime("%Y-%m-%d %H:%M UTC")
                    if info.get("regularMarketTime") else None
                ),
            }
        except Exception as e:
            print(f"Error fetching data for {ticker} from Yahoo Finance: {e}")
            return None
