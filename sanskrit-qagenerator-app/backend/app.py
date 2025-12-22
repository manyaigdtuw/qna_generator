# backend/app.py
import os
import shutil
import logging
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
import pandas as pd
from typing import List, Dict, Any, Optional
import asyncio
import uuid
import json
from datetime import datetime
from pathlib import Path

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

from generate_api import generate_for_row
from storage import CSVStorage

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sanskrit-qagenerator")

CSV_FOLDER = os.getenv("CSV_FOLDER", "./data")
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-oss:120b")

app = FastAPI(title="Sanskrit QnA Generator (Multi-file)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class FileInfo(BaseModel):
    file_id: str
    filename: str
    created_at: str
    row_count: int
    processed_count: int = 0
    status: str = "pending"  # pending, processing, completed, error

class RowSummary(BaseModel):
    id: int
    sanskrit: str
    english: str
    file_id: str
    tags: str = ""

class GenerateRequest(BaseModel):
    qa_count: int = 4

class BatchProcessRequest(BaseModel):
    file_ids: List[str] = []
    qa_count: int = 4

class ProcessStatus(BaseModel):
    process_id: str
    status: str  # running, completed, error
    current_file: str
    current_row: int
    total_rows: int
    total_files: int
    processed_files: int
    current_sanskrit: str
    error_message: str = ""
    results: Dict[str, List[Dict[str, Any]]] = {}  # file_id -> rows
    progress: Dict[str, Dict[str, Any]] = {}  # file_id -> {processed, total, status}

# Global state
file_registry: Dict[str, FileInfo] = {}
process_statuses: Dict[str, ProcessStatus] = {}

def get_file_path(file_id: str) -> str:
    """Get the full path for a file_id"""
    return os.path.join(CSV_FOLDER, f"{file_id}.csv")

def get_metadata_path(file_id: str) -> str:
    """Get the metadata file path"""
    return os.path.join(CSV_FOLDER, f"{file_id}.json")

def save_file_metadata(file_id: str, metadata: Dict[str, Any]):
    """Save file metadata to JSON"""
    with open(get_metadata_path(file_id), 'w') as f:
        json.dump(metadata, f, indent=2)

def load_file_metadata(file_id: str) -> Dict[str, Any]:
    """Load file metadata from JSON"""
    try:
        with open(get_metadata_path(file_id), 'r') as f:
            return json.load(f)
    except:
        return {}

@app.on_event("startup")
def startup():
    """Initialize data directory and load existing files"""
    os.makedirs(CSV_FOLDER, exist_ok=True)
    
    # Scan for existing files
    for file_path in Path(CSV_FOLDER).glob("*.csv"):
        file_id = file_path.stem
        if file_id == "data":  # Skip old single-file format
            continue
            
        metadata_path = get_metadata_path(file_id)
        if os.path.exists(metadata_path):
            metadata = load_file_metadata(file_id)
        else:
            # Create metadata for existing files
            storage = CSVStorage(str(file_path))
            metadata = {
                "filename": file_path.name,
                "created_at": datetime.fromtimestamp(file_path.stat().st_ctime).isoformat(),
                "row_count": storage.row_count(),
                "processed_count": 0,
                "status": "pending"
            }
            save_file_metadata(file_id, metadata)
        
        file_registry[file_id] = FileInfo(
            file_id=file_id,
            filename=metadata["filename"],
            created_at=metadata["created_at"],
            row_count=metadata["row_count"],
            processed_count=metadata.get("processed_count", 0),
            status=metadata.get("status", "pending")
        )
    
    logger.info(f"Loaded {len(file_registry)} files on startup")

@app.get("/files", response_model=List[FileInfo])
def list_files():
    """List all uploaded CSV files"""
    return list(file_registry.values())

@app.post("/files/upload")
async def upload_csv(file: UploadFile = File(...)):
    """Upload a new CSV file"""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")
    
    file_id = str(uuid.uuid4())
    file_path = get_file_path(file_id)
    
    # Save the file
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    # Create storage instance to get row count
    storage = CSVStorage(file_path)
    
    # Create metadata
    metadata = {
        "filename": file.filename,
        "created_at": datetime.now().isoformat(),
        "row_count": storage.row_count(),
        "processed_count": 0,
        "status": "pending"
    }
    save_file_metadata(file_id, metadata)
    
    # Register file
    file_info = FileInfo(
        file_id=file_id,
        filename=file.filename,
        created_at=metadata["created_at"],
        row_count=metadata["row_count"],
        processed_count=0,
        status="pending"
    )
    file_registry[file_id] = file_info
    
    return file_info

@app.delete("/files/{file_id}")
def delete_file(file_id: str):
    """Delete a CSV file"""
    if file_id not in file_registry:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Remove files
    file_path = get_file_path(file_id)
    metadata_path = get_metadata_path(file_id)
    
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
        if os.path.exists(metadata_path):
            os.remove(metadata_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete: {str(e)}")
    
    # Remove from registry
    del file_registry[file_id]
    
    return {"status": "ok", "message": "File deleted"}

@app.get("/files/{file_id}/rows", response_model=List[RowSummary])
def list_file_rows(file_id: str, skip: int = 0, limit: int = 100, q: str = ""):
    """List rows from a specific file"""
    if file_id not in file_registry:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = get_file_path(file_id)
    storage = CSVStorage(file_path)
    
    rows = storage.list_rows(skip=skip, limit=limit, q=q)
    # Add file_id to each row
    for row in rows:
        row['file_id'] = file_id
    
    return rows

@app.get("/files/{file_id}/row/{idx}")
def get_file_row(file_id: str, idx: int):
    """Get a specific row from a file"""
    if file_id not in file_registry:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = get_file_path(file_id)
    storage = CSVStorage(file_path)
    
    r = storage.get_row(idx)
    if r is None:
        raise HTTPException(status_code=404, detail="Row not found")
    
    r['file_id'] = file_id
    return r

@app.post("/files/{file_id}/generate/{idx}")
def generate_row(file_id: str, idx: int, req: GenerateRequest):
    """Generate Q&A for a specific row in a file"""
    if file_id not in file_registry:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = get_file_path(file_id)
    storage = CSVStorage(file_path)
    
    row = storage.get_row(idx)
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    
    sanskrit = row.get("sanskrit", "")
    english = row.get("english", "")
    
    try:
        out = generate_for_row(sanskrit, english, model=MODEL_NAME, n=req.qa_count)
    except Exception as e:
        logger.exception("Generation failed")
        raise HTTPException(status_code=500, detail=str(e))
    
    return out

@app.post("/files/{file_id}/save/{idx}")
def save_file_row(file_id: str, idx: int, payload: Dict[str, Any]):
    """Save Q&A to a specific row in a file"""
    if file_id not in file_registry:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = get_file_path(file_id)
    storage = CSVStorage(file_path)
    
    ok = storage.update_row_with_qas(idx, payload)
    if not ok:
        raise HTTPException(status_code=400, detail="Failed to save")
    
    # Update processed count in metadata
    metadata = load_file_metadata(file_id)
    storage = CSVStorage(file_path)
    processed_count = sum(1 for i in range(storage.row_count()) 
                         if storage.has_existing_qa_data(i))
    metadata["processed_count"] = processed_count
    save_file_metadata(file_id, metadata)
    file_registry[file_id].processed_count = processed_count
    
    return {"status": "ok"}

@app.post("/process/batch")
async def start_batch_process(req: BatchProcessRequest, background_tasks: BackgroundTasks):
    """Start batch processing for multiple files"""
    process_id = str(uuid.uuid4())
    
    # Validate file_ids
    valid_file_ids = []
    for file_id in req.file_ids:
        if file_id in file_registry:
            valid_file_ids.append(file_id)
        else:
            logger.warning(f"File {file_id} not found, skipping")
    
    if not valid_file_ids:
        raise HTTPException(status_code=400, detail="No valid files to process")
    
    # Initialize status
    process_statuses[process_id] = ProcessStatus(
        process_id=process_id,
        status="running",
        current_file="",
        current_row=0,
        total_rows=0,
        total_files=len(valid_file_ids),
        processed_files=0,
        current_sanskrit="",
        results={file_id: [] for file_id in valid_file_ids},
        progress={file_id: {
            "processed": 0,
            "total": file_registry[file_id].row_count,
            "status": "pending"
        } for file_id in valid_file_ids}
    )
    
    # Start background task
    background_tasks.add_task(process_files_batch, process_id, valid_file_ids, req.qa_count)
    
    return {"process_id": process_id, "status": "started", "file_count": len(valid_file_ids)}

@app.get("/process/status/{process_id}")
def get_batch_process_status(process_id: str):
    """Get current status of batch processing"""
    status = process_statuses.get(process_id)
    if not status:
        raise HTTPException(status_code=404, detail="Process not found")
    return status

@app.post("/process/save/{process_id}")
def save_batch_results(process_id: str, payload: Dict[str, List[Dict[str, Any]]]):
    """Save selected results from batch processing"""
    status = process_statuses.get(process_id)
    if not status:
        raise HTTPException(status_code=404, detail="Process not found")
    
    for file_id, rows in payload.items():
        if file_id not in file_registry:
            continue
            
        file_path = get_file_path(file_id)
        storage = CSVStorage(file_path)
        
        for row_data in rows:
            idx = row_data.get("id")
            if idx is not None:
                storage.update_row_with_qas(idx, row_data)
    
    return {"status": "ok", "saved_files": list(payload.keys())}

@app.get("/files/{file_id}/download")
def download_file(file_id: str):
    """Download a specific CSV file"""
    if file_id not in file_registry:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = get_file_path(file_id)
    filename = file_registry[file_id].filename
    
    return FileResponse(
        file_path,
        media_type="text/csv; charset=utf-8-sig",
        filename=filename
    )

@app.post("/files/{file_id}/ensure_headers/{count}")
def ensure_file_headers(file_id: str, count: int):
    """Ensure CSV has headers for the specified Q&A count"""
    if file_id not in file_registry:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = get_file_path(file_id)
    storage = CSVStorage(file_path)
    storage.ensure_headers(count)
    
    return {"status": "ok"}

@app.get("/health")
def health():
    return {"status": "ok"}

async def process_files_batch(process_id: str, file_ids: List[str], qa_count: int):
    """Background task to process multiple files"""
    status = process_statuses[process_id]
    
    try:
        for file_idx, file_id in enumerate(file_ids):
            if file_id not in file_registry:
                continue
                
            file_info = file_registry[file_id]
            file_path = get_file_path(file_id)
            storage = CSVStorage(file_path)
            
            # Update status for current file
            status.current_file = file_info.filename
            status.progress[file_id]["status"] = "processing"
            
            total_rows = storage.row_count()
            status.progress[file_id]["total"] = total_rows
            status.total_rows += total_rows
            
            results = []
            
            for row_idx in range(total_rows):
                # Update current row status
                status.current_row = row_idx + 1
                status.progress[file_id]["processed"] = row_idx + 1
                
                row = storage.get_row(row_idx)
                sanskrit_preview = row.get("sanskrit", "")[:50] + "..."
                status.current_sanskrit = sanskrit_preview
                
                # Check if already processed
                if storage.has_existing_qa_data(row_idx):
                    logger.info(f"File {file_id}, Row {row_idx}: Already has Q&A data, skipping")
                    continue
                
                sanskrit = row.get("sanskrit", "")
                english = row.get("english", "")
                
                if sanskrit and english:
                    try:
                        generated_qas = generate_for_row(
                            sanskrit, english, 
                            model=MODEL_NAME, 
                            n=qa_count
                        )
                        
                        result_item = {
                            "id": row_idx,
                            "sanskrit": sanskrit,
                            "english": english,
                            "file_id": file_id,
                            **generated_qas
                        }
                        results.append(result_item)
                        
                        logger.info(f"Generated Q&A for {file_id}, row {row_idx}")
                        
                    except Exception as e:
                        logger.error(f"Failed to generate Q&A for {file_id}, row {row_idx}: {e}")
                        # Continue with next row even if one fails
                else:
                    logger.warning(f"Skipping {file_id}, row {row_idx}: Missing Sanskrit or English")
                
                # Small delay to prevent overwhelming the server
                await asyncio.sleep(0.1)
            
            # Store results for this file
            status.results[file_id] = results
            status.progress[file_id]["status"] = "completed"
            status.processed_files = file_idx + 1
            
            # Update file metadata
            metadata = load_file_metadata(file_id)
            metadata["status"] = "completed"
            metadata["processed_count"] = len([r for r in results if r])
            save_file_metadata(file_id, metadata)
            file_registry[file_id].status = "completed"
            file_registry[file_id].processed_count = metadata["processed_count"]
        
        status.status = "completed"
        logger.info(f"Batch processing {process_id} completed")
        
    except Exception as e:
        logger.error(f"Batch processing failed for {process_id}: {e}")
        status.status = "error"
        status.error_message = str(e)
        # Mark current file as error
        if status.current_file:
            for file_id, progress in status.progress.items():
                if progress["status"] == "processing":
                    progress["status"] = "error"

# Add this class for detailed status
class FileProgress(BaseModel):
    file_id: str
    filename: str
    current_row: int
    total_rows: int
    current_sanskrit: str
    status: str  # pending, processing, completed, error
    processed_rows: int = 0
    error_message: str = ""

class DetailedProcessStatus(BaseModel):
    process_id: str
    status: str  # running, completed, error
    current_operation: str
    total_files: int
    processed_files: int
    total_rows: int
    processed_rows: int
    file_progress: Dict[str, FileProgress]
    results: Dict[str, List[Dict[str, Any]]] = {}
    start_time: str
    estimated_completion: str = ""
    qa_count: int = 4

# Update the global state
detailed_process_statuses: Dict[str, DetailedProcessStatus] = {}

@app.post("/process/batch/detailed")
async def start_detailed_batch_process(req: BatchProcessRequest, background_tasks: BackgroundTasks):
    """Start batch processing for multiple files with detailed status"""
    process_id = str(uuid.uuid4())
    
    # Validate file_ids
    valid_file_ids = []
    for file_id in req.file_ids:
        if file_id in file_registry:
            valid_file_ids.append(file_id)
        else:
            logger.warning(f"File {file_id} not found, skipping")
    
    if not valid_file_ids:
        raise HTTPException(status_code=400, detail="No valid files to process")
    
    # Calculate total rows
    total_rows = sum(file_registry[file_id].row_count for file_id in valid_file_ids)
    
    # Initialize detailed status
    detailed_process_statuses[process_id] = DetailedProcessStatus(
        process_id=process_id,
        status="initializing",
        current_operation="Starting batch processing...",
        total_files=len(valid_file_ids),
        processed_files=0,
        total_rows=total_rows,
        processed_rows=0,
        file_progress={
            file_id: FileProgress(
                file_id=file_id,
                filename=file_registry[file_id].filename,
                current_row=0,
                total_rows=file_registry[file_id].row_count,
                current_sanskrit="",
                status="pending",
                processed_rows=0
            )
            for file_id in valid_file_ids
        },
        start_time=datetime.now().isoformat(),
        qa_count=req.qa_count
    )
    
    # Start background task
    background_tasks.add_task(process_files_with_detailed_status, process_id, valid_file_ids, req.qa_count)
    
    return {
        "process_id": process_id, 
        "status": "started", 
        "file_count": len(valid_file_ids),
        "total_rows": total_rows
    }

@app.post("/process/save/{process_id}")
def save_batch_process_results(process_id: str, payload: Dict[str, Any]):
    """Save selected results from batch processing"""
    # Get the detailed status to access results
    status = detailed_process_statuses.get(process_id)
    if not status:
        raise HTTPException(status_code=404, detail="Process not found")
    
    saved_count = 0
    error_count = 0
    
    # Process each file's selected rows
    for file_id, rows in payload.items():
        if file_id not in file_registry:
            logger.warning(f"File {file_id} not found, skipping")
            error_count += 1
            continue
            
        file_path = get_file_path(file_id)
        storage = CSVStorage(file_path)
        
        for row_data in rows:
            idx = row_data.get("id")
            if idx is not None:
                try:
                    # Extract Q&A data from the row
                    qa_payload = {}
                    
                    # Copy all Q&A fields
                    for key in row_data.keys():
                        if key.startswith(('q_', 'a_')):
                            qa_payload[key] = row_data[key]
                    
                    # Also copy tags if present
                    if 'tags' in row_data:
                        qa_payload['tags'] = row_data['tags']
                    
                    # Update the row
                    success = storage.update_row_with_qas(idx, qa_payload)
                    if success:
                        saved_count += 1
                    else:
                        error_count += 1
                        logger.error(f"Failed to save row {idx} in file {file_id}")
                        
                except Exception as e:
                    logger.error(f"Error saving row {idx} in file {file_id}: {e}")
                    error_count += 1
    
    # Update file metadata after saving
    for file_id in payload.keys():
        if file_id in file_registry:
            metadata = load_file_metadata(file_id)
            storage = CSVStorage(get_file_path(file_id))
            processed_count = sum(1 for i in range(storage.row_count()) 
                                 if storage.has_existing_qa_data(i))
            metadata["processed_count"] = processed_count
            save_file_metadata(file_id, metadata)
            file_registry[file_id].processed_count = processed_count
    
    logger.info(f"Saved {saved_count} rows, {error_count} errors")
    
    return {
        "status": "ok", 
        "saved": saved_count,
        "errors": error_count,
        "message": f"Successfully saved {saved_count} rows"
    }
@app.post("/process/save")
def save_batch_results(payload: Dict[str, Any]):
    """Save batch results (simplified version)"""
    process_id = payload.get("process_id")
    rows = payload.get("rows", [])
    
    if not process_id or not rows:
        raise HTTPException(status_code=400, detail="Missing process_id or rows")
    
    # You can also use the detailed status if needed
    # status = detailed_process_statuses.get(process_id)
    
    saved_count = 0
    error_count = 0
    
    # Group rows by file_id
    rows_by_file = {}
    for row in rows:
        file_id = row.get("file_id")
        if file_id:
            if file_id not in rows_by_file:
                rows_by_file[file_id] = []
            rows_by_file[file_id].append(row)
    
    # Save rows for each file
    for file_id, file_rows in rows_by_file.items():
        if file_id not in file_registry:
            logger.warning(f"File {file_id} not found, skipping")
            error_count += len(file_rows)
            continue
            
        file_path = get_file_path(file_id)
        storage = CSVStorage(file_path)
        
        for row_data in file_rows:
            idx = row_data.get("id")
            if idx is not None:
                try:
                    # Extract Q&A data
                    qa_payload = {}
                    for key in row_data.keys():
                        if key.startswith(('q_', 'a_')):
                            qa_payload[key] = row_data[key]
                    
                    if 'tags' in row_data:
                        qa_payload['tags'] = row_data['tags']
                    
                    success = storage.update_row_with_qas(idx, qa_payload)
                    if success:
                        saved_count += 1
                    else:
                        error_count += 1
                        
                except Exception as e:
                    logger.error(f"Error saving row {idx}: {e}")
                    error_count += 1
    
    return {
        "status": "ok", 
        "saved": saved_count,
        "errors": error_count
    }

@app.get("/process/detailed/status/{process_id}")
def get_detailed_process_status(process_id: str):
    """Get detailed status of batch processing"""
    status = detailed_process_statuses.get(process_id)
    if not status:
        raise HTTPException(status_code=404, detail="Process not found")
    
    # Calculate progress percentages
    for file_progress in status.file_progress.values():
        if file_progress.total_rows > 0:
            file_progress.processed_rows = file_progress.current_row
    
    # Calculate overall progress
    if status.total_rows > 0:
        status.processed_rows = sum(fp.processed_rows for fp in status.file_progress.values())
    
    return status

async def process_files_with_detailed_status(process_id: str, file_ids: List[str], qa_count: int):
    """Background task to process multiple files with detailed status tracking"""
    status = detailed_process_statuses[process_id]
    
    try:
        status.status = "running"
        status.current_operation = "Preparing files..."
        
        for file_idx, file_id in enumerate(file_ids):
            if file_id not in file_registry:
                continue
                
            file_info = file_registry[file_id]
            file_path = get_file_path(file_id)
            storage = CSVStorage(file_path)
            
            # Update file progress
            file_progress = status.file_progress[file_id]
            file_progress.status = "processing"
            file_progress.current_row = 0
            
            status.current_operation = f"Processing {file_info.filename}"
            await asyncio.sleep(0.1)  # Small delay for UI updates
            
            total_rows = storage.row_count()
            results = []
            
            for row_idx in range(total_rows):
                # Update current row status
                file_progress.current_row = row_idx + 1
                status.processed_rows += 1
                
                row = storage.get_row(row_idx)
                sanskrit_preview = row.get("sanskrit", "")[:50] + "..."
                file_progress.current_sanskrit = sanskrit_preview
                
                # Update operation description
                if row_idx % 10 == 0:  # Update every 10 rows to reduce overhead
                    status.current_operation = (
                        f"Processing {file_info.filename}: "
                        f"Row {row_idx + 1}/{total_rows} - {sanskrit_preview}"
                    )
                
                # Check if already processed
                if storage.has_existing_qa_data(row_idx):
                    logger.info(f"File {file_id}, Row {row_idx}: Already has Q&A data, skipping")
                    continue
                
                sanskrit = row.get("sanskrit", "")
                english = row.get("english", "")
                
                if sanskrit and english:
                    try:
                        generated_qas = generate_for_row(
                            sanskrit, english, 
                            model=MODEL_NAME, 
                            n=qa_count
                        )
                        
                        result_item = {
                            "id": row_idx,
                            "sanskrit": sanskrit,
                            "english": english,
                            "file_id": file_id,
                            "filename": file_info.filename,
                            **generated_qas
                        }
                        results.append(result_item)
                        
                        logger.info(f"Generated Q&A for {file_info.filename}, row {row_idx}")
                        
                    except Exception as e:
                        logger.error(f"Failed to generate Q&A for {file_id}, row {row_idx}: {e}")
                        # Continue with next row even if one fails
                else:
                    logger.warning(f"Skipping {file_id}, row {row_idx}: Missing Sanskrit or English")
                
                # Small delay to prevent overwhelming the server
                await asyncio.sleep(0.05)
            
            # Store results for this file
            status.results[file_id] = results
            file_progress.status = "completed"
            file_progress.processed_rows = total_rows
            file_progress.current_row = total_rows
            
            status.processed_files = file_idx + 1
            status.current_operation = f"Completed {file_info.filename}"
            
            # Update file metadata
            metadata = load_file_metadata(file_id)
            metadata["status"] = "completed"
            metadata["processed_count"] = len([r for r in results if r])
            save_file_metadata(file_id, metadata)
            file_registry[file_id].status = "completed"
            file_registry[file_id].processed_count = metadata["processed_count"]
            
            await asyncio.sleep(0.1)  # Brief pause between files
        
        status.status = "completed"
        status.current_operation = "Batch processing completed successfully"
        logger.info(f"Batch processing {process_id} completed")
        
    except Exception as e:
        logger.error(f"Batch processing failed for {process_id}: {e}")
        status.status = "error"
        status.current_operation = f"Error: {str(e)}"
        # Mark current file as error
        for file_progress in status.file_progress.values():
            if file_progress.status == "processing":
                file_progress.status = "error"
                file_progress.error_message = str(e)