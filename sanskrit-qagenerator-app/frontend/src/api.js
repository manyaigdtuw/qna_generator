// frontend/src/api.js
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// File Management
export async function listFiles() {
  const r = await axios.get(`${API_BASE}/files`);
  return r.data;
}

export async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await axios.post(`${API_BASE}/files/upload`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data;
}

export async function deleteFile(fileId) {
  const r = await axios.delete(`${API_BASE}/files/${fileId}`);
  return r.data;
}

// File Operations
export async function listFileRows(fileId, skip = 0, limit = 200, q = "") {
  const r = await axios.get(`${API_BASE}/files/${fileId}/rows`, { 
    params: { skip, limit, q } 
  });
  return r.data;
}

export async function getFileRow(fileId, rowId) {
  const r = await axios.get(`${API_BASE}/files/${fileId}/row/${rowId}`);
  return r.data;
}

export async function generateFileRow(fileId, rowId, qa_count = 4) {
  const r = await axios.post(`${API_BASE}/files/${fileId}/generate/${rowId}`, { qa_count });
  return r.data;
}

export async function saveFileRow(fileId, rowId, payload) {
  const r = await axios.post(`${API_BASE}/files/${fileId}/save/${rowId}`, payload);
  return r.data;
}

export async function downloadFile(fileId) {
  const r = await axios.get(`${API_BASE}/files/${fileId}/download`, { 
    responseType: "blob" 
  });
  return r.data;
}

// Batch Processing
export async function startBatchProcess(fileIds, qa_count = 4) {
  const r = await axios.post(`${API_BASE}/process/batch`, { 
    file_ids: fileIds, 
    qa_count 
  });
  return r.data;
}

export async function getBatchProcessStatus(processId) {
  const r = await axios.get(`${API_BASE}/process/status/${processId}`);
  return r.data;
}

// Update the saveBatchResults function in api.js
export async function saveBatchResults(processId, results) {
  console.log("Saving batch results for process:", processId);
  console.log("Results to save:", results);
  
  // Format 1: Using the new endpoint structure
  try {
    const payload = {
      process_id: processId,
      rows: Object.values(results).flat()
    };
    
    console.log("Sending payload:", payload);
    const r = await axios.post(`${API_BASE}/process/save`, payload);
    console.log("Save response:", r.data);
    return r.data;
  } catch (error) {
    console.error("Error saving batch results:", error);
    
    // Fallback: Try the old endpoint format
    try {
      console.log("Trying alternative save method...");
      const r = await axios.post(`${API_BASE}/process/save/${processId}`, results);
      return r.data;
    } catch (fallbackError) {
      console.error("Fallback save also failed:", fallbackError);
      throw error; // Throw the original error
    }
  }
}

// Add this helper function for better error handling
export async function saveBatchResultsByFile(processId, resultsByFile) {
  console.log("Saving results by file:", resultsByFile);
  
  // Convert resultsByFile to the format the backend expects
  const allRows = [];
  Object.entries(resultsByFile).forEach(([fileId, rows]) => {
    rows.forEach(row => {
      allRows.push({
        ...row,
        file_id: fileId
      });
    });
  });
  
  return saveBatchResults(processId, allRows);
}

// Headers Management - This is the missing export
export async function ensureHeaders(fileId, count) {
  const r = await axios.post(`${API_BASE}/files/${fileId}/ensure_headers/${count}`);
  return r.data;
}

// Get all data from a file
export async function getAllFileData(fileId) {
  const r = await axios.get(`${API_BASE}/files/${fileId}/data`);
  return r.data;
}

// Legacy support (for backward compatibility)
export async function uploadCSV(file) {
  return uploadFile(file);
}

export async function listRows(skip = 0, limit = 200, q = "") {
  // For backward compatibility, use first file
  const files = await listFiles();
  if (files.length === 0) {
    return [];
  }
  return listFileRows(files[0].file_id, skip, limit, q);
}

export async function getRow(id) {
  const files = await listFiles();
  if (files.length === 0) {
    throw new Error("No files available");
  }
  return getFileRow(files[0].file_id, id);
}

export async function generateRow(id, qa_count = 4) {
  const files = await listFiles();
  if (files.length === 0) {
    throw new Error("No files available");
  }
  return generateFileRow(files[0].file_id, id, qa_count);
}

export async function saveRow(id, payload) {
  const files = await listFiles();
  if (files.length === 0) {
    throw new Error("No files available");
  }
  return saveFileRow(files[0].file_id, id, payload);
}

export async function downloadCSV() {
  const files = await listFiles();
  if (files.length === 0) {
    throw new Error("No files available");
  }
  return downloadFile(files[0].file_id);
}

export async function getAllData() {
  const files = await listFiles();
  if (files.length === 0) {
    return [];
  }
  return getAllFileData(files[0].file_id);
}

// Legacy ensureHeaders - for backward compatibility
export async function ensureHeadersLegacy(count) {
  const files = await listFiles();
  if (files.length === 0) {
    throw new Error("No files available");
  }
  return ensureHeaders(files[0].file_id, count);
}

// Add these to api.js

// Detailed batch processing
export async function startDetailedBatchProcess(fileIds, qa_count = 4) {
  const r = await axios.post(`${API_BASE}/process/batch/detailed`, { 
    file_ids: fileIds, 
    qa_count 
  });
  return r.data;
}

export async function getDetailedProcessStatus(processId) {
  const r = await axios.get(`${API_BASE}/process/detailed/status/${processId}`);
  return r.data;
}


export async function getAllRowsFromAllFiles() {
  try {
    const files = await listFiles();
    console.log("Getting rows from files:", files.length);
    
    const allRows = [];
    
    for (const file of files) {
      try {
        const rows = await listFileRows(file.file_id, 0, 1000, "");
        console.log(`Got ${rows.length} rows from ${file.filename}`);
        
        const rowsWithFileInfo = rows.map(row => ({
          ...row,
          file_id: file.file_id,
          filename: file.filename,
          file_status: file.status,
          file_processed: file.processed_count,
          file_total: file.row_count
        }));
        
        allRows.push(...rowsWithFileInfo);
      } catch (error) {
        console.error(`Failed to get rows from ${file.filename}:`, error);
      }
    }
    
    console.log("Total rows loaded:", allRows.length);
    return allRows;
  } catch (error) {
    console.error("Error in getAllRowsFromAllFiles:", error);
    throw error;
  }
}