"use client";

import { useState, useEffect } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import AutocompleteInput, { Entity } from "./autocomplete";

interface ScreenResult {
    ticker: string;
    company_name: string;
    price: number | null;
    pe: number | null;
    peg: number | null;
    return_on_equity: number | null;
    operating_margin: number | null;
    revenue_growth: number | null;
    fcf: number | null;
    market_cap: number | null;
    eps: number | null;
    intrinsic_value: number | null;
    margin_of_safety: number | null;
}

const safeFormatPct = (val: number | null | undefined) =>
    val !== null && val !== undefined ? `${(val * 100).toFixed(1)}%` : "-";

export default function ScreenerPage() {
    const [selectedEntities, setSelectedEntities] = useState<Entity[]>([]);
    const [region, setRegion] = useState<string>("all");
    const [condition, setCondition] = useState<string>("or");
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [results, setResults] = useState<ScreenResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const savedSession = sessionStorage.getItem("screener_session");
        if (savedSession) {
            try {
                const parsed = JSON.parse(savedSession);
                if (parsed.selectedEntities) setSelectedEntities(parsed.selectedEntities);
                if (parsed.region) setRegion(parsed.region);
                if (parsed.condition) setCondition(parsed.condition);
                if (parsed.page) setPage(parsed.page);
                if (parsed.totalPages) setTotalPages(parsed.totalPages);
                if (parsed.totalCount) setTotalCount(parsed.totalCount);
                if (parsed.results) setResults(parsed.results);
            } catch (e) {
                console.error("Failed to parse saved session", e);
            }
        }
        setIsHydrated(true);
    }, []);

    useEffect(() => {
        if (!isHydrated) return;
        const sessionData = {
            selectedEntities,
            region,
            condition,
            page,
            totalPages,
            totalCount,
            results
        };
        sessionStorage.setItem("screener_session", JSON.stringify(sessionData));
    }, [selectedEntities, region, condition, page, totalPages, totalCount, results, isHydrated]);

    const handleReset = () => {
        setSelectedEntities([]);
        setRegion("all");
        setCondition("or");
        setPage(1);
        setTotalPages(1);
        setTotalCount(0);
        setResults([]);
        setError(null);
        sessionStorage.removeItem("screener_session");
    };

    const handleScreen = async (targetPage = 1) => {
        if (selectedEntities.length === 0) return;

        setLoading(true);
        setError(null);
        try {
            const res = await fetch("http://localhost:8000/api/data/screen", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entities: selectedEntities, region, condition, page: targetPage, limit: 50 })
            });

            if (!res.ok) throw new Error("Failed to fetch screening data");
            const data = await res.json();

            // Sort results alphabetically by ticker
            const sortedResults = data.results.sort((a: ScreenResult, b: ScreenResult) => a.ticker.localeCompare(b.ticker));
            setResults(sortedResults);

            if (data.pagination) {
                setPage(data.pagination.page);
                setTotalPages(Math.ceil(data.pagination.total / data.pagination.limit) || 1);
                setTotalCount(data.pagination.total);
            } else {
                setPage(1);
                setTotalPages(1);
                setTotalCount(sortedResults.length);
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    const formatNumber = (num: number | null, prefix = "", suffix = "") => {
        if (num === null || num === undefined) return "-";
        // For large numbers like FCF
        if (num > 1_000_000_000) return `${prefix}${(num / 1_000_000_000).toFixed(2)}B${suffix}`;
        if (num > 1_000_000) return `${prefix}${(num / 1_000_000).toFixed(2)}M${suffix}`;
        return `${prefix}${num.toFixed(2)}${suffix}`;
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-slate-800">Stock Screener</h1>
                <p className="text-slate-500">
                    Enter a list of symbols to run fundamental value analysis models. Supports US and HK markets.
                </p>
            </div>

            {/* Control Panel */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full relative z-10 flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <AutocompleteInput
                            selectedEntities={selectedEntities}
                            onChange={setSelectedEntities}
                            region={region}
                        />
                    </div>
                    <div className="w-full md:w-48">
                        <label className="text-sm font-semibold text-slate-600 block mb-2">Region</label>
                        <select
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                            className="w-full min-h-[52px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-medium appearance-none"
                            style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
                        >
                            <option value="all">All Markets</option>
                            <option value="us">US Market</option>
                            <option value="hk">Hong Kong</option>
                        </select>
                    </div>
                    <div className="w-full md:w-48">
                        <label className="text-sm font-semibold text-slate-600 block mb-2">Match</label>
                        <select
                            value={condition}
                            onChange={(e) => setCondition(e.target.value)}
                            className="w-full min-h-[52px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-medium appearance-none"
                            style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
                        >
                            <option value="or">Any (OR)</option>
                            <option value="and">All (AND)</option>
                        </select>
                    </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
                    <button
                        onClick={handleReset}
                        disabled={loading || (selectedEntities.length === 0 && results.length === 0 && region === "all" && condition === "or")}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-3 rounded-xl font-bold transition-all"
                    >
                        <RotateCcw className="w-4 h-4" /> Reset
                    </button>
                    <button
                        onClick={() => handleScreen(1)}
                        disabled={loading || selectedEntities.length === 0}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/20 disabled:bg-emerald-500/50 disabled:shadow-none text-white px-8 py-3 rounded-xl font-bold transition-all hover:-translate-y-0.5"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Run Screen"}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 font-medium px-4 py-3 rounded-xl text-sm">
                    {error}
                </div>
            )}

            {/* Results Table */}
            {results.length > 0 && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 font-bold">Ticker</th>
                                    <th className="px-6 py-4 font-bold">Company Name</th>
                                    <th className="px-6 py-4 font-bold text-right">Price</th>
                                    <th className="px-6 py-4 font-bold text-right">Market Cap</th>
                                    <th className="px-6 py-4 font-bold text-right">P/E</th>
                                    <th className="px-6 py-4 font-bold text-right">PEG</th>
                                    <th className="px-6 py-4 font-bold text-right">ROE</th>
                                    <th className="px-6 py-4 font-bold text-right">Op. Margin</th>
                                    <th className="px-6 py-4 font-bold text-right">Rev. Grw</th>
                                    <th className="px-6 py-4 font-bold text-right">EPS</th>
                                    <th className="px-6 py-4 font-bold text-right">FCF</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800">
                                {results.map((res) => (
                                    <tr
                                        key={res.ticker}
                                        onClick={() => router.push(`/analysis/${res.ticker}`)}
                                        className="hover:bg-emerald-50/80 transition-colors cursor-pointer"
                                    >
                                        <td className="px-6 py-4 font-bold font-mono text-emerald-700">{res.ticker}</td>
                                        <td className="px-6 py-4 font-medium text-slate-600 truncate max-w-[200px]" title={res.company_name}>{res.company_name}</td>
                                        <td className="px-6 py-4 text-right font-medium">{formatNumber(res.price, "$")}</td>
                                        <td className="px-6 py-4 text-right font-medium">{formatNumber(res.market_cap, "$")}</td>
                                        <td className="px-6 py-4 text-right font-medium">{formatNumber(res.pe)}</td>
                                        <td className="px-6 py-4 text-right font-medium">{formatNumber(res.peg)}</td>
                                        <td className="px-6 py-4 text-right font-medium">{safeFormatPct(res.return_on_equity)}</td>
                                        <td className="px-6 py-4 text-right font-medium">{safeFormatPct(res.operating_margin)}</td>
                                        <td className={`px-6 py-4 text-right font-medium ${res.revenue_growth && res.revenue_growth > 0 ? "text-emerald-600" : res.revenue_growth && res.revenue_growth < 0 ? "text-red-600" : ""}`}>{safeFormatPct(res.revenue_growth)}</td>
                                        <td className="px-6 py-4 text-right font-medium">{formatNumber(res.eps, "$")}</td>
                                        <td className="px-6 py-4 text-right font-medium">{formatNumber(res.fcf, "$")}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
                            <span className="text-sm text-slate-500 font-medium">
                                Showing page {page} of {totalPages} ({totalCount} total results)
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleScreen(page - 1)}
                                    disabled={page <= 1 || loading}
                                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => handleScreen(page + 1)}
                                    disabled={page >= totalPages || loading}
                                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
