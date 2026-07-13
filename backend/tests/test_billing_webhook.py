import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

# Test Stripe Webhook signatures validations
@patch("stripe.Webhook.construct_event")
def test_stripe_webhook_invalid_signature(mock_construct, client):
    mock_construct.side_effect = Exception("Signature verification failed")
    
    # Send post request to /auth/webhook
    headers = {"stripe-signature": "dummy_sig"}
    response = client.post("/auth/webhook", headers=headers, content=b"invalid payload")
    
    # Should fail due to mock signature failure
    assert response.status_code == 400

@patch("stripe.Webhook.construct_event")
@patch("database.supabase.table")
@patch("database.supabase.auth.admin.update_user_by_id")
def test_stripe_webhook_upgrade_success(mock_auth, mock_db_table, mock_construct, client):
    # Mock event construction payload
    mock_construct.return_value = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_123",
                "metadata": {"user_id": "test-uuid-456"}
            }
        }
    }
    
    # Mock database profiles execution success
    mock_db_res = MagicMock()
    mock_db_table.return_value.update.return_value.eq.return_value.execute = MagicMock(return_value=mock_db_res)
    
    with patch("os.getenv", return_value="whsec_test_secret"):
        headers = {"stripe-signature": "valid_sig"}
        response = client.post("/auth/webhook", headers=headers, json={"type": "checkout.session.completed"})
        
        assert response.status_code == 200
        assert response.json() == {"status": "success"}
        
        # Verify db update call attempted
        mock_db_table.assert_called_with("profiles")
        mock_db_table.return_value.update.assert_called_with({"subscription_status": "premium"})
