class MetricsCollector:
    """Enterprise-grade collector for formatting Prometheus-compatible system metrics."""
    
    def __init__(self):
        self.http_requests_total = {}
        self.request_durations = []
        self.active_websockets = 0
        self.ai_reports_generated = 0
        
    def record_request(self, method: str, path: str, status_code: int):
        key = (method, path, status_code)
        self.http_requests_total[key] = self.http_requests_total.get(key, 0) + 1
        
    def record_duration(self, latency_ms: float):
        # Convert ms to seconds
        self.request_durations.append(latency_ms / 1000.0)
        # Keep maximum window size of 1000 transactions
        if len(self.request_durations) > 1000:
            self.request_durations.pop(0)

    def get_prometheus_metrics(self) -> str:
        lines = []
        
        # HTTP Requests Total
        lines.append("# HELP rotordyn_http_requests_total Total number of HTTP requests processed.")
        lines.append("# TYPE rotordyn_http_requests_total counter")
        for (method, path, status_code), count in self.http_requests_total.items():
            lines.append(f'rotordyn_http_requests_total{{method="{method}",path="{path}",status="{status_code}"}} {count}')
            
        # Active WebSockets
        lines.append("# HELP rotordyn_active_websockets Current number of active SCADA WebSocket feeds.")
        lines.append("# TYPE rotordyn_active_websockets gauge")
        lines.append(f"rotordyn_active_websockets {self.active_websockets}")
        
        # AI Reports Compiled
        lines.append("# HELP rotordyn_ai_reports_total Cumulative AI reports generated.")
        lines.append("# TYPE rotordyn_ai_reports_total counter")
        lines.append(f"rotordyn_ai_reports_total {self.ai_reports_generated}")
        
        # HTTP Latency Average
        avg_latency = sum(self.request_durations) / len(self.request_durations) if self.request_durations else 0.0
        lines.append("# HELP rotordyn_http_request_duration_seconds_average Average latency of HTTP transactions.")
        lines.append("# TYPE rotordyn_http_request_duration_seconds_average gauge")
        lines.append(f"rotordyn_http_request_duration_seconds_average {avg_latency:.4f}")
        
        return "\n".join(lines) + "\n"

metrics_collector = MetricsCollector()
