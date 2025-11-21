// Enhanced WebRTC Manager with DataChannels for P2P file sharing

class WebRTCManager {
  constructor() {
    this.ws = null;
    this.userId = null;
    this.peers = new Map(); // Map of peer connections
    this.dataChannels = new Map(); // Map of data channels
    this.onlineUsers = [];
    this.onOnlineUsersChange = null;
    this.onFileReceived = null;
    this.onProgressUpdate = null;
    this.pendingFiles = new Map(); // Files being sent
    this.receivingFiles = new Map(); // Files being received
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect(userId, backendUrl) {
    this.userId = userId;
    const wsUrl = backendUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    
    this.ws = new WebSocket(`${wsUrl}/api/ws/${userId}`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message:', data);

      switch (data.type) {
        case 'online_users':
          this.onlineUsers = data.users.filter(u => u.id !== this.userId);
          if (this.onOnlineUsersChange) {
            this.onOnlineUsersChange(this.onlineUsers);
          }
          break;
        
        case 'offer':
          await this.handleOffer(data.sender, data.offer);
          break;
        
        case 'answer':
          await this.handleAnswer(data.sender, data.answer);
          break;
        
        case 'ice-candidate':
          await this.handleIceCandidate(data.sender, data.candidate);
          break;
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      // Attempt to reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => {
          console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
          this.connect(userId, backendUrl);
        }, 2000 * this.reconnectAttempts);
      }
    };
  }

  updateUserInfo(username, emoji) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'update_info',
        username,
        emoji
      }));
    }
  }

  async createPeerConnection(peerId, isInitiator = true) {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(configuration);
    this.peers.set(peerId, peerConnection);

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'ice-candidate',
          target: peerId,
          candidate: event.candidate
        }));
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`🔄 ICE connection state with ${peerId}:`, peerConnection.iceConnectionState);
      if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'disconnected') {
        console.error(`❌ ICE connection ${peerConnection.iceConnectionState} with ${peerId}`);
      }
    };
    
    peerConnection.onconnectionstatechange = () => {
      console.log(`🔄 Connection state with ${peerId}:`, peerConnection.connectionState);
    };

    // Create data channel if initiator
    if (isInitiator) {
      const dataChannel = peerConnection.createDataChannel('fileTransfer', {
        ordered: true
      });
      this.setupDataChannel(peerId, dataChannel);
    } else {
      // Wait for data channel
      peerConnection.ondatachannel = (event) => {
        this.setupDataChannel(peerId, event.channel);
      };
    }

    return peerConnection;
  }

  setupDataChannel(peerId, dataChannel) {
    this.dataChannels.set(peerId, dataChannel);
    console.log(`Setting up data channel with ${peerId}, readyState:`, dataChannel.readyState);

    dataChannel.onopen = () => {
      console.log(`✅ Data channel OPEN with ${peerId}`);
    };

    dataChannel.onclose = () => {
      console.log(`❌ Data channel CLOSED with ${peerId}`);
      this.dataChannels.delete(peerId);
    };

    dataChannel.onerror = (error) => {
      console.error(`❌ Data channel ERROR with ${peerId}:`, error);
    };

    dataChannel.onmessage = (event) => {
      this.handleDataChannelMessage(peerId, event.data);
    };
  }

  async handleDataChannelMessage(peerId, data) {
    // Parse message
    if (typeof data === 'string') {
      const message = JSON.parse(data);
      
      if (message.type === 'file-metadata') {
        // Initialize file reception
        this.receivingFiles.set(message.fileId, {
          name: message.name,
          size: message.size,
          type: message.mimeType,
          chunks: [],
          receivedSize: 0,
          totalChunks: message.totalChunks
        });
        
        // Notify about starting to receive
        if (this.onProgressUpdate) {
          this.onProgressUpdate({
            type: 'receiving',
            peerId,
            fileName: message.name,
            progress: 0,
            speed: 0,
            timeRemaining: 0
          });
        }
      } else if (message.type === 'file-chunk') {
        // Store chunk information
        const fileInfo = this.receivingFiles.get(message.fileId);
        if (fileInfo) {
          // Decode base64 chunk to binary
          const binaryString = atob(message.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          fileInfo.chunks[message.index] = bytes;
          fileInfo.receivedSize += bytes.length;
          
          const progress = (fileInfo.receivedSize / fileInfo.size) * 100;
          
          // Update progress
          if (this.onProgressUpdate) {
            this.onProgressUpdate({
              type: 'receiving',
              peerId,
              fileName: fileInfo.name,
              progress: Math.round(progress),
              speed: 0, // Can calculate if needed
              timeRemaining: 0
            });
          }
          
          // Check if all chunks received
          if (message.index === message.totalChunks - 1) {
            // Reconstruct file from all chunks
            const blob = new Blob(fileInfo.chunks, { type: fileInfo.type });
            
            console.log('File received via P2P:', fileInfo.name, 'Size:', blob.size);
            
            // Trigger file received callback
            if (this.onFileReceived) {
              this.onFileReceived(fileInfo.name, blob, peerId);
            }
            
            // Clean up
            this.receivingFiles.delete(message.fileId);
          }
        }
      }
    } else {
      // Binary data (chunk)
      // This is handled in the string message parsing above
    }
  }

  async sendFile(peerId, file, onProgress) {
    const dataChannel = this.dataChannels.get(peerId);
    
    if (!dataChannel || dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    const fileId = Math.random().toString(36).substr(2, 9);
    const CHUNK_SIZE = 16384; // 16KB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    // Send file metadata
    dataChannel.send(JSON.stringify({
      type: 'file-metadata',
      fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      totalChunks
    }));

    // Send file in chunks
    const reader = new FileReader();
    let offset = 0;
    let chunkIndex = 0;
    const startTime = Date.now();

    const sendNextChunk = () => {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      reader.readAsArrayBuffer(slice);
    };

    reader.onload = (event) => {
      const chunk = event.target.result;
      const chunkData = btoa(String.fromCharCode(...new Uint8Array(chunk)));
      
      // Send chunk
      dataChannel.send(JSON.stringify({
        type: 'file-chunk',
        fileId,
        index: chunkIndex,
        data: chunkData,
        totalChunks
      }));

      offset += chunk.byteLength;
      chunkIndex++;

      // Calculate progress
      const progress = (offset / file.size) * 100;
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = offset / elapsed;
      const remaining = (file.size - offset) / speed;

      if (onProgress) {
        onProgress({
          progress: Math.round(progress),
          speed,
          timeRemaining: remaining
        });
      }

      if (offset < file.size) {
        // Send next chunk with a small delay to avoid overwhelming
        setTimeout(sendNextChunk, 10);
      } else {
        console.log('File sent successfully');
      }
    };

    reader.onerror = (error) => {
      console.error('Error reading file:', error);
    };

    sendNextChunk();
  }

  async initiateConnection(peerId) {
    try {
      const peerConnection = await this.createPeerConnection(peerId, true);
      
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Send offer via WebSocket
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'offer',
          target: peerId,
          offer: offer
        }));
      }
    } catch (error) {
      console.error('Error initiating connection:', error);
      throw error;
    }
  }

  async handleOffer(peerId, offer) {
    try {
      const peerConnection = await this.createPeerConnection(peerId, false);
      
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Send answer via WebSocket
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'answer',
          target: peerId,
          answer: answer
        }));
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  async handleAnswer(peerId, answer) {
    try {
      const peerConnection = this.peers.get(peerId);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  async handleIceCandidate(peerId, candidate) {
    try {
      const peerConnection = this.peers.get(peerId);
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  closePeerConnection(peerId) {
    const peerConnection = this.peers.get(peerId);
    if (peerConnection) {
      peerConnection.close();
      this.peers.delete(peerId);
    }
    
    const dataChannel = this.dataChannels.get(peerId);
    if (dataChannel) {
      dataChannel.close();
      this.dataChannels.delete(peerId);
    }
  }

  disconnect() {
    // Close all peer connections
    for (const peerId of this.peers.keys()) {
      this.closePeerConnection(peerId);
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Export singleton instance
const webrtcManager = new WebRTCManager();
export default webrtcManager;
