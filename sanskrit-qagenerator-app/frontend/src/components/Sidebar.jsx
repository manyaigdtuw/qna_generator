import React from "react";

export default function Sidebar({ rows, onSelect, selectedId, onUpload, onRefresh, onDownload, onShowBatchProcessor }) {
  return (
    <div className="w-96 bg-white border-r">
      <div className="p-4 flex items-center justify-between border-b">
        <h2 className="text-lg font-semibold">Shlokas</h2>
        <div className="flex items-center gap-2">
          <label className="bg-sky-600 text-white px-3 py-1 rounded cursor-pointer">
            Upload
            <input type="file" accept=".csv" className="hidden" onChange={onUpload} />
          </label>
          <button className="px-3 py-1 border rounded" onClick={onRefresh}>Refresh</button>
          <button className="px-3 py-1 border rounded" onClick={onDownload}>Download</button>
        </div>
      </div>

      {/* Add Batch Process Button */}
      <div className="p-3 border-b bg-blue-50">
        <button
          onClick={onShowBatchProcessor}
          className="w-full bg-green-600 text-white py-2 px-3 rounded hover:bg-green-700 flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Auto Process All Rows
        </button>
        <div className="text-xs text-gray-600 mt-1 text-center">
          Automatically generate Q&A for all rows
        </div>
      </div>

      <div className="p-3 overflow-y-auto" style={{height: 'calc(100vh - 140px)'}}>
        {rows.length === 0 && <div className="text-sm text-gray-500">No rows. Upload CSV.</div>}
        {rows.map(r => (
          <div key={r.id}
               onClick={() => onSelect(r.id)}
               className={`p-3 mb-2 rounded cursor-pointer ${selectedId===r.id ? 'bg-sky-50 border-l-4 border-sky-500' : 'hover:bg-slate-50'}`}>
            <div className="text-sm text-gray-800 leading-snug" style={{lineHeight:1.2}}>{r.sanskrit}</div>
            <div className="text-xs text-gray-500 mt-1">{r.english}</div>
          </div>
        ))}
      </div>
    </div>
  );
}