'use client';

import { useState } from 'react';

// Filters cards on the page by their data-search attribute.
export default function SearchBox({ placeholder }) {
  const [q, setQ] = useState('');
  function onChange(e) {
    const value = e.target.value;
    setQ(value);
    const needle = value.trim().toLowerCase();
    let shown = 0;
    document.querySelectorAll('[data-search]').forEach((el) => {
      const match = !needle || el.getAttribute('data-search').includes(needle);
      el.hidden = !match;
      if (match) shown += 1;
    });
    const empty = document.getElementById('no-results');
    if (empty) empty.hidden = shown > 0;
  }
  return (
    <input
      className="search"
      type="search"
      value={q}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={placeholder}
    />
  );
}
