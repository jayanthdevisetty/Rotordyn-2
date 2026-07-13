import uuid
import time
import asyncio
from typing import Dict, Any, Optional
from abc import ABC, abstractmethod

class BaseTaskQueue(ABC):
    """Abstract Base Class defining the enterprise Task Queue service interface."""
    
    @abstractmethod
    async def enqueue(self, task_func, *args, **kwargs) -> str:
        """Enqueue a task and return a unique job_id."""
        pass
        
    @abstractmethod
    async def get_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve execution state status for a specific job_id."""
        pass

# In-memory store for tracking background job statuses
# In production, this can be backed by Redis or Supabase postgres
job_store: Dict[str, Dict[str, Any]] = {}

class LocalBackgroundTaskQueue(BaseTaskQueue):
    """Lightweight local async task queue implementing BaseTaskQueue.
    Can be easily swapped for Celery, Dramatiq, or RQ in production.
    """
    
    async def enqueue(self, task_func, *args, **kwargs) -> str:
        job_id = str(uuid.uuid4())
        job_store[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "progress": 0,
            "result": None,
            "error": None,
            "created_at": time.time()
        }
        
        # Fire and forget execution in event loop, updating status store
        asyncio.create_task(self._run_task(job_id, task_func, *args, **kwargs))
        return job_id
        
    async def get_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        return job_store.get(job_id)
        
    async def _run_task(self, job_id: str, task_func, *args, **kwargs):
        job_store[job_id]["status"] = "processing"
        job_store[job_id]["progress"] = 10
        try:
            # If task_func is a coroutine, await it, otherwise run in executor
            if asyncio.iscoroutinefunction(task_func):
                result = await task_func(*args, **kwargs)
            else:
                result = await asyncio.to_thread(task_func, *args, **kwargs)
                
            job_store[job_id]["status"] = "completed"
            job_store[job_id]["progress"] = 100
            job_store[job_id]["result"] = result
        except Exception as e:
            job_store[job_id]["status"] = "failed"
            job_store[job_id]["progress"] = 100
            job_store[job_id]["error"] = str(e)
            print(f"ERROR: Background job {job_id} failed: {e}")

# Global service instance
task_queue: BaseTaskQueue = LocalBackgroundTaskQueue()
