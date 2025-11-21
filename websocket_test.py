#!/usr/bin/env python3
"""
Quick WebSocket test for UniShare
"""

import websocket
import json
import uuid
import time
import threading
from pathlib import Path

# Get backend URL from frontend .env file
def get_backend_url():
    frontend_env_path = Path("/app/frontend/.env")
    if frontend_env_path.exists():
        with open(frontend_env_path, 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    return "http://localhost:8001"

BASE_URL = get_backend_url()
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

print(f"Testing WebSocket at: {WS_URL}")

def test_websocket():
    test_user_id = str(uuid.uuid4())
    ws_url = f"{WS_URL}/api/ws/{test_user_id}"
    
    print(f"Connecting to: {ws_url}")
    
    messages_received = []
    connection_established = False
    
    def on_message(ws, message):
        print(f"Received: {message}")
        messages_received.append(json.loads(message))
    
    def on_error(ws, error):
        print(f"WebSocket error: {error}")
    
    def on_close(ws, close_status_code, close_msg):
        print(f"WebSocket closed: {close_status_code} - {close_msg}")
    
    def on_open(ws):
        nonlocal connection_established
        print("WebSocket connection opened successfully!")
        connection_established = True
        
        # Send a test message
        test_message = {
            "type": "update_info",
            "username": "TestUser",
            "emoji": "🧪"
        }
        print(f"Sending: {test_message}")
        ws.send(json.dumps(test_message))
        
        # Close after a short delay
        def close_later():
            time.sleep(3)
            ws.close()
        
        threading.Thread(target=close_later).start()
    
    try:
        ws = websocket.WebSocketApp(ws_url,
                                  on_open=on_open,
                                  on_message=on_message,
                                  on_error=on_error,
                                  on_close=on_close)
        
        # Run with timeout
        ws.run_forever()
        
        if connection_established:
            print("✅ WebSocket test PASSED")
            print(f"Messages received: {len(messages_received)}")
            return True
        else:
            print("❌ WebSocket test FAILED - Connection not established")
            return False
            
    except Exception as e:
        print(f"❌ WebSocket test FAILED: {e}")
        return False

if __name__ == "__main__":
    success = test_websocket()
    exit(0 if success else 1)