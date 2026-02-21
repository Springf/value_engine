from fastapi import APIRouter, HTTPException
from typing import List
from pydantic import BaseModel
from .sec_client import SECClient
from .yahoo_client import YahooClient
from models.calculators import calculate_dcf, calculate_graham_number

router = APIRouter(prefix="/api/data", tags=["data"])

sec_client = SECClient()
yahoo_client = YahooClient()

class ScreenRequest(BaseModel):
    tickers: List[str]

@router.post("/screen")
def screen_stocks(request: ScreenRequest):
    """
    Batch evaluates a list of tickers and returns their value metrics.
    """
    results = []
    for ticker_symbol in request.tickers:
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
