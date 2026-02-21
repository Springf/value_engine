from fastapi import APIRouter, HTTPException
from typing import List
from pydantic import BaseModel
from .sec_client import SECClient
from .yahoo_client import YahooClient
from models.calculators import calculate_dcf, calculate_graham_number

router = APIRouter(prefix="/api/data", tags=["data"])

sec_client = SECClient()
yahoo_client = YahooClient()

import requests

class Entity(BaseModel):
    id: str  # e.g. 'AAPL' or 'technology'
    type: str  # 'ticker', 'sector', or 'index'

class ScreenRequest(BaseModel):
    entities: List[Entity]
    region: str = "us"

@router.post("/screen")
def screen_stocks(request: ScreenRequest):
    """
    Batch evaluates a list of entities (tickers, sectors, indices) and returns their value metrics.
    """
    # 1. Flatten entities into a unified lists of tickers
    raw_tickers = set()
    for entity in request.entities:
        if entity.type == "ticker":
            raw_tickers.add(entity.id.upper())
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
                
                query = yf.EquityQuery('and', query_args) if len(query_args) > 1 else query_args[0]
                res = yf.screener.screen(query)
                quotes = res.get('quotes', [])
                
                # Cap at 30 to avoid huge request loads
                for q in quotes[:30]:
                    if 'symbol' in q:
                        raw_tickers.add(q['symbol'])
            except Exception as e:
                print(f"Error expanding sector {entity.id} in region {request.region}: {e}")
        elif entity.type == "index":
            # Expand known hardcoded index
            presets = {
                "dow30": ["AAPL", "AMGN", "AXP", "BA", "CAT", "CRM", "CSCO", "CVX", "DIS", "DOW", "GS", "HD", "HON", "IBM", "INTC", "JNJ", "JPM", "KO", "MCD", "MMM", "MRK", "MSFT", "NKE", "PG", "TRV", "UNH", "V", "VZ", "WBA", "WMT"],
                "nasdaq10": ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AVGO", "PEP", "COST"],
                "hk_tech": ["0700.HK", "3690.HK", "9988.HK", "1810.HK", "0981.HK", "0992.HK", "2018.HK", "9618.HK"],
                "hk_finance": ["0005.HK", "1299.HK", "0939.HK", "1398.HK", "2318.HK", "3988.HK", "0011.HK"],
            }
            if entity.id in presets:
                for t in presets[entity.id]:
                    raw_tickers.add(t)

    results = []
    # 2. Process all flattened tickers
    for ticker_symbol in list(raw_tickers):
        try:
            # We can reuse the single stock logic or simplify it
            # To avoid SEC rate limits during screening, we'll rely on Yahoo Finance for the screener
            yahoo_info = yahoo_client.get_stock_info(ticker_symbol)
            if not yahoo_info:
                continue
                
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
                
            pb = yahoo_info.get("price_to_book")
            pe = yahoo_info.get("trailing_pe")
            graham_number = None
            
            if pb and pe and pb > 0 and pe > 0 and shares_outstanding > 0:
                eps = current_price / pe
                bvps = current_price / pb
                graham_number = calculate_graham_number(eps=eps, book_value_per_share=bvps)
                
            margin_of_safety_dcf = round(((intrinsic_value - current_price) / intrinsic_value) * 100, 2) if intrinsic_value and current_price else None
            
            results.append({
                "ticker": ticker_symbol.upper(),
                "company_name": yahoo_info.get("short_name", "Unknown Company"),
                "price": current_price,
                "pe": pe,
                "pb": pb,
                "peg": yahoo_info.get("peg_ratio"),
                "fcf": fcf,
                "intrinsic_value": intrinsic_value,
                "graham_number": graham_number,
                "margin_of_safety": margin_of_safety_dcf
            })
        except Exception as e:
            print(f"Error screening {ticker_symbol}: {e}")
            continue
            
    return {"results": results}

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
    
    if is_us_stock:
        sec_data = sec_client.get_company_facts(ticker)

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
        
    # 2. Graham Number
    pb = yahoo_info.get("price_to_book")
    pe = yahoo_info.get("trailing_pe")
    graham_number = None
    
    if pb and pe and pb > 0 and pe > 0 and shares_outstanding > 0:
        # P/E = Price / EPS => EPS = Price / P/E
        # P/B = Price / BVPS => BVPS = Price / P/B
        eps = current_price / pe
        bvps = current_price / pb
        graham_number = calculate_graham_number(eps=eps, book_value_per_share=bvps)
        
    return {
        "ticker": ticker.upper(),
        "market_data": yahoo_info,
        "value_metrics": {
             "intrinsic_value_dcf": intrinsic_value,
             "graham_number": graham_number,
             "margin_of_safety_dcf": round(((intrinsic_value - current_price) / intrinsic_value) * 100, 2) if intrinsic_value and current_price else None,
             "margin_of_safety_graham": round(((graham_number - current_price) / graham_number) * 100, 2) if graham_number and current_price else None
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
            if region == "hk" and key in ["dow30", "nasdaq10"]:
                continue
            results.append({"id": key, "type": "index", "label": label})
            
    for key, label in sectors.items():
        if query in key.lower() or query in label.lower():
            results.append({"id": key, "type": "sector", "label": label})
            
    # 2. Search Yahoo Finance for Individual Equities
    try:
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}"
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
        
    return {"results": results[:20] if len(results) > 20 else results} # Limit to top 20 suggestions
