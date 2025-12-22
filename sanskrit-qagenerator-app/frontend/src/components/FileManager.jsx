import React, { useState, useEffect } from "react";

const FileManager = ({ 
  files, 
  onFileSelect, 
  onFileUpload, 
  onFileDelete, 
  selectedFileId,
  onBatchProcess 
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      await onFileUpload(file);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelection = (fileId, checked) => {
    if (checked) {
      setSelectedFiles([...selectedFiles, fileId]);
    } else {
      setSelectedFiles(selectedFiles.filter(id => id !== fileId));
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedFiles(files.map(f => f.file_id));
    } else {
      setSelectedFiles([]);
    }
  };

  const handleBatchProcess = () => {
    if (selectedFiles.length === 0) {
      alert("Please select at least one file to process");
      return;
    }
    onBatchProcess(selectedFiles);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800";
      case "processing": return "bg-blue-100 text-blue-800";
      case "error": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">CSV Files</h2>
        <div className="flex items-center gap-3">
          {selectedFiles.length > 0 && (
            <button
              onClick={handleBatchProcess}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5" />
              </svg>
              Process Selected ({selectedFiles.length})
            </button>
          )}
          <label className={`px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer ${isUploading ? 'opacity-50' : ''}`}>
            {isUploading ? "Uploading..." : "Upload CSV"}
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </label>
        </div>
      </div>

      {/* File List */}
      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <input
                  type="checkbox"
                  checked={selectedFiles.length === files.length && files.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Filename</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rows</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processed</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {files.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  No CSV files uploaded yet. Upload your first CSV to get started.
                </td>
              </tr>
            ) : (
              files.map((file) => (
                <tr 
                  key={file.file_id}
                  className={`hover:bg-gray-50 cursor-pointer ${selectedFileId === file.file_id ? 'bg-blue-50' : ''}`}
                  onClick={() => onFileSelect(file.file_id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file.file_id)}
                      onChange={(e) => handleFileSelection(file.file_id, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <div className="font-medium text-gray-900">{file.filename}</div>
                        <div className="text-sm text-gray-500">
                          Uploaded: {new Date(file.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {file.row_count.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full"
                          style={{ 
                            width: file.row_count > 0 
                              ? `${(file.processed_count / file.row_count) * 100}%` 
                              : '0%' 
                          }}
                        ></div>
                      </div>
                      <span className="ml-3 text-sm text-gray-600">
                        {file.processed_count}/{file.row_count}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(file.status)}`}>
                      {file.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFileDelete(file.file_id);
                      }}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Stats */}
      {files.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-500">Total Files</div>
            <div className="text-2xl font-bold text-gray-900">{files.length}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-500">Total Rows</div>
            <div className="text-2xl font-bold text-gray-900">
              {files.reduce((sum, file) => sum + file.row_count, 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-500">Processed Rows</div>
            <div className="text-2xl font-bold text-gray-900">
              {files.reduce((sum, file) => sum + file.processed_count, 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-500">Completed Files</div>
            <div className="text-2xl font-bold text-gray-900">
              {files.filter(f => f.status === 'completed').length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManager;