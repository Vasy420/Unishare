// Enhanced WebRTC Manager with DataChannels for P2P file sharing
import { getWebRtcIceServers, isOfflineMode } from './offline';

class WebRTCManager {
  constructor() {
    this.ws = null;
    this.userId = null;
    this.username = null;
    this.emoji = null;
    this.peers = new Map(); // Map of peer connections
    this.dataChannels = new Map(); // Map of data channels
    this.onlineUsers = [];
    this.onOnlineUsersChange = null;
    this.onFileReceived = null;
    this.onFileOffered = null;
    this.onProgressUpdate = null;
    this.pendingFiles = new Map(); // Files hosted for link-based pickup
    this.pendingSends = new Map(); // Files awaiting offer accept/decline
    this.receivingFiles = new Map(); // Files being received
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.broadcastChannel = null;
    this.broadcastPeers = new Map();
    this.presenceInterval = null;
    this.wsConnected = false;
  }

  connect(userId, backendUrl, username = null, emoji = null) {
    this.userId = userId;
    this.username = username || 'Anonymous';
    this.emoji = emoji || '👤';

    if (isOfflineMode()) {
      this.enableBroadcastSignaling();
    }

    if (!backendUrl) {
      if (this.enableBroadcastSignaling()) {
        return;
      }
      console.warn('WebRTC signaling requires a backend URL. Skipping WebSocket connection.');
      return;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    const wsUrl = backendUrl.replace('https://', 'wss://').replace('http://', 'ws://');

    // Add query parameters for username and emoji if provided
    let url = `${wsUrl}/api/ws/${userId}`;
    const params = new URLSearchParams();
    if (username) params.append('username', username);
    if (emoji) params.append('emoji', emoji);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    this.ws = new WebSocket(url);
    this.wsConnected = false;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.wsConnected = true;
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      this.handleSignalPayload(data);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (!this.wsConnected && isOfflineMode()) {
        this.enableBroadcastSignaling();
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      if (!this.wsConnected && isOfflineMode()) {
        this.enableBroadcastSignaling();
        return;
      }
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
    this.username = username || this.username;
    this.emoji = emoji || this.emoji;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'update_info',
        username,
        emoji
      }));
    } else if (this.broadcastChannel) {
      this.broadcastPresence();
    }
  }

  async createPeerConnection(peerId, isInitiator = true) {
    const configuration = {
      iceServers: getWebRtcIceServers()
    };

    const peerConnection = new RTCPeerConnection(configuration);
    this.peers.set(peerId, peerConnection);

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const sent = this.sendSignal({
          type: 'ice-candidate',
          target: peerId,
          candidate: event.candidate
        });
        if (!sent) {
          console.warn('Signaling channel not ready. ICE candidate skipped.');
        }
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

  // New: Host a file for P2P sharing without immediate transfer
  hostFile(file) {
    const fileId = Math.random().toString(36).substr(2, 9);
    this.pendingFiles.set(fileId, file);
    return fileId;
  }

  // New: Request a specific file from a peer
  async requestFile(peerId, fileId) {
    const dataChannel = this.dataChannels.get(peerId);
    if (!dataChannel || dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    console.log(`Requesting file ${fileId} from ${peerId}`);
    dataChannel.send(JSON.stringify({
      type: 'request-file',
      fileId
    }));
  }

  // Receiver responds to an incoming file-offer
  respondToOffer(peerId, fileId, accepted) {
    const dataChannel = this.dataChannels.get(peerId);
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.error('Cannot respond to offer: data channel not open');
      return false;
    }
    dataChannel.send(JSON.stringify({
      type: 'file-offer-response',
      fileId,
      accepted: !!accepted
    }));
    return true;
  }

  async handleDataChannelMessage(peerId, data) {
    // Parse message
    if (typeof data === 'string') {
      const message = JSON.parse(data);

      if (message.type === 'request-file') {
        // Peer is requesting a file we're hosting
        const file = this.pendingFiles.get(message.fileId);
        if (file) {
          console.log(`Peer ${peerId} requested file ${file.name}. Starting transfer...`);
          this.sendFileWithId(peerId, file, message.fileId, this.onProgressUpdate);
        } else {
          console.error(`Requested file ${message.fileId} not found`);
        }
      } else if (message.type === 'file-offer') {
        // Sender is offering a file — present accept/decline UI to user
        if (this.onFileOffered) {
          this.onFileOffered({
            peerId,
            fileId: message.fileId,
            name: message.name,
            size: message.size,
            mimeType: message.mimeType,
            sender: message.sender || { username: 'Peer', emoji: '👤' }
          });
        } else {
          console.warn('No onFileOffered handler set; auto-declining');
          this.respondToOffer(peerId, message.fileId, false);
        }
      } else if (message.type === 'file-offer-response') {
        // Receiver accepted or declined our offer
        const pending = this.pendingSends.get(message.fileId);
        if (pending) {
          this.pendingSends.delete(message.fileId);
          if (message.accepted) {
            if (pending.onProgress) {
              pending.onProgress({ type: 'accepted', fileName: pending.file.name });
            }
            this.sendFileWithId(
              pending.peerId,
              pending.file,
              message.fileId,
              pending.onProgress,
              () => pending.resolve && pending.resolve()
            );
          } else {
            console.log(`Peer ${peerId} declined file: ${pending.file.name}`);
            if (pending.onProgress) {
              pending.onProgress({ type: 'declined', fileName: pending.file.name });
            }
            pending.reject && pending.reject(new Error('Peer declined the file'));
          }
        }
      } else if (message.type === 'file-metadata') {
        // Initialize file reception
        this.receivingFiles.set(message.fileId, {
          name: message.name,
          size: message.size,
          type: message.mimeType,
          chunks: [],
          receivedSize: 0,
          totalChunks: message.totalChunks,
          sender: message.sender || null
        });

        // Notify about starting to receive
        if (this.onProgressUpdate) {
          this.onProgressUpdate({
            type: 'receiving',
            peerId,
            fileName: message.name,
            sender: message.sender || null,
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
              this.onFileReceived(fileInfo.name, blob, peerId, {
                sender: fileInfo.sender,
                size: fileInfo.size,
                mimeType: fileInfo.type
              });
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

    return new Promise((resolve, reject) => {
      const timeoutMs = 120000;
      const timeoutId = setTimeout(() => {
        if (this.pendingSends.has(fileId)) {
          this.pendingSends.delete(fileId);
          reject(new Error('Peer did not respond to file offer'));
        }
      }, timeoutMs);

      this.pendingSends.set(fileId, {
        file,
        peerId,
        onProgress,
        resolve: () => { clearTimeout(timeoutId); resolve(); },
        reject: (err) => { clearTimeout(timeoutId); reject(err); }
      });

      try {
        dataChannel.send(JSON.stringify({
          type: 'file-offer',
          fileId,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          sender: {
            userId: this.userId,
            username: this.username,
            emoji: this.emoji
          }
        }));
      } catch (e) {
        clearTimeout(timeoutId);
        this.pendingSends.delete(fileId);
        reject(e);
      }
    });
  }

  async sendFileWithId(peerId, file, fileId, onProgress, onComplete) {
    const dataChannel = this.dataChannels.get(peerId);

    if (!dataChannel || dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    const CHUNK_SIZE = 16384; // 16KB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // Send file metadata (includes sender so receiver UI can show who it's from)
    dataChannel.send(JSON.stringify({
      type: 'file-metadata',
      fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      totalChunks,
      sender: {
        userId: this.userId,
        username: this.username,
        emoji: this.emoji
      }
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
        if (onComplete) onComplete();
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

      const sent = this.sendSignal({
        type: 'offer',
        target: peerId,
        offer: offer
      });
      if (!sent) {
        throw new Error('Signaling channel not ready');
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

      const sent = this.sendSignal({
        type: 'answer',
        target: peerId,
        answer: answer
      });
      if (!sent) {
        console.warn('Signaling channel not ready. Answer not sent.');
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

    this.wsConnected = false;

    if (this.broadcastChannel) {
      this.broadcastPresence({ type: 'presence-leave' });
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
  }

  enableBroadcastSignaling() {
    if (typeof BroadcastChannel === 'undefined') {
      return false;
    }
    if (!isOfflineMode()) {
      return false;
    }
    if (this.broadcastChannel) {
      return true;
    }

    console.log('Using BroadcastChannel signaling');
    this.broadcastChannel = new BroadcastChannel('unishare-signal');
    this.broadcastChannel.onmessage = (event) => {
      this.handleBroadcastMessage(event.data);
    };

    this.startPresenceLoop();
    this.broadcastPresence();
    this.broadcastChannel.postMessage({
      type: 'presence-request',
      sender: this.userId
    });

    return true;
  }

  startPresenceLoop() {
    if (this.presenceInterval) return;
    this.presenceInterval = setInterval(() => {
      this.broadcastPresence();
      this.pruneBroadcastPeers();
    }, 5000);
  }

  broadcastPresence(extra = {}) {
    if (!this.broadcastChannel) return;
    const payload = {
      type: 'presence',
      sender: this.userId,
      username: this.username || 'Anonymous',
      emoji: this.emoji || '👤',
      timestamp: Date.now(),
      ...extra
    };
    this.broadcastChannel.postMessage(payload);
  }

  pruneBroadcastPeers() {
    const now = Date.now();
    let changed = false;
    for (const [id, info] of this.broadcastPeers.entries()) {
      if (now - info.lastSeen > 15000) {
        this.broadcastPeers.delete(id);
        changed = true;
      }
    }
    if (changed) {
      this.updateOnlineUsersFromBroadcast();
    }
  }

  updateOnlineUsersFromBroadcast() {
    if (this.wsConnected) return;
    this.onlineUsers = Array.from(this.broadcastPeers.values());
    if (this.onOnlineUsersChange) {
      this.onOnlineUsersChange(this.onlineUsers);
    }
  }

  handleBroadcastMessage(message) {
    if (!message || typeof message !== 'object') return;

    if (message.type === 'presence-request') {
      if (message.sender !== this.userId) {
        this.broadcastPresence();
      }
      return;
    }

    if (message.type === 'presence' || message.type === 'presence-leave') {
      if (this.wsConnected) return;
      if (message.sender === this.userId) return;
      if (message.type === 'presence-leave') {
        this.broadcastPeers.delete(message.sender);
        this.updateOnlineUsersFromBroadcast();
        return;
      }

      this.broadcastPeers.set(message.sender, {
        id: message.sender,
        username: message.username || 'Anonymous',
        emoji: message.emoji || '👤',
        lastSeen: message.timestamp || Date.now()
      });
      this.updateOnlineUsersFromBroadcast();
      return;
    }

    if (message.sender && message.sender === this.userId) {
      return;
    }

    if (message.target && message.target !== this.userId) {
      return;
    }

    this.handleSignalPayload(message);
  }

  handleSignalPayload(data) {
    if (!data || !data.type) return;
    switch (data.type) {
      case 'online_users':
        this.onlineUsers = data.users.filter(u => u.id !== this.userId);
        if (this.onOnlineUsersChange) {
          this.onOnlineUsersChange(this.onlineUsers);
        }
        break;

      case 'offer':
        this.handleOffer(data.sender, data.offer);
        break;

      case 'answer':
        this.handleAnswer(data.sender, data.answer);
        break;

      case 'ice-candidate':
        this.handleIceCandidate(data.sender, data.candidate);
        break;

      default:
        break;
    }
  }

  sendSignal(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    if (this.broadcastChannel) {
      const clone = { ...payload, sender: this.userId };
      if (clone.candidate && typeof clone.candidate.toJSON === 'function') {
        clone.candidate = clone.candidate.toJSON();
      }
      this.broadcastChannel.postMessage(clone);
      return true;
    }
    return false;
  }

  isSignalingReady() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return true;
    if (this.broadcastChannel) return true;
    return false;
  }

  waitForDataChannelOpen(peerId, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const dataChannel = this.dataChannels.get(peerId);
      if (!dataChannel) {
        reject(new Error('Data channel does not exist'));
        return;
      }
      if (dataChannel.readyState === 'open') {
        resolve();
        return;
      }

      const existingOnOpen = dataChannel.onopen;
      const timer = setTimeout(() => {
        dataChannel.onopen = existingOnOpen;
        reject(new Error('Data channel open timeout'));
      }, timeout);

      dataChannel.onopen = () => {
        clearTimeout(timer);
        dataChannel.onopen = existingOnOpen;
        if (existingOnOpen) existingOnOpen();
        resolve();
      };
    });
  }
}

// Export singleton instance
const webrtcManager = new WebRTCManager();
export default webrtcManager;
