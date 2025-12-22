import React, { useState, useEffect } from "react";
import MultiFileSidebar from "./components/MultiFileSidebar";
import DetailedBatchProcessor from "./components/DetailedBatchProcessor";
import ShlokaEditor from "./components/ShlokaEditor";
import { listFiles } from "./api";

export default function App() {
  const [selectedRow, setSelectedRow] = useState(null);
  const [showBatchProcessor, setShowBatchProcessor] = useState(false);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFiles();
  }, []);

  async function loadFiles() {
    try {
      const filesData = await listFiles();
      console.log("Loaded files:", filesData);
      setFiles(filesData);
    } catch (error) {
      console.error("Failed to load files:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleSelectRow = (row) => {
    console.log("Row selected:", row);
    setSelectedRow(row);
  };

  const handleShowBatchProcessor = () => {
    console.log("Opening batch processor with files:", files);
    setShowBatchProcessor(true);
  };

  const handleBatchComplete = () => {
    setShowBatchProcessor(false);
    loadFiles(); // Refresh files after batch processing
  };

  const handleBatchClose = () => {
    setShowBatchProcessor(false);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-96">
        <MultiFileSidebar
          files={files}
          onSelectRow={handleSelectRow}
          selectedRow={selectedRow}
          onRefresh={loadFiles}
          onShowBatchProcessor={handleShowBatchProcessor}
          onQueryChange={(query) => console.log("Search:", query)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto">
        {showBatchProcessor ? (
          <DetailedBatchProcessor
            files={files}
            onComplete={handleBatchComplete}
            onClose={handleBatchClose}
          />
        ) : selectedRow ? (
          <ShlokaEditor
            fileId={selectedRow.file_id}
            rowId={selectedRow.id}
            onSaved={loadFiles}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to Sanskrit Q&A Generator</h3>
              <p className="text-gray-600">Select a row from the sidebar to start editing,</p>
              <p className="text-gray-600">or use Batch Processing to generate Q&As for multiple files.</p>
              <button
                onClick={handleShowBatchProcessor}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Go to Batch Processing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}