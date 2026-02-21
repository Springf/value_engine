"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, TrendingUp, DollarSign, ShieldAlert, BarChart3, PlusCircle } from "lucide-react";

interface StockData {
    ticker: string;
    market_data: any;
    value_metrics: {
        intrinsic_value_dcf: number | null;
        graham_number: number | null;
        margin_of_safety_dcf: number | null;
        margin_of_safety_graham: number | null;
    };
    has_sec_data: boolean;
}

export default function AnalysisTickerPage() {
    const params = useParams();
    const ticker = params.ticker as string;
    const [data, setData] = useState<StockData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`http://localhost:8000/api/data/stock/${ticker}`);
                if (!res.ok) throw new Error("Failed to fetch stock data");
                const json = await res.json();
                setData(json);
            } catch (err: any) {
                setError(err.message || "An error occurred");
            } finally {
                setLoading(false);
            }
        };
        if (ticker) fetchData();
    }, [ticker]);

    const saveToPortfolio = () => {
        const saved = JSON.parse(localStorage.getItem("portfolio") || "[]");
        if (!saved.includes(ticker)) {
            saved.push(ticker);
            localStorage.setItem("portfolio", JSON.stringify(saved));
            alert(`${ticker} added to portfolio!`);
        } else {
            alert(`${ticker} is already in your portfolio.`);
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

    const mos = data.value_metrics.margin_of_safety_dcf;
    const isUndervalued = mos && mos > 0;

    return (
        <div className="flex flex-col gap-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight font-mono text-slate-800">{data.ticker}</h1>
                    <div className="flex items-center gap-3 mt-2 text-slate-500">
                        <span className="text-2xl font-semibold text-slate-900">{formatCurrency(data.market_data.current_price)}</span>
                        <span>Market Cap: {data.market_data.market_cap ? `$${(data.market_data.market_cap / 1e9).toFixed(2)}B` : "N/A"}</span>
                    </div>
                </div>
                <button
                    onClick={saveToPortfolio}
                    className="flex items-center justify-center gap-2 bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 text-slate-700 transition-all px-5 py-2.5 rounded-xl text-sm font-semibold hover:-translate-y-0.5"
                >
                    <PlusCircle className="w-4 h-4 text-emerald-500" /> Add to Portfolio
                </button>
            </div>

            {/* Hero Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-8 rounded-3xl border relative overflow-hidden transition-transform duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md ${isUndervalued ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'}`}>
                    <ShieldAlert className={`absolute -right-4 -bottom-4 w-32 h-32 opacity-10 ${isUndervalued ? 'text-emerald-500' : 'text-red-500'}`} />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Intrinsic Value (DCF)</h3>
                    <div className="mt-2 text-5xl font-bold tracking-tight text-slate-800">
                        {formatCurrency(data.value_metrics.intrinsic_value_dcf)}
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                        <span className={`px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm ${isUndervalued ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {mos !== null ? `${mos > 0 ? '+' : ''}${mos}%` : "N/A"}
                        </span>
                        <span className="text-sm font-medium text-slate-500">Margin of Safety</span>
                    </div>
                </div>

                <div className="p-8 rounded-3xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-transform duration-300 hover:-translate-y-1 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 relative z-10">Graham Number</h3>
                    <div className="mt-2 text-5xl font-bold tracking-tight text-purple-600 relative z-10">
                        {formatCurrency(data.value_metrics.graham_number)}
                    </div>
                    <div className="mt-4 flex flex-col gap-1 text-sm text-slate-500 relative z-10">
                        <p>Benjamin Graham's defensive price limit.</p>
                        <p className="font-mono bg-slate-50 text-slate-600 px-2 py-1 rounded inline-block w-max">sqrt(22.5 × EPS × BVPS)</p>
                    </div>
                </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "P/E Ratio", value: data.market_data.trailing_pe?.toFixed(2), icon: TrendingUp },
                    { label: "P/B Ratio", value: data.market_data.price_to_book?.toFixed(2), icon: BarChart3 },
                    { label: "PEG Ratio", value: data.market_data.peg_ratio?.toFixed(2), icon: TrendingUp },
                    { label: "Free Cash Flow", value: data.market_data.free_cashflow ? `$${(data.market_data.free_cashflow / 1e9).toFixed(2)}B` : null, icon: DollarSign },
                ].map((stat, i) => (
                    <div key={i} className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 text-slate-500">
                            <stat.icon className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs uppercase tracking-wider font-bold">{stat.label}</span>
                        </div>
                        <span className="text-2xl font-bold text-slate-800">{stat.value || "N/A"}</span>
                    </div>
                ))}
            </div>

            {data.has_sec_data && (
                <div className="bg-blue-50 border border-blue-200 p-6 rounded-2xl shadow-sm">
                    <h3 className="text-lg font-bold text-blue-800 flex items-center gap-2">
                        SEC EDGAR Data Available
                    </h3>
                    <p className="text-sm text-blue-600 mt-2">
                        This US entity has raw fundamentals cached from SEC filings. Advanced parsing for Piotroski F-Score can process this data.
                    </p>
                </div>
            )}
        </div>
    );
}
