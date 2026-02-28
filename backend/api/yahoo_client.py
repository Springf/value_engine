import yfinance as yf
from datetime import datetime
import math
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
                "enterprise_value": info.get("enterpriseValue"),
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

    def _safe_float(self, value: Any) -> Optional[float]:
        try:
            val = float(value)
            if math.isnan(val):
                return None
            return val
        except (ValueError, TypeError):
            return None

    def get_advanced_metrics(self, ticker: str) -> Optional[Dict[str, Any]]:
        """Fetches advanced calculated metrics (EBIT, Invested Capital, Tax Rate) from financial statements."""
        try:
            stock = yf.Ticker(ticker)
            inc = stock.income_stmt
            bs = stock.balance_sheet
            
            if inc.empty and bs.empty:
                return None

            ebit = None
            tax_rate = 0.21 # Default fallback
            
            if not inc.empty:
                ebit = self._safe_float(inc.loc['EBIT'].iloc[0]) if 'EBIT' in inc.index else None
                
                tax_prov = self._safe_float(inc.loc['Tax Provision'].iloc[0]) if 'Tax Provision' in inc.index else None
                pretax = self._safe_float(inc.loc['Pretax Income'].iloc[0]) if 'Pretax Income' in inc.index else None
                
                if tax_prov is not None and pretax is not None and pretax > 0:
                    calculated_rate = tax_prov / pretax
                    if 0 <= calculated_rate <= 1:
                        tax_rate = calculated_rate

            invested_capital = None
            if not bs.empty:
                invested_capital = self._safe_float(bs.loc['Invested Capital'].iloc[0]) if 'Invested Capital' in bs.index else None

            return {
                "ebit": ebit,
                "invested_capital": invested_capital,
                "tax_rate": tax_rate
            }
        except Exception as e:
            print(f"Error fetching advanced metrics for {ticker} from Yahoo Finance: {e}")
            return None
