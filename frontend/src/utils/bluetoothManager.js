class BluetoothManager {
  constructor() {
    this.device = null;
    this.characteristic = null;
    this.SERVICE_UUID = '12345678-1234-1234-1234-123456789012';
    this.CHARACTERISTIC_UUID = '87654321-4321-4321-4321-210987654321';
  }

  isSupported() {
    return 'bluetooth' in navigator;
  }

  async requestDevice() {
    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [this.SERVICE_UUID] }],
        optionalServices: [this.SERVICE_UUID]
      });
      
      const server = await this.device.gatt.connect();
      const service = await server.getPrimaryService(this.SERVICE_UUID);
      this.characteristic = await service.getCharacteristic(this.CHARACTERISTIC_UUID);
      
      return this.device;
    } catch (error) {
      console.error('Bluetooth connection error:', error);
      throw error;
    }
  }

  async sendFile(file, onProgress) {
    if (!this.characteristic) {
      throw new Error('No Bluetooth device connected');
    }

    const chunkSize = 512; // Bluetooth has smaller MTU
    const fileReader = new FileReader();
    let offset = 0;

    // Send metadata
    const metadata = JSON.stringify({
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    const encoder = new TextEncoder();
    await this.characteristic.writeValue(encoder.encode(metadata));

    return new Promise((resolve, reject) => {
      const readSlice = () => {
        const slice = file.slice(offset, offset + chunkSize);
        fileReader.readAsArrayBuffer(slice);
      };

      fileReader.onload = async (e) => {
        try {
          await this.characteristic.writeValue(e.target.result);
          offset += e.target.result.byteLength;

          if (onProgress) {
            onProgress(offset, file.size);
          }

          if (offset < file.size) {
            readSlice();
          } else {
            // Send completion signal
            await this.characteristic.writeValue(encoder.encode('DONE'));
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      };

      fileReader.onerror = reject;
      readSlice();
    });
  }

  async disconnect() {
    if (this.device && this.device.gatt.connected) {
      await this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
  }
}

export default new BluetoothManager();
