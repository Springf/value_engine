import math
from typing import Optional

def calculate_dcf(
    free_cash_flow: float, 
    growth_rate: float, 
    discount_rate: float, 
    terminal_multiple: float, 
    shares_outstanding: int,
    years: int = 5
) -> Optional[float]:
    """
    Calculate the intrinsic value per share using a simple Discounted Cash Flow (DCF) model.
    """
    if free_cash_flow <= 0 or shares_outstanding <= 0:
        return None
        
    present_value = 0
    projected_fcf = free_cash_flow
    
    # Calculate PV of projected free cash flows
    for i in range(1, years + 1):
        projected_fcf *= (1 + growth_rate)
        present_value += projected_fcf / ((1 + discount_rate) ** i)
        
    # Calculate Terminal Value and its PV
    terminal_value = projected_fcf * terminal_multiple
    pv_terminal_value = terminal_value / ((1 + discount_rate) ** years)
    
    total_enterprise_value = present_value + pv_terminal_value
    intrinsic_value_per_share = total_enterprise_value / shares_outstanding
    
    return round(intrinsic_value_per_share, 2)


