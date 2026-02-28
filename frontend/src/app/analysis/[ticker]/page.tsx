"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, TrendingUp, DollarSign, ShieldAlert, BarChart3, PlusCircle, ExternalLink, Calendar, Star, Copy, CheckCircle2 } from "lucide-react";

interface StockData {
    ticker: string;
    market_data: any;
    value_metrics: {
        intrinsic_value_dcf: number | null;
        margin_of_safety_dcf: number | null;
        earnings_yield?: number | null;
        ev_to_ebit?: number | null;
        fcf_yield?: number | null;
        roic?: number | null;
    };
    has_sec_data: boolean;
}

export default function AnalysisTickerPage() {
    const params = useParams();
    const ticker = params.ticker as string;
    const [data, setData] = useState<StockData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isInPortfolio, setIsInPortfolio] = useState(false);
    const [portfolioHistory, setPortfolioHistory] = useState<any[]>([]);
    const [notes, setNotes] = useState("");

    // DCF Assumptions State
    const [growthRate, setGrowthRate] = useState<number>(5);
    const [discountRate, setDiscountRate] = useState<number>(10);
    const [terminalMultiple, setTerminalMultiple] = useState<number>(10);

    // Dynamic DCF Result
    const [dcfValue, setDcfValue] = useState<number | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`http://localhost:8000/api/data/stock/${ticker}`);
                if (!res.ok) throw new Error("Failed to fetch stock data");
                const json = await res.json();
                setData(json);
                setDcfValue(json.value_metrics.intrinsic_value_dcf);
            } catch (err: any) {
                setError(err.message || "An error occurred");
            } finally {
                setLoading(false);
            }
        };

        const fetchPortfolioStatus = async () => {
            try {
                const res = await fetch(`http://localhost:8000/api/data/portfolio/${ticker}`);
                if (res.ok) {
                    const json = await res.json();
                    setIsInPortfolio(true);
                    if (json.history && Array.isArray(json.history)) {
                        setPortfolioHistory(json.history);
                        if (json.history.length > 0) {
                            const latest = json.history[json.history.length - 1];
                            if (latest.dcf_growth !== undefined && latest.dcf_growth !== null) setGrowthRate(latest.dcf_growth);
                            if (latest.dcf_discount !== undefined && latest.dcf_discount !== null) setDiscountRate(latest.dcf_discount);
                            if (latest.dcf_multiple !== undefined && latest.dcf_multiple !== null) setTerminalMultiple(latest.dcf_multiple);
                        }
                    }
                }
            } catch (err) {
                // Not in portfolio, ignore 404
            }
        };

        if (ticker) {
            fetchData();
            fetchPortfolioStatus();
        }
    }, [ticker]);

    // Recalculate DCF whenever inputs or data changes
    useEffect(() => {
        if (!data || !data.market_data) return;

        const fcf = data.market_data.free_cashflow;
        const shares_outstanding = data.market_data.shares_outstanding;

        if (!fcf || fcf <= 0 || !shares_outstanding || shares_outstanding <= 0) {
            setDcfValue(null);
            return;
        }

        const g = growthRate / 100;
        const d = discountRate / 100;
        const tm = terminalMultiple;

        let pv_fcf = 0;
        for (let i = 1; i <= 5; i++) {
            pv_fcf += (fcf * Math.pow(1 + g, i)) / Math.pow(1 + d, i);
        }

        const terminal_value = (fcf * Math.pow(1 + g, 5)) * tm;
        const pv_terminal_value = terminal_value / Math.pow(1 + d, 5);

        const intrinsic_value = (pv_fcf + pv_terminal_value) / shares_outstanding;
        setDcfValue(intrinsic_value);

    }, [data, growthRate, discountRate, terminalMultiple]);

    const saveToPortfolio = async () => {
        if (!data || !data.market_data) return;

        try {
            const historyEntry = {
                timestamp: new Date().toISOString(),
                notes: notes || null,
                dcf_growth: growthRate,
                dcf_discount: discountRate,
                dcf_multiple: terminalMultiple,
                dcf_value: dcfValue
            };

            const payload = {
                ticker: ticker,
                priceAdded: portfolioHistory.length === 0 ? data.market_data.current_price : undefined,
                dateAdded: portfolioHistory.length === 0 ? new Date().toISOString() : undefined,
                history: [historyEntry]
            };

            const res = await fetch("http://localhost:8000/api/data/portfolio", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert(isInPortfolio ? `${ticker} portfolio history updated!` : `${ticker} added to portfolio!`);
                setIsInPortfolio(true);
                // Refresh local history view seamlessly
                setPortfolioHistory(prev => [...prev, historyEntry]);
                setNotes(""); // Clear notes after save
            } else {
                alert(`Failed to save ${ticker} to portfolio.`);
            }
        } catch (err) {
            console.error(err);
            alert(`Error saving ${ticker} to portfolio.`);
        }
    };

    const formatCurrency = (num: number | null | undefined) => {
        if (num === null || num === undefined) return "N/A";
        return `$${num.toFixed(2)}`;
    };

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="bg-red-500/10 text-red-500 p-6 rounded-2xl border border-red-500/20 text-center">
                {error || "Stock data not found."}
            </div>
        );
    }

    const mos = dcfValue !== null && data.market_data.current_price
        ? ((dcfValue - data.market_data.current_price) / dcfValue) * 100
        : null;

    const isUndervalued = mos && mos > 0;

    // Generate AI Prompt
    const generatePrompt = () => {
        if (!data) return "";
        return `Please act as an expert value investor analyzing ${data.ticker} (${data.market_data.short_name || 'Unknown'}). 

Here is the current fundamental data:
- Current Price: ${formatCurrency(data.market_data.current_price)}
- Market Cap: ${data.market_data.market_cap ? `$${(data.market_data.market_cap / 1e9).toFixed(2)}B` : "N/A"}
- P/E Ratio: ${data.market_data.trailing_pe?.toFixed(2) || "N/A"}
- PEG Ratio: ${data.market_data.peg_ratio?.toFixed(2) || "N/A"}
- ROE: ${data.market_data.return_on_equity !== undefined && data.market_data.return_on_equity !== null ? `${(data.market_data.return_on_equity * 100).toFixed(1)}%` : "N/A"}
- Operating Margin: ${data.market_data.operating_margin !== undefined && data.market_data.operating_margin !== null ? `${(data.market_data.operating_margin * 100).toFixed(1)}%` : "N/A"}
- Revenue Growth: ${data.market_data.revenue_growth !== undefined && data.market_data.revenue_growth !== null ? `${(data.market_data.revenue_growth * 100).toFixed(1)}%` : "N/A"}
- Free Cash Flow: ${data.market_data.free_cashflow ? `$${(data.market_data.free_cashflow / 1e9).toFixed(2)}B` : "N/A"}
- EPS: ${formatCurrency(data.market_data.eps)}
- Earnings Yield: ${data.value_metrics?.earnings_yield !== undefined && data.value_metrics?.earnings_yield !== null ? `${data.value_metrics.earnings_yield}%` : "N/A"}
- FCF Yield: ${data.value_metrics?.fcf_yield !== undefined && data.value_metrics?.fcf_yield !== null ? `${data.value_metrics.fcf_yield}%` : "N/A"}
- EV/EBIT: ${data.value_metrics?.ev_to_ebit !== undefined && data.value_metrics?.ev_to_ebit !== null ? `${data.value_metrics.ev_to_ebit}x` : "N/A"}
- ROIC: ${data.value_metrics?.roic !== undefined && data.value_metrics?.roic !== null ? `${data.value_metrics.roic}%` : "N/A"}
- Debt/Eq Ratio: ${data.market_data.debt_to_equity !== undefined && data.market_data.debt_to_equity !== null ? data.market_data.debt_to_equity.toFixed(2) : "N/A"}
- Analyst Rating: ${data.market_data.analyst_rating ? data.market_data.analyst_rating.toUpperCase() : "N/A"}
- Next Earnings: ${data.market_data.next_earnings_date || "N/A"}

Valuation Models:
1. DCF Intrinsic Value: ${formatCurrency(dcfValue)} (based on ${growthRate}% growth, ${discountRate}% discount rate, ${terminalMultiple}x terminal multiple).

Based on Warren Buffett's value investing principles, does this stock offer a sufficient margin of safety? 
What are the key risks to my DCF assumptions, and what qualitative factors should I research further before investing?`;
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatePrompt());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col gap-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-slate-800">
                        {data.market_data.short_name || data.ticker} <span className="font-mono text-slate-400 text-2xl font-normal ml-2">{data.ticker}</span>
                    </h1>
                    <div className="flex items-center gap-3 mt-2 text-slate-500">
                        <span className="text-2xl font-semibold text-slate-900">{formatCurrency(data.market_data.current_price)}</span>
                        <span>Market Cap: {data.market_data.market_cap ? `$${(data.market_data.market_cap / 1e9).toFixed(2)}B` : "N/A"}</span>
                        {data.market_data.last_market_update && (
                            <span className="text-xs text-slate-400">{data.market_data.last_market_update}</span>
                        )}
                    </div>
                </div>
                <button
                    onClick={saveToPortfolio}
                    className="flex items-center justify-center gap-2 bg-slate-900 border border-slate-900 shadow-sm hover:shadow-md hover:bg-slate-800 text-white transition-all px-5 py-2.5 rounded-xl text-sm font-semibold hover:-translate-y-0.5"
                >
                    <PlusCircle className="w-4 h-4 text-emerald-400" /> {isInPortfolio ? "Update Portfolio" : "Add to Portfolio"}
                </button>
            </div>

            {/* Section 1: Stock Info */}
            <div className="flex flex-col gap-4">
                <h2 className="text-2xl font-bold text-slate-800">Stock Info</h2>
                {data.market_data.most_recent_quarter && (
                    <p className="text-xs text-slate-400 -mt-3">Fundamentals as of {data.market_data.most_recent_quarter}</p>
                )}
                <div className="flex flex-wrap gap-3">
                    <a
                        href={`https://finance.yahoo.com/quote/${data.ticker}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 font-semibold rounded-lg text-sm transition-colors"
                    >
                        Yahoo Finance <ExternalLink className="w-4 h-4" />
                    </a>
                    {data.has_sec_data && (
                        <a
                            href={`https://www.sec.gov/cgi-bin/browse-edgar?CIK=${data.ticker}&action=getcompany`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold rounded-lg text-sm transition-colors"
                        >
                            SEC Filings <ExternalLink className="w-4 h-4" />
                        </a>
                    )}
                    {data.ticker.endsWith('.HK') && (
                        <a
                            href={`https://www.hkex.com.hk/Market-Data/Securities-Prices/Equities/Equities-Quote?sym=${parseInt(data.ticker.replace('.HK', ''), 10)}&sc_lang=en`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold rounded-lg text-sm transition-colors"
                        >
                            HKEX <ExternalLink className="w-4 h-4" />
                        </a>
                    )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mt-2">
                    {[
                        { label: "P/E Ratio", value: data.market_data.trailing_pe?.toFixed(2), icon: TrendingUp },
                        { label: "PEG Ratio", value: data.market_data.peg_ratio?.toFixed(2), icon: TrendingUp },
                        { label: "EV/EBIT", value: data.value_metrics?.ev_to_ebit !== undefined && data.value_metrics?.ev_to_ebit !== null ? `${data.value_metrics.ev_to_ebit}x` : "N/A", icon: BarChart3 },
                        { label: "Earnings Yield", value: data.value_metrics?.earnings_yield !== undefined && data.value_metrics?.earnings_yield !== null ? `${data.value_metrics.earnings_yield}%` : "N/A", icon: DollarSign },
                        { label: "FCF Yield", value: data.value_metrics?.fcf_yield !== undefined && data.value_metrics?.fcf_yield !== null ? `${data.value_metrics.fcf_yield}%` : "N/A", icon: DollarSign },
                        { label: "ROE", value: data.market_data.return_on_equity !== undefined && data.market_data.return_on_equity !== null ? `${(data.market_data.return_on_equity * 100).toFixed(1)}%` : "N/A", icon: BarChart3 },
                        { label: "ROIC", value: data.value_metrics?.roic !== undefined && data.value_metrics?.roic !== null ? `${data.value_metrics.roic}%` : "N/A", icon: BarChart3 },
                        { label: "Op. Margin", value: data.market_data.operating_margin !== undefined && data.market_data.operating_margin !== null ? `${(data.market_data.operating_margin * 100).toFixed(1)}%` : "N/A", icon: BarChart3 },
                        { label: "Rev. Growth", value: data.market_data.revenue_growth !== undefined && data.market_data.revenue_growth !== null ? `${(data.market_data.revenue_growth * 100).toFixed(1)}%` : "N/A", icon: TrendingUp },
                        { label: "EPS", value: formatCurrency(data.market_data.eps), icon: DollarSign },
                        { label: "Free Cash Flow", value: data.market_data.free_cashflow ? `$${(data.market_data.free_cashflow / 1e9).toFixed(2)}B` : null, icon: DollarSign },
                        { label: "Debt/Eq Ratio", value: data.market_data.debt_to_equity !== undefined && data.market_data.debt_to_equity !== null ? data.market_data.debt_to_equity.toFixed(2) : "N/A", icon: BarChart3 },
                        { label: "Analyst Rating", value: data.market_data.analyst_rating ? data.market_data.analyst_rating.toUpperCase() : "N/A", icon: Star },
                        { label: "Next Earnings", value: data.market_data.next_earnings_date || "N/A", icon: Calendar },
                    ].map((stat, i) => (
                        <div key={i} className={`bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow ${stat.label === "Next Earnings" || stat.label === "Analyst Rating" ? "col-span-2 md:col-span-2 lg:col-span-3" : stat.label === "Free Cash Flow" ? "col-span-2 md:col-span-2 lg:col-span-2" : stat.label === "Debt/Eq Ratio" ? "col-span-2 md:col-span-2 lg:col-span-2" : "col-span-2 md:col-span-2 lg:col-span-2"}`}>
                            <div className="flex items-center gap-2 text-slate-500 mb-2">
                                <stat.icon className="w-4 h-4 text-emerald-500" />
                                <span className="text-xs uppercase tracking-wider font-bold">{stat.label}</span>
                            </div>
                            <span className={"text-xl font-bold truncate " + (stat.label === "Rev. Growth" && data.market_data.revenue_growth && data.market_data.revenue_growth > 0 ? "text-emerald-600" : stat.label === "Rev. Growth" && data.market_data.revenue_growth && data.market_data.revenue_growth < 0 ? "text-red-600" : "text-slate-800")} title={stat.value?.toString() || "N/A"}>{stat.value || "N/A"}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Section 2: Valuation Metrics */}
            <div className="flex flex-col gap-4 mt-4">
                <h2 className="text-2xl font-bold text-slate-800">Valuation Metrics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={`p-8 rounded-3xl border relative overflow-hidden transition-transform duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md ${isUndervalued ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'}`}>
                        <ShieldAlert className={`absolute -right-4 -bottom-4 w-32 h-32 opacity-10 ${isUndervalued ? 'text-emerald-500' : 'text-red-500'}`} />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Intrinsic Value (DCF)</h3>
                        <div className="mt-2 text-5xl font-bold tracking-tight text-slate-800">
                            {formatCurrency(dcfValue)}
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                            <span className={`px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm ${isUndervalued ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {mos !== null ? `${mos > 0 ? '+' : ''}${mos}%` : "N/A"}
                            </span>
                            <span className="text-sm font-medium text-slate-500">Margin of Safety</span>
                        </div>

                        {/* Interactive Assumptions */}
                        <div className="mt-6 pt-6 border-t border-slate-200/50">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 block">Model Assumptions</h4>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-slate-500 block mb-1">Growth (Y1-5)</label>
                                    <div className="relative">
                                        <input type="number" value={growthRate} onChange={(e) => setGrowthRate(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8" />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">%</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 block mb-1">Discount Rate</label>
                                    <div className="relative">
                                        <input type="number" value={discountRate} onChange={(e) => setDiscountRate(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8" />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">%</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 block mb-1">Term. Multiple</label>
                                    <div className="relative">
                                        <input type="number" value={terminalMultiple} onChange={(e) => setTerminalMultiple(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-6" />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">x</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

            </div>

            {/* Section 3: Investment Notes */}
            <div className="flex flex-col gap-4 mt-4">
                <h2 className="text-2xl font-bold text-slate-800">Investment Notes</h2>
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                    <p className="text-sm text-slate-500 mb-3">Record any qualitative thoughts or thesis points before saving to your portfolio.</p>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. They just announced a massive buyback, and margins are expanding rapidly..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors"
                    />
                </div>
            </div>

            {/* Section 4: History Logs */}
            {portfolioHistory.length > 0 && (
                <div className="flex flex-col gap-4 mt-4">
                    <h2 className="text-2xl font-bold text-slate-800">Portfolio History</h2>
                    <div className="flex flex-col gap-4">
                        {[...portfolioHistory].reverse().map((log, idx) => (
                            <div key={idx} className="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                                        Log #{portfolioHistory.length - idx} &bull; {new Date(log.timestamp).toLocaleString()}
                                    </span>
                                    <span className="text-sm font-bold text-slate-800">
                                        DCF: {formatCurrency(log.dcf_value)}
                                    </span>
                                </div>
                                {log.notes && (
                                    <div className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 mb-3 whitespace-pre-wrap">
                                        {log.notes}
                                    </div>
                                )}
                                <div className="flex items-center gap-6 text-xs text-slate-500 font-medium border-t border-slate-100 pt-3">
                                    <span>Growth: <strong className="text-slate-700">{log.dcf_growth}%</strong></span>
                                    <span>Discount: <strong className="text-slate-700">{log.dcf_discount}%</strong></span>
                                    <span>Terminal: <strong className="text-slate-700">{log.dcf_multiple}x</strong></span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Section 5: AI Investment Advice */}
            <div className="flex flex-col gap-4 mt-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-slate-800">AI Investment Advice</h2>
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 transition-colors rounded-lg text-sm font-semibold shadow-sm"
                    >
                        {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                        {copied ? "Copied!" : "Copy Prompt"}
                    </button>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 relative group">
                    <p className="text-sm font-medium text-slate-500 mb-4">
                        Copy this automatically generated prompt and paste it into ChatGPT, Claude, or Gemini for a qualitative analysis of this stock based on live data.
                    </p>
                    <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700 bg-white border border-slate-200 p-5 rounded-xl overflow-x-auto shadow-inner leading-relaxed">
                        {generatePrompt()}
                    </pre>
                </div>
            </div>

        </div>
    );
}
