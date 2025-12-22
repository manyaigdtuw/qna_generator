import React, { useState, useEffect, useRef } from "react";
import { getAllRowsFromAllFiles, listFiles, uploadFile } from "../api";

export default function MultiFileSidebar({
  files = [], // Added default value
  onSelectRow,
  selectedRow,
  onUpload,
  onRefresh,
  onShowBatchProcessor,
  onExport,
  onQueryChange,
}) {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [expandedFiles, setExpandedFiles] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadRows();
  }, [files]); // Reload rows when files change

  useEffect(() => {
    const handler = setTimeout(() => {
      if (onQueryChange) onQueryChange(filter);
    }, 500);
    return () => clearTimeout(handler);
  }, [filter, onQueryChange]);

  async function loadRows() {
    if (files.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rowsData = await getAllRowsFromAllFiles();
      console.log("Loaded rows:", rowsData.length);
      setRows(rowsData);
      
      // Auto-expand files with rows
      const expanded = {};
      files.forEach(file => {
        expanded[file.file_id] = true;
      });
      setExpandedFiles(expanded);
    } catch (error) {
      console.error("Failed to load rows:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      await uploadFile(file);
      if (onRefresh) onRefresh();
      // Note: onRefresh should reload files, which will trigger loadRows
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed: " + error.message);
    }
  };

  const handleRefresh = () => {
    if (onRefresh) onRefresh();
  };

  const toggleFileExpansion = (fileId) => {
    setExpandedFiles(prev => ({
      ...prev,
      [fileId]: !prev[fileId]
    }));
  };

  const getFileProgress = (file) => {
    const fileRows = rows.filter(r => r.file_id === file.file_id);
    const processed = fileRows.filter(r => 
      r.q_en_1 || r.q_hi_1 || r.q_sa_1
    ).length;
    
    return {
      processed,
      total: file.row_count,
      percentage: file.row_count > 0 ? Math.round((processed / file.row_count) * 100) : 0
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800";
      case "processing": return "bg-blue-100 text-blue-800";
      case "error": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const filteredRows = rows.filter(row => {
    if (!filter) return true;
    const searchTerm = filter.toLowerCase();
    return (
      row.sanskrit.toLowerCase().includes(searchTerm) ||
      row.english.toLowerCase().includes(searchTerm) ||
      (row.tags && row.tags.toLowerCase().includes(searchTerm))
    );
  });

  // Group rows by file
  const rowsByFile = {};
  filteredRows.forEach(row => {
    if (!rowsByFile[row.file_id]) {
      rowsByFile[row.file_id] = {
        file: files.find(f => f.file_id === row.file_id),
        rows: []
      };
    }
    rowsByFile[row.file_id].rows.push(row);
  });

  return (
    <div className="w-full h-full bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-bold text-gray-900">Sanskrit Q&A</h1>
        <p className="text-sm text-gray-600">Multi-File Dataset Tool</p>
      </div>

      {/* Actions */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload CSV
          </button>
          <button
            className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium flex items-center justify-center gap-2"
            onClick={handleRefresh}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5" />
            </svg>
            Refresh
          </button>
        </div>
        
        <div className="mt-3">
          <button
            onClick={onShowBatchProcessor}
            className="w-full bg-green-600 text-white py-2 px-3 rounded-md hover:bg-green-700 flex items-center justify-center gap-2 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Batch Process Files
          </button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {/* File Stats */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-700">Files:</span>
            <span className="text-gray-600">{files.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-700">Total Rows:</span>
            <span className="text-gray-600">
              {rows.length.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-700">Processed:</span>
            <span className="text-gray-600">
              {rows.filter(r => r.q_en_1 || r.q_hi_1 || r.q_sa_1).length.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search across all files..."
            className="w-full border border-gray-300 rounded-md pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Files & Rows List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Loading rows...</p>
          </div>
        ) : Object.keys(rowsByFile).length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p className="font-semibold">No data found</p>
            <p className="text-sm mt-1">
              {files.length === 0 ? "Upload CSV files to get started" : "Adjust search or upload more files"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {Object.entries(rowsByFile).map(([fileId, { file, rows: fileRows }]) => {
              if (!file) return null;
              
              const progress = getFileProgress(file);
              const isExpanded = expandedFiles[fileId];
              
              return (
                <div key={fileId} className="border-b border-gray-200">
                  {/* File Header */}
                  <div 
                    className="p-3 bg-gray-50 hover:bg-gray-100 cursor-pointer border-b border-gray-200"
                    onClick={() => toggleFileExpansion(fileId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <svg 
                            className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {file.filename}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs">
                          <span className={`px-2 py-0.5 rounded-full ${getStatusColor(file.status)}`}>
                            {file.status}
                          </span>
                          <span className="text-gray-600">
                            {fileRows.length} rows
                          </span>
                        </div>
                      </div>
                      <div className="ml-2 flex-shrink-0">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${progress.percentage}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 text-right mt-1">
                          {progress.processed}/{progress.total}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* File Rows (collapsible) */}
                  {isExpanded && (
                    <div className="bg-white">
                      {fileRows.map((row) => {
                        const hasQAs = row.q_en_1 || row.q_hi_1 || row.q_sa_1;
                        const isSelected = selectedRow && 
                          selectedRow.file_id === row.file_id && 
                          selectedRow.id === row.id;
                        
                        return (
                          <div
                            key={`${row.file_id}-${row.id}`}
                            onClick={() => onSelectRow(row)}
                            className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${
                              isSelected ? 'bg-blue-100 border-l-4 border-blue-500' : ''
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {row.sanskrit || "No Sanskrit text"}
                                </p>
                                <p className="text-xs text-gray-600 mt-1 truncate">
                                  {row.english || "No English translation"}
                                </p>
                                {row.tags && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {row.tags.split(',').map(tag => (
                                      <span key={tag} className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                                        {tag.trim()}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {hasQAs && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  ✓
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-gray-500 flex items-center gap-2">
                              <span>Row {row.id}</span>
                              <span>•</span>
                              <span className="truncate">{file.filename}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="text-xs text-gray-500">
          <div className="flex justify-between">
            <span>Showing {filteredRows.length} rows</span>
            <span>{Object.keys(rowsByFile).length} files</span>
          </div>
        </div>
      </div>
    </div>
  );
}