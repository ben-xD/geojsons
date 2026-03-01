import { useCallback, useEffect, useRef, useState } from "react";
import { debounce } from "lodash";
import { geocode, GeocodingResult } from "./geocode";
import { getMapStyle } from "./mapStyles";
import { useStore } from "@/store/store";
import { flyToBbox, flyToPoint } from "./flyTo";

interface SearchBarProps {
	open: boolean;
	onClose: () => void;
}

export const SearchBar = ({ open, onClose }: SearchBarProps) => {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<GeocodingResult[]>([]);
	const inputRef = useRef<HTMLInputElement>(null);
	const abortRef = useRef<AbortController | null>(null);
	const mapStyleId = useStore.use.mapStyleId();

	const provider = getMapStyle(mapStyleId).provider;

	const debouncedSearch = useCallback(
		debounce(async (q: string) => {
			if (q.length < 2) {
				setResults([]);
				return;
			}

			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;

			try {
				const res = await geocode(q, provider, controller.signal);
				setResults(res);
			} catch {
				// Silently ignore aborted/failed requests
			}
		}, 300),
		[provider],
	);

	useEffect(() => {
		return () => {
			debouncedSearch.cancel();
			abortRef.current?.abort();
		};
	}, [debouncedSearch]);

	useEffect(() => {
		if (open) {
			setQuery("");
			setResults([]);
			// Delay focus to after render
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [open]);

	const handleSelect = (result: GeocodingResult) => {
		if (result.bbox) {
			flyToBbox(result.bbox);
		} else {
			flyToPoint(result.latitude, result.longitude);
		}
		onClose();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			onClose();
		}
	};

	if (!open) return null;

	return (
		<div className="absolute bottom-full mb-2 left-0 right-0 z-10">
			<div className="bg-card rounded-xl shadow-xl border border-border overflow-hidden">
				<input
					ref={inputRef}
					type="text"
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						debouncedSearch(e.target.value);
					}}
					onKeyDown={handleKeyDown}
					placeholder="Search for a place..."
					className="w-full px-4 py-2.5 text-sm text-foreground bg-card outline-none"
				/>
				{results.length > 0 && (
					<ul className="border-t border-border max-h-60 overflow-y-auto">
						{results.map((result, i) => (
							<li key={i}>
								<button
									className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-primary/5 transition-colors"
									onClick={() => handleSelect(result)}
								>
									{result.name}
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
};
