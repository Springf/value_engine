"use client";

import { useEffect, useState } from "react";
import { Trash2, TrendingUp, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";

interface PortfolioResult {
    ticker: string;
    price: number | null;
    margin_of_safety: number | null;
    error?: string;
}

export default function PortfolioPage() {
    const [tickers, setTickers] = useState<string[]>([]);
    const [data, setData] = useState<Record<string, PortfolioResult>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Load saved tickers from local storage
        const saved = JSON.parse(localStorage.getItem("portfolio") || "[]");
        setTickers(saved);
    }, []);

    const refreshData = async () => {
        if (tickers.length === 0) return;
        setLoading(true);
        try {
            const res = await fetch("http://localhost:8000/api/data/screen", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tickers })
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
        }
    };

    useEffect(() => {
        refreshData();
    }, [tickers]);

    const removeTicker = (ticker: string) => {
        const updated = tickers.filter((t) => t !== ticker);
        setTickers(updated);
        localStorage.setItem("portfolio", JSON.stringify(updated));
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-800">Your Portfolio</h1>
                    <p className="text-slate-500">Track the value and margin of safety of your saved stocks.</p>
                </div>
                <button
                    onClick={refreshData}
                    disabled={loading}
                    className="flex items-center gap-2 bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700"
                >
                    <RefreshCw className={`w-4 h-4 text-emerald-500 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {tickers.length === 0 ? (
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
                    {tickers.map((ticker) => {
                        const row = data[ticker];
                        const mos = row?.margin_of_safety;
                        const isUndervalued = mos !== null && mos !== undefined && mos > 0;

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
                                        <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                            <span className="text-slate-500 font-medium">Current Price</span>
                                            <span className="font-bold text-slate-800 text-base">${row.price?.toFixed(2) || "N/A"}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                            <span className="text-slate-500 font-medium">Margin of Safety</span>
                                            {mos !== null && mos !== undefined ? (
                                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${isUndervalued ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                    {mos > 0 ? '+' : ''}{mos.toFixed(2)}%
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 font-medium">N/A</span>
                                            )}
                                        </div>
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
