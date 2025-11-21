#!/usr/bin/env python3
"""
Test concurrent WebSocket connections with different timing
"""

import websocket
import json
import time
import threading
import uuid
from pathlib import Path

def get_backend_url():
    frontend_env_path = Path("/app/frontend/.env")
    if frontend_env_path.exists():
        with open(frontend_env_path, 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    return "http://localhost:8001"

WS_URL = get_backend_url().replace("https://", "wss://").replace("http://", "ws://")

def test_concurrent_connections():
    """Test multiple WebSocket connections with minimal delay"""
    print("🔗 Testing Concurrent WebSocket Connections")
    
    num_users = 3
    users = []
    
    for i in range(num_users):
        user_id = str(uuid.uuid4())
        user_data = {
            'id': user_id,
            'name': f'User{i+1}',
            'messages': [],
            'connected': [False],
            'ws': None,
            'thread': None
        }
        users.append(user_data)
    
    def create_handlers(user_data):
        def on_message(ws, message):
            try:
                msg_data = json.loads(message)
                user_data['messages'].append(msg_data)
                msg_type = msg_data.get('type')
                print(f"📨 {user_data['name']} received: {msg_type}")
                
                if msg_type == 'online_users':
                    users_list = msg_data.get('users', [])
                    print(f"   Online users count: {len(users_list)}")
            except Exception as e:
                print(f"❌ {user_data['name']} message error: {e}")
        
        def on_error(ws, error):
            print(f"❌ {user_data['name']} error: {error}")
        
        def on_close(ws, close_status_code, close_msg):
            user_data['connected'][0] = False
            print(f"🔌 {user_data['name']} disconnected: {close_status_code}")
        
        def on_open(ws):
            user_data['connected'][0] = True
            print(f"✅ {user_data['name']} connected")
            
            # Send update_info
            update_msg = {
                "type": "update_info",
                "username": user_data['name'],
                "emoji": f"🧪{user_data['name'][-1]}"
            }
            ws.send(json.dumps(update_msg))
        
        return on_message, on_error, on_close, on_open
    
    # Create WebSocket connections
    for user_data in users:
        handlers = create_handlers(user_data)
        ws_url = f"{WS_URL}/api/ws/{user_data['id']}"
        
        user_data['ws'] = websocket.WebSocketApp(ws_url, *handlers)
        user_data['thread'] = threading.Thread(target=user_data['ws'].run_forever)
        user_data['thread'].daemon = True
    
    # Start connections with minimal delay
    print(f"🚀 Starting {num_users} WebSocket connections...")
    for i, user_data in enumerate(users):
        print(f"Starting {user_data['name']}...")
        user_data['thread'].start()
        time.sleep(0.2)  # Very short delay
    
    # Wait for connections
    print("⏳ Waiting for connections...")
    timeout = 15
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        connected_count = sum(1 for user in users if user['connected'][0])
        print(f"Connected: {connected_count}/{num_users}")
        
        if connected_count == num_users:
            print("✅ All users connected!")
            break
        time.sleep(1)
    
    # Check final connection status
    connected_users = [user for user in users if user['connected'][0]]
    print(f"📊 Final status: {len(connected_users)}/{num_users} users connected")
    
    if len(connected_users) < num_users:
        print("❌ Not all users could connect")
        for user in users:
            if not user['connected'][0]:
                print(f"   {user['name']}: Failed to connect")
    
    # Wait for messages
    if connected_users:
        print("⏳ Waiting for online_users broadcasts...")
        time.sleep(5)
        
        # Test WebRTC signaling between first two connected users
        if len(connected_users) >= 2:
            user1 = connected_users[0]
            user2 = connected_users[1]
            
            print(f"📡 Testing signaling between {user1['name']} and {user2['name']}")
            
            # User1 sends offer to User2
            offer_msg = {
                "type": "offer",
                "target": user2['id'],
                "offer": {"type": "offer", "sdp": "test-offer"}
            }
            user1['ws'].send(json.dumps(offer_msg))
            print(f"📤 {user1['name']} sent offer to {user2['name']}")
            
            time.sleep(1)
            
            # User2 sends answer to User1
            answer_msg = {
                "type": "answer",
                "target": user1['id'],
                "answer": {"type": "answer", "sdp": "test-answer"}
            }
            user2['ws'].send(json.dumps(answer_msg))
            print(f"📤 {user2['name']} sent answer to {user1['name']}")
            
            time.sleep(2)
    
    # Close all connections
    print("🔌 Closing all connections...")
    for user_data in users:
        if user_data['ws']:
            user_data['ws'].close()
    
    time.sleep(2)
    
    # Analyze results
    print("\n📊 Results Analysis:")
    for user_data in users:
        messages = user_data['messages']
        online_msgs = [msg for msg in messages if msg.get('type') == 'online_users']
        offer_msgs = [msg for msg in messages if msg.get('type') == 'offer']
        answer_msgs = [msg for msg in messages if msg.get('type') == 'answer']
        
        print(f"{user_data['name']}:")
        print(f"  Total messages: {len(messages)}")
        print(f"  Online users broadcasts: {len(online_msgs)}")
        print(f"  Offers received: {len(offer_msgs)}")
        print(f"  Answers received: {len(answer_msgs)}")
    
    # Check if signaling worked
    if len(connected_users) >= 2:
        user1_answers = [msg for msg in connected_users[0]['messages'] if msg.get('type') == 'answer']
        user2_offers = [msg for msg in connected_users[1]['messages'] if msg.get('type') == 'offer']
        
        if user1_answers and user2_offers:
            print("✅ WebRTC signaling between users worked!")
        else:
            print("❌ WebRTC signaling failed")
            print(f"  User1 received {len(user1_answers)} answers")
            print(f"  User2 received {len(user2_offers)} offers")

if __name__ == "__main__":
    print("🔗 Concurrent WebSocket Connection Test")
    print("="*50)
    
    test_concurrent_connections()
    
    print("\n✅ Concurrent test completed")