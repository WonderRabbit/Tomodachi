import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { requestSearch } from "../api/searchClient";
import { isApiClientError } from "../api/http";
import type { SearchResult, SearchResultType } from "../types";
import { Badge } from "./Primitives";

const SEARCH_TYPES: readonly (SearchResultType | "all")[] = ["all", "task", "project", "artifact", "agent-run"];

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SearchResultType | "all">("all");
  const trimmedQuery = query.trim();
  const searchQuery = useQuery({
    enabled: trimmedQuery.length >= 2,
    queryFn: ({ signal }) => requestSearch(trimmedQuery, type, signal),
    queryKey: ["search", trimmedQuery, type],
    retry: false,
  });

  return (
    <div className="global-search">
      <label className="search-box">
        <Search size={16} />
        <input
          aria-label="Global search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tasks, artifacts, agent runs"
          value={query}
        />
        <select
          aria-label="Search type"
          onChange={(event) => setType(event.target.value as SearchResultType | "all")}
          value={type}
        >
          {SEARCH_TYPES.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      {trimmedQuery.length >= 2 && (
        <SearchPanel
          error={searchQuery.error}
          isLoading={searchQuery.isLoading}
          results={searchQuery.data ?? []}
        />
      )}
    </div>
  );
}

function SearchPanel({
  error,
  isLoading,
  results,
}: {
  readonly error: Error | null;
  readonly isLoading: boolean;
  readonly results: readonly SearchResult[];
}) {
  if (isLoading) {
    return <div className="search-panel"><span className="muted">Searching backend...</span></div>;
  }

  if (error !== null) {
    const message = isApiClientError(error) ? error.message : "Search failed";
    return <div className="search-panel"><span className="muted">{message}</span></div>;
  }

  if (results.length === 0) {
    return <div className="search-panel"><span className="muted">No results</span></div>;
  }

  return (
    <div className="search-panel">
      {results.map((result) => (
        <a key={`${result.type}:${result.id}`} className="search-result" href={result.path}>
          <Badge tone="neutral">{result.type}</Badge>
          <span>
            <strong>{result.title}</strong>
            <small>{result.subtitle}</small>
          </span>
        </a>
      ))}
    </div>
  );
}
