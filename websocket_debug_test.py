#!/usr/bin/env python3
"""
Focused WebSocket debugging test for UniShare7
Tests specific WebSocket functionality issues found in main test
"""

import websocket
import json
import time
import threading
import uuid
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

BASE_URL = get_backend_url() + "/api"
WS_URL = get_backend_url().replace("https://", "wss://").replace("http://", "ws://")

print(f"WebSocket URL: {WS_URL}")

def test_websocket_detailed():
    """Detailed WebSocket test with better debugging"""
    print("\n=== Detailed WebSocket Test ===")
    
    user_id = str(uuid.uuid4())
    messages = []
    connected = [False]
    
    def on_message(ws, message):
        try:
            msg_data = json.loads(message)
            messages.append(msg_data)
            print(f"📨 Received: {json.dumps(msg_data, indent=2)}")
        except Exception as e:
            print(f"❌ Error parsing message: {e}")
            print(f"Raw message: {message}")
    
    def on_error(ws, error):
        print(f"❌ WebSocket error: {error}")
    
    def on_close(ws, close_status_code, close_msg):
        print(f"🔌 WebSocket closed: {close_status_code} - {close_msg}")
        connected[0] = False
    
    def on_open(ws):
        print(f"✅ WebSocket connected for user {user_id[:8]}")
        connected[0] = True
        
        # Test update_info message
        print("📤 Sending update_info message...")
        update_message = {
            "type": "update_info",
            "username": "DebugTestUser",
            "emoji": "🐛"
        }
        ws.send(json.dumps(update_message))
        
        # Wait a bit then send a test WebRTC message
        def send_test_messages():
            time.sleep(2)
            print("📤 Sending test offer message...")
            offer_message = {
                "type": "offer",
                "target": "fake-target-id",
                "offer": {"type": "offer", "sdp": "fake-sdp"}
            }
            ws.send(json.dumps(offer_message))
            
            time.sleep(1)
            print("📤 Sending test ICE candidate...")
            ice_message = {
                "type": "ice-candidate",
                "target": "fake-target-id",
                "candidate": {"candidate": "fake-candidate"}
            }
            ws.send(json.dumps(ice_message))
        
        threading.Thread(target=send_test_messages).start()
    
    ws_url = f"{WS_URL}/api/ws/{user_id}"
    print(f"Connecting to: {ws_url}")
    
    ws = websocket.WebSocketApp(ws_url,
                              on_open=on_open,
                              on_message=on_message,
                              on_error=on_error,
                              on_close=on_close)
    
    # Start connection
    ws_thread = threading.Thread(target=ws.run_forever)
    ws_thread.daemon = True
    ws_thread.start()
    
    # Wait for connection and messages
    timeout = 15
    start_time = time.time()
    while time.time() - start_time < timeout:
        if connected[0]:
            break
        time.sleep(0.1)
    
    if not connected[0]:
        print("❌ Failed to connect within timeout")
        return
    
    # Keep connection open for a while to receive messages
    time.sleep(8)
    
    print(f"\n📊 Total messages received: {len(messages)}")
    for i, msg in enumerate(messages):
        print(f"Message {i+1}: {msg.get('type', 'unknown')} - {msg}")
    
    ws.close()
    time.sleep(1)

def test_multiple_connections():
    """Test multiple WebSocket connections to see online users broadcast"""
    print("\n=== Multiple Connections Test ===")
    
    user1_id = str(uuid.uuid4())
    user2_id = str(uuid.uuid4())
    
    user1_messages = []
    user2_messages = []
    user1_connected = [False]
    user2_connected = [False]
    
    def create_handlers(user_id, messages_list, connected_flag):
        def on_message(ws, message):
            try:
                msg_data = json.loads(message)
                messages_list.append(msg_data)
                print(f"📨 User {user_id[:8]} received: {msg_data.get('type', 'unknown')}")
                if msg_data.get('type') == 'online_users':
                    users = msg_data.get('users', [])
                    print(f"   Online users count: {len(users)}")
                    for user in users:
                        print(f"   - {user.get('username', 'Anonymous')} {user.get('emoji', '👤')} (ID: {user.get('id', 'unknown')[:8]})")
            except Exception as e:
                print(f"❌ Error parsing message for {user_id}: {e}")
        
        def on_error(ws, error):
            print(f"❌ WebSocket error for {user_id}: {error}")
        
        def on_close(ws, close_status_code, close_msg):
            print(f"🔌 User {user_id[:8]} disconnected")
            connected_flag[0] = False
        
        def on_open(ws):
            print(f"✅ User {user_id[:8]} connected")
            connected_flag[0] = True
            
            # Send update_info for this user
            update_message = {
                "type": "update_info",
                "username": f"TestUser_{user_id[:8]}",
                "emoji": "🧪" if user_id == user1_id else "🔬"
            }
            ws.send(json.dumps(update_message))
        
        return on_message, on_error, on_close, on_open
    
    # Create WebSocket connections
    user1_handlers = create_handlers(user1_id, user1_messages, user1_connected)
    user2_handlers = create_handlers(user2_id, user2_messages, user2_connected)
    
    ws1_url = f"{WS_URL}/api/ws/{user1_id}"
    ws2_url = f"{WS_URL}/api/ws/{user2_id}"
    
    ws1 = websocket.WebSocketApp(ws1_url, *user1_handlers)
    ws2 = websocket.WebSocketApp(ws2_url, *user2_handlers)
    
    # Start connections with staggered timing
    print("🔌 Starting User1 connection...")
    ws1_thread = threading.Thread(target=ws1.run_forever)
    ws1_thread.daemon = True
    ws1_thread.start()
    
    time.sleep(2)  # Wait before starting second connection
    
    print("🔌 Starting User2 connection...")
    ws2_thread = threading.Thread(target=ws2.run_forever)
    ws2_thread.daemon = True
    ws2_thread.start()
    
    # Wait for both connections
    timeout = 15
    start_time = time.time()
    while time.time() - start_time < timeout:
        if user1_connected[0] and user2_connected[0]:
            print("✅ Both users connected!")
            break
        time.sleep(0.1)
    
    if not (user1_connected[0] and user2_connected[0]):
        print("❌ Failed to establish both connections")
        return
    
    # Keep connections open to observe broadcasts
    print("⏳ Waiting for online_users broadcasts...")
    time.sleep(8)
    
    # Close connections
    print("🔌 Closing connections...")
    ws1.close()
    ws2.close()
    time.sleep(2)
    
    # Analyze results
    print(f"\n📊 User1 received {len(user1_messages)} messages")
    print(f"📊 User2 received {len(user2_messages)} messages")
    
    user1_online_msgs = [msg for msg in user1_messages if msg.get('type') == 'online_users']
    user2_online_msgs = [msg for msg in user2_messages if msg.get('type') == 'online_users']
    
    print(f"📊 User1 online_users messages: {len(user1_online_msgs)}")
    print(f"📊 User2 online_users messages: {len(user2_online_msgs)}")
    
    if user1_online_msgs:
        print("✅ User1 received online_users broadcasts")
    else:
        print("❌ User1 did not receive online_users broadcasts")
    
    if user2_online_msgs:
        print("✅ User2 received online_users broadcasts")
    else:
        print("❌ User2 did not receive online_users broadcasts")

if __name__ == "__main__":
    print("🐛 WebSocket Debug Test for UniShare7")
    print("="*50)
    
    test_websocket_detailed()
    time.sleep(2)
    test_multiple_connections()
    
    print("\n✅ Debug tests completed")