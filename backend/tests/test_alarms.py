from unittest.mock import patch, MagicMock

async def test_get_alarms_success(client):
    # Mock database alarms select query chain
    mock_db_res = MagicMock()
    mock_db_res.data = [
        {"id": "alarm-123", "bearing_name": "DE", "severity": "critical", "status": "active"}
    ]
    
    with patch("database.supabase.table") as mock_table:
        mock_table.return_value.select.return_value.order.return_value.range.return_value.execute = MagicMock(return_value=mock_db_res)
        
        headers = {"Authorization": "Bearer dummy_token"}
        response = client.get("/alarms", headers=headers)
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["bearing_name"] == "DE"

async def test_acknowledge_alarm_success(client):
    # Mock database select query checks and update transactions
    mock_select_res = MagicMock()
    mock_select_res.data = [{"id": "alarm-123", "status": "active"}]
    
    mock_update_res = MagicMock()
    mock_update_res.data = [{"id": "alarm-123", "status": "acknowledged"}]
    
    with patch("database.supabase.table") as mock_table:
        mock_table.return_value.select.return_value.eq.return_value.execute = MagicMock(return_value=mock_select_res)
        mock_table.return_value.update.return_value.eq.return_value.execute = MagicMock(return_value=mock_update_res)
        
        headers = {"Authorization": "Bearer dummy_token"}
        response = client.post("/alarms/acknowledge", headers=headers, json={"alarm_id": "alarm-123"})
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        assert response.json()["alarm"]["status"] == "acknowledged"
