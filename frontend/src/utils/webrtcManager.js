import Peer from 'simple-peer';

class WebRTCManager {
  constructor() {
    this.peers = {};
    this.ws = null;
    this.userId = null;
    this.onFileReceived = null;
    this.onTransferProgress = null;
  }

  connect(userId, backendUrl) {
    this.userId = userId;
    const wsUrl = backendUrl.replace('http', 'ws');
    this.ws = new WebSocket(`${wsUrl}/api/ws/${userId}`);
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleSignaling(message);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    Object.values(this.peers).forEach(peer => peer.destroy());
    this.peers = {};
  }

  async sendFile(targetUserId, file) {
    return new Promise((resolve, reject) => {
      const peer = new Peer({ initiator: true, trickle: false });
      this.peers[targetUserId] = peer;

      peer.on('signal', (signal) => {
        this.sendSignal(targetUserId, 'offer', signal);
      });

      peer.on('connect', () => {
        console.log('Peer connection established');
        this.transferFile(peer, file, resolve);
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        reject(err);
      });
    });
  }

  transferFile(peer, file, callback) {
    const chunkSize = 16384; // 16KB chunks
    const fileReader = new FileReader();
    let offset = 0;

    // Send file metadata first
    peer.send(JSON.stringify({
      type: 'metadata',
      name: file.name,
      size: file.size,
      mimeType: file.type
    }));

    const readSlice = () => {
      const slice = file.slice(offset, offset + chunkSize);
      fileReader.readAsArrayBuffer(slice);
    };

    fileReader.onload = (e) => {
      peer.send(e.target.result);
      offset += e.target.result.byteLength;

      if (this.onTransferProgress) {
        this.onTransferProgress(offset, file.size);
      }

      if (offset < file.size) {
        readSlice();
      } else {
        peer.send(JSON.stringify({ type: 'done' }));
        callback();
      }
    };

    readSlice();
  }

  handleSignaling(message) {
    const { from, type, data } = message;

    if (type === 'offer') {
      const peer = new Peer({ initiator: false, trickle: false });
      this.peers[from] = peer;

      peer.on('signal', (signal) => {
        this.sendSignal(from, 'answer', signal);
      });

      peer.on('data', (data) => {
        this.handleData(from, data);
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
      });

      peer.signal(data);
    } else if (type === 'answer') {
      if (this.peers[from]) {
        this.peers[from].signal(data);
      }
    }
  }

  handleData(peerId, data) {
    if (typeof data === 'string') {
      try {
        const message = JSON.parse(data);
        if (message.type === 'metadata') {
          this.currentTransfer = {
            name: message.name,
            size: message.size,
            mimeType: message.mimeType,
            chunks: []
          };
        } else if (message.type === 'done' && this.currentTransfer) {
          const blob = new Blob(this.currentTransfer.chunks, {
            type: this.currentTransfer.mimeType
          });
          
          if (this.onFileReceived) {
            this.onFileReceived(this.currentTransfer.name, blob);
          }
          
          this.currentTransfer = null;
        }
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    } else if (this.currentTransfer) {
      this.currentTransfer.chunks.push(data);
    }
  }

  sendSignal(targetUserId, type, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        target: targetUserId,
        type,
        data
      }));
    }
  }
}

export default new WebRTCManager();
