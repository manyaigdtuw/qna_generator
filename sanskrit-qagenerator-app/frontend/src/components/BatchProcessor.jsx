import React, { useState, useEffect } from "react";
import { startBatchProcess, getProcessStatus } from "../api";

export default function BatchProcessor({ onComplete, rowCount }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processId, setProcessId] = useState(null);
  const [status, setStatus] = useState(null);
  const [qaCount, setQaCount] = useState(4);

  useEffect(() => {
    let interval;
    
    if (isProcessing && processId) {
      interval = setInterval(async () => {
        try {
          const statusData = await getProcessStatus(processId);
          setStatus(statusData);
          
          if (statusData.status === "completed" || statusData.status === "error") {
            setIsProcessing(false);
            clearInterval(interval);
            if (onComplete) onComplete();
          }
        } catch (error) {
          console.error("Error fetching status:", error);
        }
      }, 2000); // Poll every 2 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing, processId, onComplete]);

  const startProcessing = async () => {
    if (!rowCount || rowCount === 0) {
      alert("No rows to process. Please upload a CSV first.");
      return;
    }
    
    setIsProcessing(true);
    setStatus(null);
    
    try {
      const response = await startBatchProcess(qaCount);
      setProcessId(response.process_id);
    } catch (error) {
      console.error("Failed to start batch processing:", error);
      alert("Failed to start batch processing: " + error.message);
      setIsProcessing(false);
    }
  };

  const getProgressPercentage = () => {
    if (!status || status.total_rows === 0) return 0;
    return Math.round((status.current_row / status.total_rows) * 100);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4">Batch Process CSV</h3>
      
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">QA Count per Row:</label>
          <select 
            value={qaCount} 
            onChange={e => setQaCount(Number(e.target.value))} 
            className="border px-3 py-2 rounded"
            disabled={isProcessing}
          >
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
          </select>
          
          <button
            onClick={startProcessing}
            disabled={isProcessing || !rowCount}
            className={`px-4 py-2 rounded ${
              isProcessing || !rowCount
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isProcessing ? 'Processing...' : 'Start Batch Process'}
          </button>
        </div>

        {status && (
          <div className="mt-4 p-4 bg-blue-50 rounded border">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">Progress:</span>
              <span className="text-sm">
                {status.current_row} / {status.total_rows} rows
                ({getProgressPercentage()}%)
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getProgressPercentage()}%` }}
              ></div>
            </div>
            
            <div className="mt-3 text-sm">
              <div><strong>Status:</strong> {status.status}</div>
              {status.current_sanskrit && (
                <div><strong>Current Row:</strong> {status.current_sanskrit}</div>
              )}
              {status.error_message && (
                <div className="text-red-600"><strong>Error:</strong> {status.error_message}</div>
              )}
            </div>
            
            {status.status === "completed" && (
              <div className="mt-3 p-2 bg-green-100 text-green-800 rounded text-sm">
                ✅ Batch processing completed successfully!
              </div>
            )}
            
            {status.status === "error" && (
              <div className="mt-3 p-2 bg-red-100 text-red-800 rounded text-sm">
                ❌ Batch processing failed. Check console for details.
              </div>
            )}
          </div>
        )}

        {!rowCount && (
          <div className="p-3 bg-yellow-50 text-yellow-800 rounded text-sm">
            ⚠️ No data available. Please upload a CSV file first.
          </div>
        )}
      </div>
    </div>
  );
}