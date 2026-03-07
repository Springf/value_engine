"use client";

import { useEffect, useState } from "react";
import { Trash2, TrendingUp, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";

interface PortfolioResult {
    ticker: string;
    price: number | null;
    fcf?: number | null;
    shares_outstanding?: number | null;
    margin_of_safety: number | null;
    most_recent_quarter?: string | null;
    error?: string;
    pe?: number | null;
    peg?: number | null;
    return_on_equity?: number | null;
    operating_margin?: number | null;
    revenue_growth?: number | null;
}

const calculateDCF = (fcf: number | null, shares: number | null, growthRate: number, discountRate: number, terminalMultiple: number) => {
    if (!fcf || fcf <= 0 || !shares || shares <= 0) return null;

    const g = growthRate / 100;
    const d = discountRate / 100;
    const tm = terminalMultiple;

    let pv_fcf = 0;
    for (let i = 1; i <= 5; i++) {
        pv_fcf += (fcf * Math.pow(1 + g, i)) / Math.pow(1 + d, i);
    }

    const terminal_value = (fcf * Math.pow(1 + g, 5)) * tm;
    const pv_terminal_value = terminal_value / Math.pow(1 + d, 5);

    return (pv_fcf + pv_terminal_value) / shares;
};

const safeFormatPct = (val: number | null | undefined) =>
    val !== null && val !== undefined ? `${(val * 100).toFixed(1)}%` : "N/A";

export default function PortfolioPage() {
    const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
    const [data, setData] = useState<Record<string, PortfolioResult>>({});
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchPortfolio = async () => {
        try {
            const res = await fetch("http://localhost:8000/api/data/portfolio");
            if (res.ok) {
                const json = await res.json();
                setPortfolioItems(json);
                return json.map((item: any) => item.ticker);
            }
        } catch (err) {
            console.error("Failed to fetch portfolio from API", err);
        }
        return [];
    };

    useEffect(() => {
        const init = async () => {
            const tickers = await fetchPortfolio();
            refreshData(tickers);
        };
        init();
    }, []);

    const refreshData = async (currentTickers: string[]) => {
        if (currentTickers.length === 0) return;
        setLoading(true);
        try {
            const res = await fetch("http://localhost:8000/api/data/screen", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entities: currentTickers.map(t => ({ id: t, type: "ticker" })),
                    region: "all",
                    limit: currentTickers.length
                })
            });
            if (res.ok) {
                const json = await res.json();
                const dataMap: Record<string, PortfolioResult> = {};
                json.results.forEach((r: any) => {
                    dataMap[r.ticker] = r;
                });
                setData(dataMap);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setLastUpdated(new Date());
        }
    };

    const handleRefreshClick = () => {
        refreshData(portfolioItems.map(item => item.ticker));
    };

    const removeTicker = async (ticker: string) => {
        if (!window.confirm(`Are you sure you want to remove ${ticker} from your portfolio?`)) {
            return;
        }

        try {
            await fetch(`http://localhost:8000/api/data/portfolio/${ticker}`, {
                method: "DELETE"
            });
            const updated = portfolioItems.filter((item) => item.ticker !== ticker);
            setPortfolioItems(updated);

            // Remove from local state data map
            const newData = { ...data };
            delete newData[ticker];
            setData(newData);
        } catch (err) {
            console.error("Failed to delete portfolio item", err);
            alert("Failed to remove ticker from portfolio.");
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-800">Your Portfolio</h1>
                    <p className="text-slate-500">Track the value and margin of safety of your saved stocks.</p>
                    {lastUpdated && (
                        <p className="text-xs text-slate-400 mt-1">
                            Market data as of {lastUpdated.toLocaleString()}
                        </p>
                    )}
                </div>
                <button
                    onClick={handleRefreshClick}
                    disabled={loading}
                    className="flex items-center gap-2 bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700"
                >
                    <RefreshCw className={`w-4 h-4 text-emerald-500 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {portfolioItems.length === 0 ? (
                <div className="text-center py-24 bg-white shadow-sm border border-slate-200 rounded-3xl flex flex-col items-center gap-5">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
                        <TrendingUp className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-slate-800 font-bold text-lg">No stocks tracked yet</p>
                        <p className="text-slate-500">Start discovering undervalued companies.</p>
                    </div>
                    <Link href="/screener" className="mt-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 px-6 py-2.5 rounded-full font-semibold transition-all hover:-translate-y-0.5">
                        Go to Screener
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {portfolioItems.map((portfolioItem) => {
                        const ticker = portfolioItem.ticker;
                        const row = data[ticker];
                        const history = portfolioItem.history || [];
                        const latestLog = history.length > 0 ? history[history.length - 1] : null;

                        // Dynamic DCF Calculation
                        const growthRate = latestLog?.dcf_growth ?? 5;
                        const discountRate = latestLog?.dcf_discount ?? 10;
                        const terminalMultiple = latestLog?.dcf_multiple ?? 10;

                        const dynamicDcf = calculateDCF(row?.fcf || null, row?.shares_outstanding || null, growthRate, discountRate, terminalMultiple);

                        const curPrice = row?.price;
                        let dynamicMos = null;
                        if (dynamicDcf !== null && curPrice) {
                            dynamicMos = ((dynamicDcf - curPrice) / dynamicDcf) * 100;
                        }

                        const isUndervalued = dynamicMos !== null && dynamicMos !== undefined && dynamicMos > 0;

                        // Calculate Position and P&L from transaction history
                        let totalSize = 0;
                        let avgCost = 0;
                        history.forEach((h: any) => {
                            if (h.transaction_type === "buy" && h.transaction_price && h.transaction_size) {
                                const oldCost = totalSize * avgCost;
                                totalSize += h.transaction_size;
                                avgCost = (oldCost + (h.transaction_price * h.transaction_size)) / totalSize;
                            } else if (h.transaction_type === "sell" && h.transaction_size) {
                                totalSize -= h.transaction_size;
                                // avgCost remains same
                            }
                        });

                        const marketPrice = row?.price;
                        let totalPL = null;
                        let totalPLPct = null;

                        if (totalSize > 0 && marketPrice && avgCost > 0) {
                            totalPL = (marketPrice - avgCost) * totalSize;
                            totalPLPct = ((marketPrice - avgCost) / avgCost) * 100;
                        }

                        return (
                            <div key={ticker} className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-6 rounded-3xl flex flex-col gap-4 relative group">
                                <button
                                    onClick={() => removeTicker(ticker)}
                                    className="absolute top-6 right-6 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                                <div className="flex justify-between items-start">
                                    <h3 className="text-3xl font-bold font-mono text-emerald-700">{ticker}</h3>
                                </div>
                                {row ? (
                                    <div className="flex flex-col gap-4 mt-2">
                                        <div className="flex justify-between items-center px-4 py-3 bg-slate-50 border-t border-slate-100">
                                            <div className="text-center flex-1">
                                                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">ROE</div>
                                                <div className="text-sm font-semibold text-slate-800">{safeFormatPct(row.return_on_equity)}</div>
                                            </div>
                                            <div className="w-px h-8 bg-slate-200"></div>
                                            <div className="text-center flex-1">
                                                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5" title="Operating Margin">OP. MARGIN</div>
                                                <div className="text-sm font-semibold text-slate-800">{safeFormatPct(row.operating_margin)}</div>
                                            </div>
                                            <div className="w-px h-8 bg-slate-200"></div>
                                            <div className="text-center flex-1">
                                                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5" title="Revenue Growth">REV. GRW.</div>
                                                <div className={`text-sm font-semibold ${row.revenue_growth && row.revenue_growth > 0 ? "text-emerald-600" : row.revenue_growth && row.revenue_growth < 0 ? "text-red-600" : "text-slate-800"}`}>{safeFormatPct(row.revenue_growth)}</div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                            <span className="text-slate-500 font-medium">Date Added</span>
                                            <span className="font-semibold text-slate-700 text-sm">{portfolioItem.dateAdded ? new Date(portfolioItem.dateAdded).toLocaleDateString() : "N/A"}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                            <span className="text-slate-500 font-medium">Price When Added</span>
                                            <span className="font-semibold text-slate-700 text-sm">${portfolioItem.priceAdded?.toFixed(2) || "N/A"}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                            <span className="text-slate-500 font-medium">Position</span>
                                            <span className="font-semibold text-slate-700 text-sm">{totalSize > 0 ? `${totalSize.toLocaleString()} shares` : "Observation Only"}</span>
                                        </div>
                                        {avgCost !== null && (
                                            <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                                <span className="text-slate-500 font-medium">Avg Cost</span>
                                                <span className="font-semibold text-slate-700 text-sm">${avgCost.toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                            <span className="text-slate-500 font-medium">Current Price</span>
                                            <span className="font-bold text-slate-800 text-base">${row.price?.toFixed(2) || "N/A"}</span>
                                        </div>
                                        {totalPL !== null && (
                                            <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                                <span className="text-slate-500 font-medium">Gain / Loss</span>
                                                <div className="flex flex-col items-end">
                                                    <span className={`font-bold text-sm ${totalPL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                        {totalPL >= 0 ? '+' : ''}${Math.abs(totalPL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                    <span className={`text-[10px] font-bold ${totalPLPct && totalPLPct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                        ({totalPLPct && totalPLPct >= 0 ? '+' : ''}{totalPLPct?.toFixed(2)}%)
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                            <span className="text-slate-500 font-medium">Latest DCF</span>
                                            <div className="flex flex-col items-end gap-0.5">
                                                {dynamicDcf !== null ? (
                                                    <span className="font-bold text-purple-600 text-sm">${dynamicDcf.toFixed(2)}</span>
                                                ) : (
                                                    <span className="text-slate-400 font-medium">N/A</span>
                                                )}
                                                {row?.most_recent_quarter && (
                                                    <span className="text-xs text-slate-400">FCF as of {row.most_recent_quarter}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                            <span className="text-slate-500 font-medium">Margin of Safety</span>
                                            {dynamicMos !== null && dynamicMos !== undefined ? (
                                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${isUndervalued ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                    {dynamicMos > 0 ? '+' : ''}{dynamicMos.toFixed(2)}%
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 font-medium">N/A</span>
                                            )}
                                        </div>
                                        {latestLog && latestLog.notes && (
                                            <div className="mt-2 text-xs text-slate-600 bg-slate-50/80 p-3 rounded-lg border border-slate-100 italic line-clamp-3">
                                                "{latestLog.notes}"
                                            </div>
                                        )}
                                        <Link
                                            href={`/analysis/${ticker}`}
                                            className="mt-4 w-full text-center py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors rounded-xl text-sm font-semibold text-slate-700 hover:text-emerald-600"
                                        >
                                            View Analysis
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="text-sm text-slate-500 flex items-center gap-2 mt-4">
                                        <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> Loading data...
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
