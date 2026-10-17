'use client';

import { useState } from 'react';

// Filters the directory rows by their data-search attribute and opens matches.
export default function SearchBox({ placeholder }) {
  const [q, setQ] = useState('');
  function onChange(e) {
    const value = e.target.value;
    setQ(value);
    const needle = value.trim().toLowerCase();
    const rows = document.querySelectorAll('[data-search]');
    let shown = 0;
    rows.forEach((el) => {
      const match = !needle || el.getAttribute('data-search').includes(needle);
      el.hidden = !match;
      if (match) shown += 1;
    });
    // Expand results when the search narrows things down to a few rows.
    rows.forEach((el) => {
      if (el.tagName === 'DETAILS') el.open = Boolean(needle) && !el.hidden && shown <= 3;
    });
    const empty = document.getElementById('no-results');
    if (empty) empty.hidden = shown > 0;
  }
  return (
    <div className="search-wrap">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        className="search"
        type="search"
        value={q}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}
