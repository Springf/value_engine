"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import AutocompleteInput, { Entity } from "./autocomplete";

interface ScreenResult {
    ticker: string;
    price: number | null;
    pe: number | null;
    pb: number | null;
    peg: number | null;
    fcf: number | null;
    intrinsic_value: number | null;
    graham_number: number | null;
    margin_of_safety: number | null;
}

export default function ScreenerPage() {
    const [selectedEntities, setSelectedEntities] = useState<Entity[]>([
        { id: "AAPL", type: "ticker", label: "Apple Inc." },
        { id: "MSFT", type: "ticker", label: "Microsoft Corporation" },
        { id: "GOOGL", type: "ticker", label: "Alphabet Inc." }
    ]);
    const [results, setResults] = useState<ScreenResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleScreen = async () => {
        if (selectedEntities.length === 0) return;

        setLoading(true);
        setError(null);
        try {
            const res = await fetch("http://localhost:8000/api/data/screen", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entities: selectedEntities })
            });

            if (!res.ok) throw new Error("Failed to fetch screening data");
            const data = await res.json();
            setResults(data.results);
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
                <div className="flex-1 w-full relative z-10">
                    <AutocompleteInput
                        selectedEntities={selectedEntities}
                        onChange={setSelectedEntities}
                    />
                </div>
                <button
                    onClick={handleScreen}
                    disabled={loading || selectedEntities.length === 0}
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/20 disabled:bg-emerald-500/50 disabled:shadow-none text-white px-8 py-3 rounded-xl font-bold transition-all hover:-translate-y-0.5 mt-4 md:mt-0"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Run Screen"}
                </button>
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
                                    <th className="px-6 py-4 font-bold text-right">Price</th>
                                    <th className="px-6 py-4 font-bold text-right">P/E</th>
                                    <th className="px-6 py-4 font-bold text-right">PEG</th>
                                    <th className="px-6 py-4 font-bold text-right">FCF</th>
                                    <th className="px-6 py-4 font-bold text-right">Intrinsic Val (DCF)</th>
                                    <th className="px-6 py-4 font-bold text-right">Margin of Safety</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800">
                                {results.map((res) => (
                                    <tr key={res.ticker} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-6 py-4 font-bold font-mono text-emerald-700">{res.ticker}</td>
                                        <td className="px-6 py-4 text-right font-medium">{formatNumber(res.price, "$")}</td>
                                        <td className="px-6 py-4 text-right font-medium">{formatNumber(res.pe)}</td>
                                        <td className="px-6 py-4 text-right font-medium">{formatNumber(res.peg)}</td>
                                        <td className="px-6 py-4 text-right font-medium">{formatNumber(res.fcf, "$")}</td>
                                        <td className="px-6 py-4 text-right text-emerald-600 font-bold">
                                            {formatNumber(res.intrinsic_value, "$")}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold">
                                            {res.margin_of_safety !== null ? (
                                                <span className={`px-3 py-1.5 rounded-lg ${res.margin_of_safety > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                    {res.margin_of_safety > 0 ? "+" : ""}{formatNumber(res.margin_of_safety, "", "%")}
                                                </span>
                                            ) : <span className="text-slate-400">-</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
