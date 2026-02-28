"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export default function AnalysisIndexPage() {
    const [ticker, setTicker] = useState("");
    const router = useRouter();

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (ticker.trim()) {
            router.push(`/analysis/${ticker.trim().toUpperCase()}`);
        }
    };

    return (
        <div className="max-w-xl mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-800">Deep Dive Analysis</h1>
            <p className="text-slate-500 leading-relaxed">
                Enter a single ticker symbol to run a comprehensive value investing analysis including DCF models.
            </p>
            <form onSubmit={handleSearch} className="w-full relative mt-4 group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    placeholder="e.g. MSFT or 0700.HK"
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-2xl py-4 pl-16 pr-6 text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all font-mono shadow-md shadow-slate-200/50"
                />
                <button type="submit" className="hidden">Submit</button>
            </form>
        </div>
    );
}
