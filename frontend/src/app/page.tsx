import Image from "next/image";

import { ArrowRight, TrendingUp, ShieldCheck, BarChart3 } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col gap-12">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-20 gap-6">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-gradient-to-br from-slate-800 to-slate-500 bg-clip-text text-transparent transform hover:scale-105 transition-transform duration-500">
          Achieve Financial Freedom <br />
          <span className="text-emerald-500">Through Value!</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-500 max-w-2xl">
          Automate your fundamental analysis, calculate intrinsic value, and build a
          portfolio that stands the test of time using core value investing principles.
        </p>
        <div className="flex gap-4 pt-4">
          <a href="/screener" className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 text-white px-8 py-3.5 rounded-full font-semibold transition-all hover:-translate-y-1">
            Start Screening <ArrowRight className="w-4 h-4" />
          </a>
          <a href="/analysis" className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 shadow-sm px-8 py-3.5 rounded-full font-semibold transition-all hover:-translate-y-1 cursor-pointer">
            View Analytics
          </a>
        </div>
      </section>

      {/* Features Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t border-slate-200/60">
        <div className="bg-white border border-slate-200 shadow-sm hover:shadow-md p-8 rounded-3xl flex flex-col gap-4 group transition-all duration-300 hover:-translate-y-1">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">PEG & FCF Focus</h3>
          <p className="text-slate-500 leading-relaxed">
            Identify companies with growth at a reasonable price and robust free cash flow generation.
          </p>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm hover:shadow-md p-8 rounded-3xl flex flex-col gap-4 group transition-all duration-300 hover:-translate-y-1">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Intrinsic Value</h3>
          <p className="text-slate-500 leading-relaxed">
            Advanced Discounted Cash Flow (DCF) models to find the true margin of safety.
          </p>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm hover:shadow-md p-8 rounded-3xl flex flex-col gap-4 group transition-all duration-300 hover:-translate-y-1">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
            <BarChart3 className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">US & HK Markets</h3>
          <p className="text-slate-500 leading-relaxed">
            Tap into data from SEC EDGAR and HKEX to uncover undervalued opportunities globally.
          </p>
        </div>
      </section>
    </div>
  );
}
