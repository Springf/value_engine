from fastapi import APIRouter, HTTPException
from typing import List
from pydantic import BaseModel
from .sec_client import SECClient
from .yahoo_client import YahooClient
from models.calculators import calculate_dcf
from .sp500_list import SP500_TICKERS

router = APIRouter(prefix="/api/data", tags=["data"])

sec_client = SECClient()
yahoo_client = YahooClient()

import os
import json
import requests

PORTFOLIO_FILE = "../portfolio/data.json"

def _read_portfolio():
    if not os.path.exists(PORTFOLIO_FILE):
        return []
    try:
        with open(PORTFOLIO_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []

def _write_portfolio(data):
    os.makedirs(os.path.dirname(PORTFOLIO_FILE), exist_ok=True)
    with open(PORTFOLIO_FILE, "w") as f:
        json.dump(data, f, indent=4)

class HistoryLog(BaseModel):
    timestamp: str
    notes: str | None = None
    dcf_growth: float | None = None
    dcf_discount: float | None = None
    dcf_multiple: float | None = None
    dcf_value: float | None = None

class PortfolioItem(BaseModel):
    ticker: str
    priceAdded: float | None = None
    dateAdded: str | None = None
    history: List[HistoryLog] = []


class Entity(BaseModel):
    id: str  # e.g. 'AAPL' or 'technology'
    type: str  # 'ticker', 'sector', or 'index'

class ScreenRequest(BaseModel):
    entities: List[Entity]
    region: str = "us"
    condition: str = "or"
    page: int = 1
    limit: int = 50

@router.post("/screen")
def screen_stocks(request: ScreenRequest):
    """
    Batch evaluates a list of entities (tickers, sectors, indices) and returns their value metrics.
    """
    # 1. Gather tickers per entity
    entity_ticker_sets = []
    
    for entity in request.entities:
        current_entity_tickers = set()
        
        if entity.type == "ticker":
            current_entity_tickers.add(entity.id.upper())
        elif entity.type == "sector":
            # expand sector with regional filtering
            try:
                import yfinance as yf
                # e.g., 'technology' -> 'Technology' (Capitalized for Yahoo Finance)
                sector_name = entity.id.replace("-", " ").title()
                if entity.id == "financial-services":
                    sector_name = "Financial Services"
                
                query_args = [yf.EquityQuery('eq', ['sector', sector_name])]
                if request.region != "all":
                    query_args.append(yf.EquityQuery('eq', ['region', request.region]))
                else:
                    query_args.append(yf.EquityQuery('or', [
                        yf.EquityQuery('eq', ['region', 'us']),
                        yf.EquityQuery('eq', ['region', 'hk'])
                    ]))
                
                query = yf.EquityQuery('and', query_args) if len(query_args) > 1 else query_args[0]
                
                # Paginate yfinance screener to collect ALL tickers (Yahoo max = 250 per call)
                BATCH_SIZE = 250
                offset = 0
                while True:
                    res = yf.screener.screen(query, size=BATCH_SIZE, offset=offset)
                    quotes = res.get('quotes', [])
                    for q in quotes:
                        if 'symbol' in q:
                            current_entity_tickers.add(q['symbol'])
                    if len(quotes) < BATCH_SIZE:
                        break  # Reached last page
                    offset += BATCH_SIZE
            except Exception as e:
                print(f"Error expanding sector {entity.id} in region {request.region}: {e}")
        elif entity.type == "index":
            # Expand known hardcoded index
            presets = {
                "dow30": ["AAPL", "AMGN", "AXP", "BA", "CAT", "CRM", "CSCO", "CVX", "DIS", "DOW", "GS", "HD", "HON", "IBM", "INTC", "JNJ", "JPM", "KO", "MCD", "MMM", "MRK", "MSFT", "NKE", "PG", "TRV", "UNH", "V", "VZ", "WBA", "WMT"],
                "nasdaq10": ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AVGO", "PEP", "COST"],
                "sp500": SP500_TICKERS,
                "hk_tech": ["0700.HK", "3690.HK", "9988.HK", "1810.HK", "0981.HK", "0992.HK", "2018.HK", "9618.HK"],
                "hk_finance": ["0005.HK", "1299.HK", "0939.HK", "1398.HK", "2318.HK", "3988.HK", "0011.HK"],
            }
            if entity.id in presets:
                for t in presets[entity.id]:
                    current_entity_tickers.add(t)
                    
        entity_ticker_sets.append(current_entity_tickers)

    # 2. Combine all gathered sets based on AND/OR condition
    if not entity_ticker_sets:
        raw_tickers = set()
    elif request.condition == "and":
        raw_tickers = entity_ticker_sets[0].intersection(*entity_ticker_sets[1:])
    else:
        raw_tickers = entity_ticker_sets[0].union(*entity_ticker_sets[1:])
        
    # 3. Apply Region Filter to final results (higher level filter)
    filtered_tickers = []
    for t in raw_tickers:
        if request.region == "us" and "." in t:
            continue
        if request.region == "hk" and not t.endswith(".HK"):
            continue
        if request.region == "all" and ("." in t and not t.endswith(".HK")):
            continue
        filtered_tickers.append(t)
        
    sorted_tickers = sorted(filtered_tickers)
    total_count = len(sorted_tickers)
    
    offset = (request.page - 1) * request.limit
    page_tickers = sorted_tickers[offset : offset + request.limit]
    
    results = []
    for ticker_symbol in page_tickers:
        try:
            # We fetch minimal info for screener display
            yahoo_info = yahoo_client.get_stock_info(ticker_symbol)
            if not yahoo_info:
                continue
            
            # Extract shares outstanding for frontend dynamic calculations
            market_cap = yahoo_info.get("market_cap", 0)
            current_price = yahoo_info.get("current_price", 0)
            shares_outstanding = 0
            if current_price and current_price > 0 and market_cap:
                shares_outstanding = int(market_cap / current_price)

            results.append({
                "ticker": ticker_symbol.upper(),
                "company_name": yahoo_info.get("short_name", "Unknown Company"),
                "price": current_price,
                "pe": yahoo_info.get("trailing_pe"),
                "peg": yahoo_info.get("peg_ratio"),
                "return_on_equity": yahoo_info.get("return_on_equity"),
                "operating_margin": yahoo_info.get("operating_margin"),
                "revenue_growth": yahoo_info.get("revenue_growth"),
                "fcf": yahoo_info.get("free_cashflow", 0),
                "market_cap": market_cap,
                "eps": yahoo_info.get("eps"),
                "shares_outstanding": shares_outstanding,
                "most_recent_quarter": yahoo_info.get("most_recent_quarter"),
            })
        except Exception as e:
            print(f"Error screening {ticker_symbol}: {e}")
            continue
            
    return {
        "results": results,
        "pagination": {
            "page": request.page,
            "limit": request.limit,
            "total": total_count
        }
    }

@router.get("/stock/{ticker}")
def get_stock_data(ticker: str):
    """
    Combines Yahoo Finance market data and SEC EDGAR fundamentals for a given ticker.
    For HK stocks (e.g., '0700.HK'), SEC data will be skipped.
    """
    yahoo_info = yahoo_client.get_stock_info(ticker)
    
    if not yahoo_info:
        raise HTTPException(status_code=404, detail="Stock not found in Yahoo Finance")

    # Only attempt SEC EDGAR for US stocks (no suffix usually, or explicitly requested)
    is_us_stock = "." not in ticker
    sec_data = None
    sec_bv_data = None

    if is_us_stock:
        sec_data = sec_client.get_company_facts(ticker)
        sec_bv_data = sec_client.get_book_value_data(ticker)

    # Calculate Value Metrics Using Available Data
    # 1. DCF Model Assuming standard 5% growth, 10% discount, 10x terminal multiple
    fcf = yahoo_info.get("free_cashflow", 0)
    market_cap = yahoo_info.get("market_cap", 0)
    current_price = yahoo_info.get("current_price", 0)
    
    shares_outstanding = 0
    if current_price and current_price > 0 and market_cap:
        shares_outstanding = int(market_cap / current_price)
        
    intrinsic_value = None
    if fcf and fcf > 0 and shares_outstanding > 0:
        intrinsic_value = calculate_dcf(
            free_cash_flow=fcf,
            growth_rate=0.05,
            discount_rate=0.10,
            terminal_multiple=10.0,
            shares_outstanding=shares_outstanding
        )


    # We still prefer SEC BVPS for US stocks since it uses total shares
    bvps = None
    if sec_bv_data:
        bvps = sec_bv_data.get("book_value_per_share")
        yahoo_info["sec_book_value_per_share"] = round(bvps, 4) if bvps else None

    # Eject raw EPS early and guard against corrupted strings from Yahoo Finance
    eps = yahoo_info.get("eps")
    if isinstance(eps, str):
        try:
            eps = float(eps.strip())
        except ValueError:
            eps = None
        
    # Explicitly attach shares_outstanding back to market_data for frontend usage
    yahoo_info["shares_outstanding"] = shares_outstanding

    # 3. Advanced Metrics (Earnings Yield, EV/EBIT, FCF Yield, ROIC)
    advanced_metrics = yahoo_client.get_advanced_metrics(ticker) or {}
    ebit = advanced_metrics.get("ebit")
    invested_capital = advanced_metrics.get("invested_capital")
    tax_rate = advanced_metrics.get("tax_rate", 0.21)

    earnings_yield = None
    try:
        if isinstance(eps, (int, float)):
            eps_float = float(eps)
        else:
            eps_float = float(str(eps).strip()) if eps is not None else None
            
        if current_price and current_price > 0 and eps_float is not None:
            earnings_yield = round((eps_float / current_price) * 100, 2)
    except (ValueError, TypeError):
        pass
        
    fcf_yield = None
    if market_cap and market_cap > 0 and fcf is not None:
        try:
            fcf_yield = round((float(fcf) / float(market_cap)) * 100, 2)
        except (ValueError, TypeError):
            pass
        
    enterprise_value = yahoo_info.get("enterprise_value")
    ev_to_ebit = None
    if enterprise_value is not None and ebit is not None and ebit != 0:
        try:
            ev_to_ebit = round(float(enterprise_value) / float(ebit), 2)
        except (ValueError, TypeError):
            pass
        
    roic = None
    if ebit is not None and invested_capital is not None and invested_capital != 0:
        try:
            nopat = float(ebit) * (1 - float(tax_rate))
            roic = round((nopat / float(invested_capital)) * 100, 2)
        except (ValueError, TypeError):
            pass

    return {
        "ticker": ticker.upper(),
        "market_data": yahoo_info,
        "value_metrics": {
             "intrinsic_value_dcf": intrinsic_value,
             "margin_of_safety_dcf": round(((intrinsic_value - current_price) / intrinsic_value) * 100, 2) if intrinsic_value and current_price else None,
             "earnings_yield": earnings_yield,
             "ev_to_ebit": ev_to_ebit,
             "fcf_yield": fcf_yield,
             "roic": roic
        },
        "has_sec_data": sec_data is not None

    }

@router.get("/search")
def search_entities(q: str = "", region: str = "all"):
    """
    Intelligent autocomplete search for tickers, sectors, and indices.
    Combines Yahoo Finance search API with our internal category lists.
    Filters out unsupported regions based on `region`.
    """
    if not q or len(q) < 2:
        return {"results": []}
        
    query = q.lower()
    results = []
    
    # 1. Search Internal Presets (Indices & Sectors)
    # Hardcoded Indexes
    presets = {
        "dow30": "Dow Jones 30 (Index)",
        "nasdaq10": "Top Tech Nasdaq (Index)",
        "sp500": "S&P 500 (Index)",
        "hk_tech": "Hong Kong Tech (Index)",
        "hk_finance": "Hong Kong Finance (Index)",
    }
    
    # Standard GICS sectors
    sectors = {
        "technology": "Technology (Sector)",
        "healthcare": "Healthcare (Sector)",
        "financial-services": "Financial Services (Sector)",
        "energy": "Energy (Sector)",
        "industrials": "Industrials (Sector)",
        "consumer-cyclical": "Consumer Cyclical (Sector)",
        "consumer-defensive": "Consumer Defensive (Sector)",
        "utilities": "Utilities (Sector)",
        "real-estate": "Real Estate (Sector)",
        "communication-services": "Communication Services (Sector)",
        "basic-materials": "Basic Materials (Sector)"
    }
    
    for key, label in presets.items():
        if query in key.lower() or query in label.lower():
            if region == "us" and key in ["hk_tech", "hk_finance"]:
                continue
            if region == "hk" and key in ["dow30", "nasdaq10", "sp500"]:
                continue
            results.append({"id": key, "type": "index", "label": label})
            
    for key, label in sectors.items():
        if query in key.lower() or query in label.lower():
            results.append({"id": key, "type": "sector", "label": label})
            
    # 2. Search Yahoo Finance for Individual Equities
    try:
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=100"
        headers = {'User-Agent': 'Mozilla/5.0'}
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            quotes = data.get("quotes", [])
            for quote in quotes:
                # We only want Equities and ETFs for our app
                if quote.get("quoteType") in ["EQUITY", "ETF"]:
                    symbol = quote.get("symbol", "")
                    shortname = quote.get("shortname", "Unknown")
                    
                    # Filter by Region if provided
                    if region == "us" and "." in symbol:
                        continue # Skip non-US explicitly
                    if region == "hk" and not symbol.endswith(".HK"):
                        continue # Skip non-HK
                    if region == "all" and ("." in symbol and not symbol.endswith(".HK")):
                        continue # For all, only allow US (no dot) and HK (.HK)
                        
                    results.append({
                        "id": symbol,
                        "type": "ticker",
                        "label": f"{symbol} - {shortname}"
                    })
    except Exception as e:
        print(f"Error searching Yahoo Finance for {query}: {e}")
        
    return {"results": results[:100] if len(results) > 100 else results} # Limit increased to 100

@router.get("/portfolio")
def get_portfolio():
    """
    Returns the list of saved portfolio items.
    """
    return _read_portfolio()

@router.get("/portfolio/{ticker}")
def get_portfolio_item(ticker: str):
    """
    Returns a specific portfolio item and its history, or 404 if not found.
    """
    portfolio = _read_portfolio()
    for p in portfolio:
        if p.get("ticker").upper() == ticker.upper():
            return p
    raise HTTPException(status_code=404, detail="Ticker not found in portfolio")

@router.post("/portfolio")
def add_to_portfolio(item: PortfolioItem):
    """
    Adds a new stock to the portfolio. If it already exists, appends to its history.
    """
    portfolio = _read_portfolio()
    
    # Check if already exists
    exists = False
    for p in portfolio:
        if p.get("ticker").upper() == item.ticker.upper():
            # Ensure history list exists
            if "history" not in p or not isinstance(p["history"], list):
                p["history"] = []
                
            # Append new history logs from the incoming item to the existing record
            for h in item.history:
                p["history"].append(h.model_dump())
                
            exists = True
            break
            
    if not exists:
        portfolio.append(item.model_dump())
        
    _write_portfolio(portfolio)
    return {"message": "Success"}

@router.delete("/portfolio/{ticker}")
def remove_from_portfolio(ticker: str):
    """
    Removes a stock from the portfolio.
    """
    portfolio = _read_portfolio()
    updated = [p for p in portfolio if p.get("ticker") != ticker]
    _write_portfolio(updated)
    return {"message": "Success"}

