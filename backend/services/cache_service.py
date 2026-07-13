import os
from typing import Any, Optional
from abc import ABC, abstractmethod

class BaseCacheService(ABC):
    """Abstract Base Class defining the enterprise Caching service interface."""
    
    @abstractmethod
    def get(self, key: str) -> Optional[Any]:
        """Retrieve key value from cache."""
        pass
        
    @abstractmethod
    def set(self, key: str, value: Any, expire: int = 3600) -> None:
        """Store key-value pair in cache with expiration bounds."""
        pass
        
    @abstractmethod
    def delete(self, key: str) -> None:
        """Remove key value from cache."""
        pass

class DisabledCacheService(BaseCacheService):
    """Fallback cache service that keeps caching disabled.
    Used when Redis is unavailable to prevent memory leakage.
    """
    
    def get(self, key: str) -> Optional[Any]:
        return None
        
    def set(self, key: str, value: Any, expire: int = 3600) -> None:
        pass
        
    def delete(self, key: str) -> None:
        pass

class RedisCacheService(BaseCacheService):
    """Production Redis caching integration."""
    
    def __init__(self, redis_url: str):
        try:
            import redis
            self.client = redis.from_url(redis_url)
            print("INFO: Connected to Redis Cache server successfully.")
        except Exception as e:
            print(f"WARNING: Redis connection failed, falling back to disabled cache: {e}")
            self.client = None
            
    def get(self, key: str) -> Optional[Any]:
        if not self.client:
            return None
        try:
            val = self.client.get(key)
            return val.decode("utf-8") if val else None
        except Exception:
            return None
            
    def set(self, key: str, value: Any, expire: int = 3600) -> None:
        if not self.client:
            return
        try:
            self.client.set(key, str(value), ex=expire)
        except Exception:
            pass
            
    def delete(self, key: str) -> None:
        if not self.client:
            return
        try:
            self.client.delete(key)
        except Exception:
            pass

# Initialize cache based on env configuration
redis_url = os.getenv("REDIS_URL")
if redis_url:
    cache_service: BaseCacheService = RedisCacheService(redis_url)
else:
    cache_service: BaseCacheService = DisabledCacheService()
