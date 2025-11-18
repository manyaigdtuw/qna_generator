import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import ShlokaEditor from "./components/ShlokaEditor";
import BatchProcessor from "./components/BatchProcessor"; // Add this import
import { listRows, uploadCSV, downloadCSV } from "./api";

export default function App() {
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [showBatchProcessor, setShowBatchProcessor] = useState(false); // Add this state

  useEffect(() => {
    fetchRows();
  }, []);

  async function fetchRows() {
    const data = await listRows(0, 100, query);
    setRows(data);
    if (data.length > 0 && selectedId === null) setSelectedId(data[0].id);
  }

  function handleSelect(id) {
    setSelectedId(id);
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    await uploadCSV(file);
    await fetchRows();
  }

  async function handleDownload() {
    const blob = await downloadCSV();
    const url = window.URL.createObjectURL(new Blob([blob]));
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const handleBatchComplete = () => {
    // Refresh the data when batch processing completes
    fetchRows();
  };

  return (
    <div className="h-screen flex">
      <Sidebar
        rows={rows}
        onSelect={handleSelect}
        selectedId={selectedId}
        onUpload={handleUpload}
        onRefresh={fetchRows}
        onDownload={handleDownload}
        onShowBatchProcessor={() => setShowBatchProcessor(true)} // Add this prop
      />
      <div className="flex-1 p-6 overflow-auto">
        {showBatchProcessor ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Batch CSV Processing</h2>
              <button
                onClick={() => setShowBatchProcessor(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                ← Back to Editor
              </button>
            </div>
            <BatchProcessor 
              onComplete={handleBatchComplete}
              rowCount={rows.length}
            />
          </div>
        ) : selectedId !== null ? (
          <ShlokaEditor id={selectedId} key={selectedId} onSaved={fetchRows} />
        ) : (
          <div className="text-gray-600">No row selected</div>
        )}
      </div>
    </div>
  );
}