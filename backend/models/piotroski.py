from typing import Dict, Any

def calculate_piotroski_f_score(financials: Dict[str, Any]) -> int:
    """
    Calculate Piotroski F-Score (0-9).
    Requires a dictionary containing current and prior year financials:
    - net_income, prior_net_income
    - operating_cash_flow
    - roa (return on assets), prior_roa
    - long_term_debt, prior_long_term_debt
    - current_ratio, prior_current_ratio
    - shares_outstanding, prior_shares_outstanding
    - gross_margin, prior_gross_margin
    - asset_turnover, prior_asset_turnover
    """
    score = 0
    
    # 1. Profitability
    # Positive Net Income
    if financials.get('net_income', 0) > 0:
        score += 1
    # Positive Return on Assets
    if financials.get('roa', 0) > 0:
        score += 1
    # Positive Operating Cash Flow
    if financials.get('operating_cash_flow', 0) > 0:
        score += 1
    # Cash Flow > Net Income
    if financials.get('operating_cash_flow', 0) > financials.get('net_income', 0):
        score += 1
        
    # 2. Leverage, Liquidity and Source of Funds
    # Lower ratio of long term debt to in the current period compared to prior year
    if financials.get('long_term_debt', 0) < financials.get('prior_long_term_debt', float('inf')):
        score += 1
    # Higher current ratio this year compared to prior year
    if financials.get('current_ratio', 0) > financials.get('prior_current_ratio', float('inf')):
        score += 1
    # No new shares issued
    if financials.get('shares_outstanding', 0) <= financials.get('prior_shares_outstanding', 0):
        score += 1
        
    # 3. Operating Efficiency
    # Higher gross margin compared to previous year
    if financials.get('gross_margin', 0) > financials.get('prior_gross_margin', float('inf')):
        score += 1
    # Higher asset turnover ratio compared to previous year
    if financials.get('asset_turnover', 0) > financials.get('prior_asset_turnover', float('inf')):
        score += 1

    return score
