import React, { useState, useEffect } from "react";

const MultiFileBatchProcessor = ({ 
  files, 
  onStartBatchProcess, 
  onGetStatus, 
  onSaveResults 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processId, setProcessId] = useState(null);
  const [status, setStatus] = useState(null);
  const [qaCount, setQaCount] = useState(4);
  const [selectedRows, setSelectedRows] = useState({});
  const [selectedFiles, setSelectedFiles] = useState([]);

  useEffect(() => {
    // Auto-select all files initially
    setSelectedFiles(files.map(f => f.file_id));
  }, [files]);

  useEffect(() => {
    let interval;
    if (isProcessing && processId) {
      interval = setInterval(async () => {
        try {
          const statusData = await onGetStatus(processId);
          setStatus(statusData);
          if (statusData.status === "completed" || statusData.status === "error") {
            setIsProcessing(false);
            clearInterval(interval);
          }
        } catch (error) {
          console.error("Error fetching status:", error);
        }
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing, processId, onGetStatus]);

  const startProcessing = async () => {
    if (selectedFiles.length === 0) {
      alert("Please select at least one file to process");
      return;
    }

    setIsProcessing(true);
    setStatus(null);
    try {
      const response = await onStartBatchProcess(selectedFiles, qaCount);
      setProcessId(response.process_id);
    } catch (error) {
      console.error("Failed to start batch processing:", error);
      alert("Failed to start batch processing: " + error.message);
      setIsProcessing(false);
    }
  };

  const handleSaveResults = async () => {
    // Filter selected rows by file
    const rowsToSave = {};
    
    Object.entries(selectedRows).forEach(([fileId, rowIndices]) => {
      if (status?.results[fileId]) {
        rowsToSave[fileId] = status.results[fileId].filter((row, idx) => 
          rowIndices.includes(idx)
        );
      }
    });

    try {
      await onSaveResults(processId, rowsToSave);
      alert("Saved selected rows to respective files.");
    } catch (error) {
      console.error("Failed to save batch results:", error);
      alert("Failed to save batch results: " + error.message);
    }
  };

  const handleFileSelection = (fileId, checked) => {
    if (checked) {
      setSelectedFiles([...selectedFiles, fileId]);
    } else {
      setSelectedFiles(selectedFiles.filter(id => id !== fileId));
      // Also clear selections for this file
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
    if (!status) return 0;
    
    const totalRows = Object.values(status.progress || {}).reduce(
      (sum, progress) => sum + (progress.total || 0), 0
    );
    const processedRows = Object.values(status.progress || {}).reduce(
      (sum, progress) => sum + (progress.processed || 0), 0
    );
    
    return totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 0;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-xl font-bold text-gray-800 mb-6">Multi-File Batch Processing</h3>

      {!status || status.status === "running" ? (
        <div className="space-y-6">
          {/* Configuration */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Questions per Row
                </label>
                <select
                  value={qaCount}
                  onChange={e => setQaCount(Number(e.target.value))}
                  className="border border-gray-300 rounded-md px-3 py-2"
                  disabled={isProcessing}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Files to Process
                </label>
                <div className="flex flex-wrap gap-2">
                  {files.map(file => (
                    <label key={file.file_id} className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.file_id)}
                        onChange={e => handleFileSelection(file.file_id, e.target.checked)}
                        disabled={isProcessing}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{file.filename}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={startProcessing}
                disabled={isProcessing || selectedFiles.length === 0}
                className={`px-6 py-2 rounded-md font-medium ${
                  isProcessing || selectedFiles.length === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isProcessing ? 'Processing...' : 'Start Processing'}
              </button>
            </div>
          </div>

          {/* Progress Display */}
          {status && (
            <div className="space-y-4">
              {/* Overall Progress */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-blue-800">Overall Progress</span>
                  <span className="text-sm text-blue-600">
                    {getOverallProgress()}% Complete
                  </span>
                </div>
                <div className="w-full bg-blue-100 rounded-full h-3">
                  <div 
                    className="bg-green-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${getOverallProgress()}%` }}
                  ></div>
                </div>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Current File:</span>
                    <div className="font-medium">{status.current_file}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Current Row:</span>
                    <div className="font-medium">{status.current_sanskrit}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Files:</span>
                    <div className="font-medium">
                      {status.processed_files}/{status.total_files}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <div className="font-medium capitalize">{status.status}</div>
                  </div>
                </div>
              </div>

              {/* Individual File Progress */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-700">File Progress</h4>
                {Object.entries(status.progress || {}).map(([fileId, progress]) => {
                  const file = files.find(f => f.file_id === fileId);
                  if (!file) return null;
                  
                  const fileProgress = progress.total > 0 
                    ? Math.round((progress.processed / progress.total) * 100) 
                    : 0;
                  
                  return (
                    <div key={fileId} className="bg-gray-50 p-3 rounded border">
                      <div className="flex justify-between items-center mb-2">
                        <div className="font-medium">{file.filename}</div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600">
                            {progress.processed}/{progress.total} rows
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            progress.status === 'completed' ? 'bg-green-100 text-green-800' :
                            progress.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            progress.status === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {progress.status}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            progress.status === 'completed' ? 'bg-green-600' :
                            progress.status === 'error' ? 'bg-red-600' :
                            'bg-blue-600'
                          }`}
                          style={{ width: `${fileProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {status.error_message && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="font-semibold text-red-800">Error Occurred</div>
                  <div className="text-sm text-red-600 mt-1">{status.error_message}</div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        // Results Review
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h4 className="text-lg font-semibold text-gray-800">Review Generated Q&A</h4>
            <button
              onClick={handleSaveResults}
              className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium"
            >
              Save Selected to Files
            </button>
          </div>

          {/* File Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-4">
              {Object.entries(status.results || {}).map(([fileId, rows]) => {
                const file = files.find(f => f.file_id === fileId);
                if (!file || rows.length === 0) return null;
                
                const selectedCount = selectedRows[fileId]?.length || 0;
                
                return (
                  <button
                    key={fileId}
                    className="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300"
                  >
                    {file.filename}
                    <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded-full">
                      {selectedCount}/{rows.length} selected
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Results List */}
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {Object.entries(status.results || {}).map(([fileId, rows]) => {
              const file = files.find(f => f.file_id === fileId);
              if (!file || rows.length === 0) return null;
              
              return (
                <div key={fileId} className="space-y-3">
                  <div className="font-semibold text-gray-700">{file.filename}</div>
                  {rows.map((row, rowIndex) => (
                    <div key={rowIndex} className="bg-gray-50 p-4 rounded-lg border">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={(selectedRows[fileId] || []).includes(rowIndex)}
                          onChange={() => handleRowSelection(fileId, rowIndex)}
                          className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{row.sanskrit}</div>
                          <div className="text-sm text-gray-600 mt-1">{row.english}</div>
                          
                          {/* Preview Q&A */}
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                            {['en', 'hi', 'sa'].map(lang => (
                              <div key={lang} className="bg-white p-3 rounded border">
                                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                                  {lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : 'Sanskrit'}
                                </div>
                                <div className="text-sm">
                                  <div className="font-medium">Q: {row[`q_${lang}`]?.[0] || ''}</div>
                                  <div className="mt-1 text-gray-600">A: {row[`a_${lang}`]?.[0] || ''}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiFileBatchProcessor;