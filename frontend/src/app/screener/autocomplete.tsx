"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2, X, Globe, Building2, TrendingUp } from "lucide-react";

export interface Entity {
    id: string;
    type: string;
    label: string;
}

interface AutocompleteProps {
    selectedEntities: Entity[];
    onChange: (entities: Entity[]) => void;
    region: string;
}

export default function AutocompleteInput({ selectedEntities, onChange, region }: AutocompleteProps) {
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<Entity[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchSuggestions = async (searchQuery: string) => {
        if (!searchQuery || searchQuery.length < 2) {
            setSuggestions([]);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`http://localhost:8000/api/data/search?q=${encodeURIComponent(searchQuery)}&region=${region}`);
            if (res.ok) {
                const data = await res.json();
                setSuggestions(data.results || []);
                setIsOpen(true);
            }
        } catch (error) {
            console.error("Error fetching suggestions:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        setIsOpen(true);

        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        debounceTimeout.current = setTimeout(() => {
            fetchSuggestions(value);
        }, 400); // 400ms debounce
    };

    const handleSelect = (entity: Entity) => {
        if (!selectedEntities.find((e) => e.id === entity.id)) {
            onChange([...selectedEntities, entity]);
        }
        setQuery("");
        setSuggestions([]);
        setIsOpen(false);
    };

    const handleRemove = (idToRemove: string) => {
        onChange(selectedEntities.filter((e) => e.id !== idToRemove));
    };

    const getEntityIcon = (type: string) => {
        switch (type) {
            case "sector": return <Building2 className="w-3 h-3" />;
            case "index": return <Globe className="w-3 h-3" />;
            default: return <TrendingUp className="w-3 h-3" />;
        }
    };

    const getEntityColor = (type: string) => {
        switch (type) {
            case "sector": return "bg-blue-100 text-blue-700 border-blue-200";
            case "index": return "bg-purple-100 text-purple-700 border-purple-200";
            default: return "bg-emerald-100 text-emerald-700 border-emerald-200";
        }
    };

    return (
        <div className="w-full relative" ref={wrapperRef}>
            <label className="text-sm font-semibold text-slate-600 block mb-2">Filters & Tickers</label>

            {/* Input & Selected Chips Container */}
            <div className="min-h-[52px] w-full bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-wrap gap-2 items-center focus-within:ring-2 focus-within:ring-emerald-500/50 focus-within:border-emerald-500/50 transition-all">

                {/* Selected Entities */}
                {selectedEntities.map((entity) => (
                    <div
                        key={entity.id}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${getEntityColor(entity.type)}`}
                    >
                        {getEntityIcon(entity.type)}
                        <span>{entity.label.split(" (")[0]}</span>
                        <button
                            onClick={() => handleRemove(entity.id)}
                            className="ml-1 opacity-60 hover:opacity-100 transition-opacity focus:outline-none"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}

                {/* Search Input */}
                <div className="flex-1 min-w-[150px] relative flex items-center">
                    {!query && selectedEntities.length === 0 && (
                        <Search className="absolute left-2 w-4 h-4 text-slate-400" />
                    )}
                    <input
                        type="text"
                        value={query}
                        onChange={handleInputChange}
                        onFocus={() => { if (query.length >= 2) setIsOpen(true); }}
                        className={`w-full bg-transparent border-none focus:outline-none focus:ring-0 text-slate-900 placeholder-slate-400 py-1 ${!query && selectedEntities.length === 0 ? 'pl-8' : 'pl-2'}`}
                        placeholder={selectedEntities.length === 0 ? "Search by ticker, sector, or index..." : "Add more..."}
                    />
                    {loading && (
                        <div className="absolute right-2">
                            <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                        </div>
                    )}
                </div>
            </div>

            {/* Dropdown Suggestions */}
            {isOpen && query.length >= 2 && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                    {suggestions.map((suggestion) => (
                        <button
                            key={suggestion.id}
                            onClick={() => handleSelect(suggestion)}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 flex flex-col transition-colors border-b border-slate-100 last:border-0"
                        >
                            <span className="font-semibold text-slate-800 break-words">{suggestion.id}</span>
                            <span className="text-xs text-slate-500 line-clamp-1">{suggestion.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {isOpen && query.length >= 2 && !loading && suggestions.length === 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 shadow-xl rounded-xl p-4 text-center">
                    <p className="text-sm text-slate-500">No matching equities or sectors found.</p>
                </div>
            )}
        </div>
    );
}
