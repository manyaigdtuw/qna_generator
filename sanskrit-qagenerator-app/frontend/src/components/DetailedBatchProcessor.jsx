import React, { useState, useEffect } from "react";
import { startDetailedBatchProcess, getDetailedProcessStatus, saveBatchResults } from "../api";

export default function DetailedBatchProcessor({ 
  files = [],
  onComplete,
  onClose 
}) {
  console.log("DetailedBatchProcessor mounted with files:", files);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processId, setProcessId] = useState(null);
  const [status, setStatus] = useState(null);
  const [qaCount, setQaCount] = useState(4);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedRows, setSelectedRows] = useState({});
  const [activeFileTab, setActiveFileTab] = useState(null);

  // Initialize selected files
  useEffect(() => {
    console.log("Initializing selected files from:", files);
    if (files && files.length > 0) {
      const fileIds = files.map(f => f.file_id);
      setSelectedFiles(fileIds);
      console.log("Auto-selected files:", fileIds);
    }
  }, [files]);

  // Poll for status
  useEffect(() => {
    let interval;
    if (isProcessing && processId) {
      console.log("Starting status polling for process:", processId);
      interval = setInterval(async () => {
        try {
          console.log("Polling status for:", processId);
          const statusData = await getDetailedProcessStatus(processId);
          console.log("Status update received:", statusData);
          setStatus(statusData);
          
          if (statusData.status === "completed" || statusData.status === "error") {
            console.log("Processing finished with status:", statusData.status);
            setIsProcessing(false);
            clearInterval(interval);
            
            // Auto-select first file with results
            const filesWithResults = Object.keys(statusData.results || {});
            if (filesWithResults.length > 0) {
              setActiveFileTab(filesWithResults[0]);
              console.log("Auto-selected tab:", filesWithResults[0]);
            }
          }
        } catch (error) {
          console.error("Error fetching status:", error);
        }
      }, 2000); // Poll every 2 seconds
    }
    return () => {
      if (interval) {
        console.log("Clearing interval");
        clearInterval(interval);
      }
    };
  }, [isProcessing, processId]);

  const startProcessing = async () => {
    console.log("Starting processing with selected files:", selectedFiles);
    console.log("QA count:", qaCount);
    
    if (selectedFiles.length === 0) {
      alert("Please select at least one file to process");
      return;
    }

    setIsProcessing(true);
    setStatus(null);
    setSelectedRows({});
    
    try {
      console.log("Calling startDetailedBatchProcess API...");
      const response = await startDetailedBatchProcess(selectedFiles, qaCount);
      console.log("Batch process started successfully:", response);
      setProcessId(response.process_id);
    } catch (error) {
      console.error("Failed to start batch processing:", error);
      alert("Failed to start batch processing: " + (error.message || "Unknown error"));
      setIsProcessing(false);
    }
  };

  const handleSaveResults = async () => {
  // Collect all selected rows
  const allSelectedRows = [];
  
  Object.entries(selectedRows).forEach(([fileId, rowIndices]) => {
    if (status?.results?.[fileId]) {
      const selectedRowsForFile = status.results[fileId].filter((row, idx) => 
        rowIndices.includes(idx)
      );
      allSelectedRows.push(...selectedRowsForFile);
    }
  });

  console.log("Selected rows to save:", allSelectedRows);

  if (allSelectedRows.length === 0) {
    alert("Please select at least one row to save");
    return;
  }

  try {
    // Use the simplified save function
    const result = await saveBatchResults(processId, allSelectedRows);
    console.log("Save result:", result);
    
    if (result.saved > 0) {
      alert(`Successfully saved ${result.saved} rows. ${result.errors || 0} errors occurred.`);
      if (onComplete) onComplete();
    } else {
      alert("No rows were saved. Please check the console for errors.");
    }
  } catch (error) {
    console.error("Failed to save batch results:", error);
    alert("Failed to save batch results: " + error.message);
  }
};

  const handleFileSelection = (fileId, checked) => {
    console.log("File selection changed:", fileId, checked);
    if (checked) {
      setSelectedFiles([...selectedFiles, fileId]);
    } else {
      setSelectedFiles(selectedFiles.filter(id => id !== fileId));
      const newSelectedRows = { ...selectedRows };
      delete newSelectedRows[fileId];
      setSelectedRows(newSelectedRows);
    }
  };

  const handleRowSelection = (fileId, rowIndex) => {
    setSelectedRows(prev => {
      const fileSelections = prev[fileId] || [];
      const newSelections = fileSelections.includes(rowIndex)
        ? fileSelections.filter(idx => idx !== rowIndex)
        : [...fileSelections, rowIndex];
      
      return {
        ...prev,
        [fileId]: newSelections
      };
    });
  };

  const getOverallProgress = () => {
    if (!status || status.total_rows === 0) return 0;
    return Math.round((status.processed_rows / status.total_rows) * 100);
  };

  const getTimeElapsed = () => {
    if (!status?.start_time) return "0s";
    const start = new Date(status.start_time);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000);
    
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  const calculateEstimatedTime = () => {
    if (!status || status.processed_rows === 0 || !status.start_time) return "";
    
    const elapsed = (new Date() - new Date(status.start_time)) / 1000;
    const rowsPerSecond = status.processed_rows / elapsed;
    const remainingRows = status.total_rows - status.processed_rows;
    const remainingSeconds = remainingRows / rowsPerSecond;
    
    if (remainingSeconds < 60) return `${Math.round(remainingSeconds)}s`;
    if (remainingSeconds < 3600) return `${Math.round(remainingSeconds / 60)}m`;
    return `${Math.round(remainingSeconds / 3600)}h`;
  };

  // If no files, show message
  if (files.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-gray-600 mb-4">No files available for processing.</div>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 max-w-6xl mx-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Batch Processing Dashboard</h2>
            <p className="text-sm text-gray-600">Process multiple CSV files simultaneously</p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md"
          >
            ✕ Close
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Processing Controls */}
        {!status || status.status === "initializing" || status.status === "running" ? (
          <div className="space-y-6">
            {/* Configuration Panel */}
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">Configuration</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Questions per Row
                  </label>
                  <select
                    value={qaCount}
                    onChange={e => setQaCount(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isProcessing}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                      <option key={num} value={num}>{num} questions</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Files ({selectedFiles.length}/{files.length} selected)
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-3 bg-white">
                    {files.map(file => (
                      <label key={file.file_id} className="flex items-center p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(file.file_id)}
                          onChange={e => handleFileSelection(file.file_id, e.target.checked)}
                          disabled={isProcessing}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="ml-3 flex-1">
                          <div className="text-sm font-medium text-gray-900">{file.filename}</div>
                          <div className="text-xs text-gray-500">
                            {file.row_count} rows • {file.processed_count} processed
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  onClick={startProcessing}
                  disabled={isProcessing || selectedFiles.length === 0}
                  className={`px-8 py-3 rounded-md font-semibold text-lg ${
                    isProcessing || selectedFiles.length === 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all'
                  }`}
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing Started...
                    </span>
                  ) : (
                    `Start Processing ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`
                  )}
                </button>
              </div>
            </div>

            {/* Progress Display */}
            {status && (
              <div className="space-y-6">
                {/* Overall Progress Card */}
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">Processing Status</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {status.current_operation || "Processing files..."}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">{getOverallProgress()}%</div>
                      <div className="text-sm text-gray-500">Complete</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-4 rounded-full transition-all duration-500"
                      style={{ width: `${getOverallProgress()}%` }}
                    ></div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-500">Files</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {status.processed_files}/{status.total_files}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-500">Rows</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {status.processed_rows.toLocaleString()}/{status.total_rows.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-500">Time Elapsed</div>
                      <div className="text-2xl font-bold text-gray-900">{getTimeElapsed()}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-500">Estimated Remaining</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {calculateEstimatedTime() || "Calculating..."}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Individual File Progress */}
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">File Progress Details</h3>
                  <div className="space-y-4">
                    {Object.entries(status.file_progress || {}).map(([fileId, progress]) => {
                      const file = files.find(f => f.file_id === fileId);
                      if (!file) return null;
                      
                      const fileProgress = progress.total_rows > 0 
                        ? Math.round((progress.current_row / progress.total_rows) * 100) 
                        : 0;
                      
                      return (
                        <div key={fileId} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${
                                  progress.status === 'completed' ? 'bg-green-500' :
                                  progress.status === 'processing' ? 'bg-blue-500 animate-pulse' :
                                  progress.status === 'error' ? 'bg-red-500' :
                                  'bg-gray-400'
                                }`}></div>
                                <div>
                                  <div className="font-medium text-gray-900">{file.filename}</div>
                                  <div className="text-sm text-gray-600">
                                    Status: <span className="font-medium capitalize">{progress.status}</span>
                                    {progress.status === 'processing' && progress.current_sanskrit && (
                                      <span className="ml-2">• Processing: "{progress.current_sanskrit}"</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-gray-900">{fileProgress}%</div>
                              <div className="text-sm text-gray-500">
                                {progress.current_row}/{progress.total_rows} rows
                              </div>
                            </div>
                          </div>
                          
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                progress.status === 'completed' ? 'bg-green-500' :
                                progress.status === 'error' ? 'bg-red-500' :
                                'bg-blue-500'
                              }`}
                              style={{ width: `${fileProgress}%` }}
                            ></div>
                          </div>
                          
                          {progress.error_message && (
                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                              <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm text-red-700 font-medium">Error:</span>
                              </div>
                              <p className="text-sm text-red-600 mt-1 ml-7">{progress.error_message}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Results Review */
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Processing Complete!</h3>
                <p className="text-gray-600">
                  Generated {Object.values(status.results || {}).flat().length} Q&A pairs across {status.processed_files} files
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveResults}
                  className="px-6 py-3 rounded-md bg-green-600 hover:bg-green-700 text-white font-semibold shadow-md hover:shadow-lg"
                >
                  Save Selected Q&As
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 rounded-md border border-gray-300 hover:bg-gray-50 font-semibold"
                >
                  Return to Editor
                </button>
              </div>
            </div>

            {/* File Tabs */}
            {Object.keys(status.results || {}).length > 0 && (
              <>
                <div className="border-b border-gray-200">
                  <nav className="flex space-x-1 overflow-x-auto">
                    {Object.entries(status.results || {}).map(([fileId, rows]) => {
                      const file = files.find(f => f.file_id === fileId);
                      if (!file || rows.length === 0) return null;
                      
                      const selectedCount = selectedRows[fileId]?.length || 0;
                      const isActive = activeFileTab === fileId;
                      
                      return (
                        <button
                          key={fileId}
                          onClick={() => setActiveFileTab(fileId)}
                          className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                            isActive 
                              ? 'border-blue-500 text-blue-600 bg-blue-50' 
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {file.filename}
                          <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                            isActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {selectedCount}/{rows.length} selected
                          </span>
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Results Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Results List */}
                  <div className="lg:col-span-2">
                    <div className="space-y-4 max-h-[600px] overflow-y-auto p-2">
                      {activeFileTab && status.results[activeFileTab]?.map((row, rowIndex) => {
                        const file = files.find(f => f.file_id === activeFileTab);
                        const isSelected = selectedRows[activeFileTab]?.includes(rowIndex) || false;
                        
                        return (
                          <div 
                            key={rowIndex}
                            className={`p-4 rounded-lg border ${
                              isSelected 
                                ? 'border-blue-300 bg-blue-50' 
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleRowSelection(activeFileTab, rowIndex)}
                                className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="flex-1">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-semibold text-gray-900">{row.sanskrit}</div>
                                    <div className="text-sm text-gray-600 mt-1">{row.english}</div>
                                  </div>
                                  <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    Row {row.id}
                                  </div>
                                </div>
                                
                                {/* Q&A Preview */}
                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  {['en', 'hi', 'sa'].map(lang => (
                                    <div key={lang} className="bg-white p-3 rounded border border-gray-200">
                                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                                        {lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : 'Sanskrit'}
                                      </div>
                                      <div className="space-y-2">
                                        <div className="text-sm">
                                          <div className="font-medium">Q:</div>
                                          <div className="text-gray-700 mt-1">{row[`q_${lang}`]?.[0] || ''}</div>
                                        </div>
                                        <div className="text-sm">
                                          <div className="font-medium">A:</div>
                                          <div className="text-gray-700 mt-1">{row[`a_${lang}`]?.[0] || ''}</div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary Panel */}
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 h-fit">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Summary</h4>
                    
                    <div className="space-y-4">
                      {Object.entries(status.results || {}).map(([fileId, rows]) => {
                        const file = files.find(f => f.file_id === fileId);
                        if (!file) return null;
                        
                        const selectedCount = selectedRows[fileId]?.length || 0;
                        
                        return (
                          <div key={fileId} className="p-3 bg-white rounded border border-gray-200">
                            <div className="font-medium text-gray-900">{file.filename}</div>
                            <div className="text-sm text-gray-600 mt-1">
                              {rows.length} rows generated • {selectedCount} selected
                            </div>
                            <div className="mt-2">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-green-500 h-2 rounded-full"
                                  style={{ 
                                    width: rows.length > 0 
                                      ? `${(selectedCount / rows.length) * 100}%` 
                                      : '0%' 
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="font-semibold text-blue-800 mb-2">Total Selection</div>
                      <div className="text-3xl font-bold text-blue-600">
                        {Object.values(selectedRows).flat().length}
                      </div>
                      <div className="text-sm text-blue-700">
                        Q&A pairs selected for saving
                      </div>
                    </div>

                    <button
                      onClick={handleSaveResults}
                      disabled={Object.values(selectedRows).flat().length === 0}
                      className={`w-full mt-6 py-3 rounded-md font-semibold ${
                        Object.values(selectedRows).flat().length === 0
                          ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                          : 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg'
                      }`}
                    >
                      Save {Object.values(selectedRows).flat().length} Selected Items
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}