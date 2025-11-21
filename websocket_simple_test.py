#!/usr/bin/env python3
"""
Simple WebSocket test to verify core functionality
"""

import websocket
import json
import time
import threading
import uuid
import requests
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

def test_websocket_and_api():
    """Test WebSocket connection and online users API together"""
    print("🧪 Testing WebSocket + Online Users API")
    
    user_id = str(uuid.uuid4())
    connected = [False]
    messages = []
    
    def on_message(ws, message):
        try:
            msg_data = json.loads(message)
            messages.append(msg_data)
            print(f"📨 WebSocket message: {msg_data.get('type')}")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    def on_error(ws, error):
        print(f"❌ WebSocket error: {error}")
    
    def on_close(ws, close_status_code, close_msg):
        connected[0] = False
        print("🔌 WebSocket closed")
    
    def on_open(ws):
        connected[0] = True
        print("✅ WebSocket connected")
        
        # Send update_info
        update_msg = {
            "type": "update_info",
            "username": "SimpleTestUser",
            "emoji": "🧪"
        }
        ws.send(json.dumps(update_msg))
        print("📤 Sent update_info")
    
    # Connect WebSocket
    ws_url = f"{WS_URL}/api/ws/{user_id}"
    ws = websocket.WebSocketApp(ws_url,
                              on_open=on_open,
                              on_message=on_message,
                              on_error=on_error,
                              on_close=on_close)
    
    ws_thread = threading.Thread(target=ws.run_forever)
    ws_thread.daemon = True
    ws_thread.start()
    
    # Wait for connection
    timeout = 10
    start_time = time.time()
    while time.time() - start_time < timeout and not connected[0]:
        time.sleep(0.1)
    
    if not connected[0]:
        print("❌ WebSocket connection failed")
        return
    
    # Wait for messages to settle
    time.sleep(3)
    
    # Test online users API while WebSocket is connected
    print("🌐 Testing online users API...")
    try:
        response = requests.get(f"{BASE_URL}/online-users", timeout=10)
        print(f"API Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            users = data.get('users', [])
            print(f"✅ Online users API: {len(users)} users online")
            
            # Find our user
            our_user = None
            for user in users:
                if user.get('id') == user_id:
                    our_user = user
                    break
            
            if our_user:
                print(f"✅ Our user found: {our_user.get('username')} {our_user.get('emoji')}")
            else:
                print("⚠️  Our user not found in online users list")
        else:
            print(f"❌ API failed: {response.status_code}")
    
    except Exception as e:
        print(f"❌ API error: {e}")
    
    # Test WebRTC signaling with a fake target
    print("📡 Testing WebRTC signaling...")
    fake_target = str(uuid.uuid4())
    
    # Send offer
    offer_msg = {
        "type": "offer",
        "target": fake_target,
        "offer": {"type": "offer", "sdp": "fake-offer-sdp"}
    }
    ws.send(json.dumps(offer_msg))
    print("📤 Sent offer message")
    
    # Send ICE candidate
    ice_msg = {
        "type": "ice-candidate",
        "target": fake_target,
        "candidate": {"candidate": "fake-ice-candidate"}
    }
    ws.send(json.dumps(ice_msg))
    print("📤 Sent ICE candidate")
    
    # Wait for any responses
    time.sleep(2)
    
    print(f"📊 Total WebSocket messages received: {len(messages)}")
    for i, msg in enumerate(messages):
        print(f"  {i+1}. {msg.get('type')} - {msg}")
    
    # Close connection
    ws.close()
    time.sleep(1)
    
    # Check online users after disconnect
    print("🌐 Testing online users API after disconnect...")
    try:
        response = requests.get(f"{BASE_URL}/online-users", timeout=10)
        if response.status_code == 200:
            data = response.json()
            users = data.get('users', [])
            print(f"✅ After disconnect: {len(users)} users online")
        else:
            print(f"❌ API failed after disconnect: {response.status_code}")
    except Exception as e:
        print(f"❌ API error after disconnect: {e}")

def test_two_users_signaling():
    """Test WebRTC signaling between two users"""
    print("\n🤝 Testing Two-User WebRTC Signaling")
    
    user1_id = str(uuid.uuid4())
    user2_id = str(uuid.uuid4())
    
    user1_messages = []
    user2_messages = []
    user1_connected = [False]
    user2_connected = [False]
    
    def create_user_handlers(user_id, messages_list, connected_flag, user_name):
        def on_message(ws, message):
            try:
                msg_data = json.loads(message)
                messages_list.append(msg_data)
                msg_type = msg_data.get('type')
                sender = msg_data.get('sender', 'system')
                print(f"📨 {user_name} received {msg_type} from {sender[:8] if sender != 'system' else sender}")
            except Exception as e:
                print(f"❌ {user_name} message error: {e}")
        
        def on_error(ws, error):
            print(f"❌ {user_name} WebSocket error: {error}")
        
        def on_close(ws, close_status_code, close_msg):
            connected_flag[0] = False
            print(f"🔌 {user_name} disconnected")
        
        def on_open(ws):
            connected_flag[0] = True
            print(f"✅ {user_name} connected")
            
            # Update user info
            update_msg = {
                "type": "update_info",
                "username": user_name,
                "emoji": "👤" if user_name == "User1" else "👥"
            }
            ws.send(json.dumps(update_msg))
        
        return on_message, on_error, on_close, on_open
    
    # Create connections
    user1_handlers = create_user_handlers(user1_id, user1_messages, user1_connected, "User1")
    user2_handlers = create_user_handlers(user2_id, user2_messages, user2_connected, "User2")
    
    ws1 = websocket.WebSocketApp(f"{WS_URL}/api/ws/{user1_id}", *user1_handlers)
    ws2 = websocket.WebSocketApp(f"{WS_URL}/api/ws/{user2_id}", *user2_handlers)
    
    # Start User1
    ws1_thread = threading.Thread(target=ws1.run_forever)
    ws1_thread.daemon = True
    ws1_thread.start()
    
    # Wait a bit then start User2
    time.sleep(1)
    ws2_thread = threading.Thread(target=ws2.run_forever)
    ws2_thread.daemon = True
    ws2_thread.start()
    
    # Wait for both to connect
    timeout = 10
    start_time = time.time()
    while time.time() - start_time < timeout:
        if user1_connected[0] and user2_connected[0]:
            print("✅ Both users connected!")
            break
        time.sleep(0.1)
    
    if not (user1_connected[0] and user2_connected[0]):
        print("❌ Failed to connect both users")
        return
    
    # Wait for initial messages
    time.sleep(2)
    
    # User1 sends offer to User2
    print("📡 User1 sending offer to User2...")
    offer_msg = {
        "type": "offer",
        "target": user2_id,
        "offer": {"type": "offer", "sdp": "fake-offer-from-user1"}
    }
    ws1.send(json.dumps(offer_msg))
    
    time.sleep(1)
    
    # User2 sends answer to User1
    print("📡 User2 sending answer to User1...")
    answer_msg = {
        "type": "answer",
        "target": user1_id,
        "answer": {"type": "answer", "sdp": "fake-answer-from-user2"}
    }
    ws2.send(json.dumps(answer_msg))
    
    time.sleep(1)
    
    # Exchange ICE candidates
    print("📡 Exchanging ICE candidates...")
    ice1_msg = {
        "type": "ice-candidate",
        "target": user2_id,
        "candidate": {"candidate": "fake-ice-from-user1"}
    }
    ws1.send(json.dumps(ice1_msg))
    
    ice2_msg = {
        "type": "ice-candidate",
        "target": user1_id,
        "candidate": {"candidate": "fake-ice-from-user2"}
    }
    ws2.send(json.dumps(ice2_msg))
    
    # Wait for message exchange
    time.sleep(3)
    
    # Close connections
    ws1.close()
    ws2.close()
    time.sleep(1)
    
    # Analyze results
    print(f"\n📊 Results:")
    print(f"User1 messages: {len(user1_messages)}")
    print(f"User2 messages: {len(user2_messages)}")
    
    # Check for WebRTC messages
    user1_offers = [msg for msg in user1_messages if msg.get('type') == 'offer']
    user1_answers = [msg for msg in user1_messages if msg.get('type') == 'answer']
    user1_ice = [msg for msg in user1_messages if msg.get('type') == 'ice-candidate']
    
    user2_offers = [msg for msg in user2_messages if msg.get('type') == 'offer']
    user2_answers = [msg for msg in user2_messages if msg.get('type') == 'answer']
    user2_ice = [msg for msg in user2_messages if msg.get('type') == 'ice-candidate']
    
    print(f"User1 received: {len(user1_offers)} offers, {len(user1_answers)} answers, {len(user1_ice)} ICE")
    print(f"User2 received: {len(user2_offers)} offers, {len(user2_answers)} answers, {len(user2_ice)} ICE")
    
    # Verify signaling worked
    if user2_offers and user1_answers and user1_ice and user2_ice:
        print("✅ WebRTC signaling flow completed successfully!")
    else:
        print("❌ WebRTC signaling flow incomplete")
        print("Missing messages:")
        if not user2_offers:
            print("  - User2 didn't receive offer")
        if not user1_answers:
            print("  - User1 didn't receive answer")
        if not user1_ice:
            print("  - User1 didn't receive ICE candidate")
        if not user2_ice:
            print("  - User2 didn't receive ICE candidate")

if __name__ == "__main__":
    print("🧪 Simple WebSocket Test for UniShare7")
    print("="*50)
    
    test_websocket_and_api()
    test_two_users_signaling()
    
    print("\n✅ Simple tests completed")