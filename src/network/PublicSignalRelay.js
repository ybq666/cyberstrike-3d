/**
 * 全球高可用公共信令通道 (PublicSignalRelay)
 * 基于原生轻量 MQTT 3.1.1 over WebSocket，零依赖第三方庞大类库。
 * 连接全球免费公共高可用网关 (EMQX / HiveMQ)，负责房间信令广播与 WebRTC 穿透握手。
 * 具有 100% 永久免费、免维护、全球多地瞬间连通、完全不受边缘机房隔离限制等优势。
 */

export class PublicSignalRelay {
  constructor() {
    this.clientId = 'kitty_' + Math.random().toString(36).substring(2, 10);
    this.ws = null;
    this.isConnected = false;
    this.packetId = 1;

    // 默认高可用公共 Broker 列表（按优先级尝试）
    this.brokerEndpoints = [
      'wss://broker.emqx.io:8084/mqtt',
      'wss://broker.hivemq.com:8884/mqtt'
    ];
    this.currentBrokerIndex = 0;

    this.subscribedTopics = new Set();
    this.onMessageCallback = null; // (topic, payload)
    this.onStatusCallback = null;  // (status, detail)
    this.pingTimer = null;
    this.reconnectTimer = null;
    this.isExplicitClosed = false;
  }

  /**
   * 编码 UTF-8 字符串为 Uint8Array（带 2 字节大端长度前缀）
   */
  encodeUtf8String(str) {
    const bytes = new TextEncoder().encode(str);
    const buf = new Uint8Array(bytes.length + 2);
    buf[0] = (bytes.length >> 8) & 0xff;
    buf[1] = bytes.length & 0xff;
    buf.set(bytes, 2);
    return buf;
  }

  /**
   * 编码 MQTT 剩余长度字段
   */
  encodeRemainingLength(length) {
    const bytes = [];
    let num = length;
    do {
      let digit = num % 128;
      num = Math.floor(num / 128);
      if (num > 0) digit |= 0x80;
      bytes.push(digit);
    } while (num > 0);
    return new Uint8Array(bytes);
  }

  /**
   * 解码 MQTT 剩余长度与读取偏移
   */
  decodeRemainingLength(data, startIndex) {
    let multiplier = 1;
    let value = 0;
    let offset = startIndex;
    let digit;
    do {
      if (offset >= data.length) return { length: 0, nextOffset: startIndex };
      digit = data[offset++];
      value += (digit & 127) * multiplier;
      multiplier *= 128;
    } while ((digit & 128) !== 0);
    return { length: value, nextOffset: offset };
  }

  /**
   * 连接公共信令网关
   */
  connect() {
    this.isExplicitClosed = false;
    return new Promise((resolve, reject) => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        if (this.isConnected) {
          resolve();
          return;
        }
      }

      const endpoint = this.brokerEndpoints[this.currentBrokerIndex];
      if (this.onStatusCallback) this.onStatusCallback('connecting', `正在连接全球公共信令网关 (${this.currentBrokerIndex + 1}/${this.brokerEndpoints.length})`);

      try {
        this.ws = new WebSocket(endpoint, ['mqttv3.1', 'mqtt']);
        this.ws.binaryType = 'arraybuffer';
      } catch (err) {
        if (this.onStatusCallback) this.onStatusCallback('error', err.message);
        this.tryNextBroker();
        reject(err);
        return;
      }

      const connectionTimeout = setTimeout(() => {
        if (!this.isConnected) {
          try { this.ws.close(); } catch (e) {}
          this.tryNextBroker();
          reject(new Error('公共信令服务连接超时'));
        }
      }, 5000);

      this.ws.onopen = () => {
        // 发送 MQTT CONNECT 握手报文
        this.sendConnectPacket();
      };

      this.ws.onmessage = (event) => {
        clearTimeout(connectionTimeout);
        this.handleIncomingData(new Uint8Array(event.data), resolve);
      };

      this.ws.onerror = (err) => {
        clearTimeout(connectionTimeout);
        console.warn('[PublicSignalRelay] 网关连接异常:', endpoint, err);
      };

      this.ws.onclose = () => {
        clearTimeout(connectionTimeout);
        this.isConnected = false;
        this.stopPing();
        if (this.onStatusCallback) this.onStatusCallback('disconnected', '信令连接断开');
        if (!this.isExplicitClosed) {
          this.scheduleReconnect();
        }
      };
    });
  }

  tryNextBroker() {
    this.currentBrokerIndex = (this.currentBrokerIndex + 1) % this.brokerEndpoints.length;
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.isConnected && !this.isExplicitClosed) {
        this.tryNextBroker();
        this.connect().then(() => {
          // 重新订阅之前的频道
          for (const topic of this.subscribedTopics) {
            this.subscribe(topic);
          }
        }).catch(() => {});
      }
    }, 3000);
  }

  sendConnectPacket() {
    // Protocol Name: "MQTT"
    const protoName = this.encodeUtf8String('MQTT');
    // Protocol Level: 4 (MQTT 3.1.1)
    const protoLevel = new Uint8Array([0x04]);
    // Connect Flags: Clean Session (0x02)
    const connectFlags = new Uint8Array([0x02]);
    // Keep Alive: 45 秒 (0x00, 0x2D)
    const keepAlive = new Uint8Array([0x00, 0x2D]);
    // Client ID
    const clientIdBytes = this.encodeUtf8String(this.clientId);

    const variableHeaderLength = protoName.length + protoLevel.length + connectFlags.length + keepAlive.length + clientIdBytes.length;
    const remainingLengthBytes = this.encodeRemainingLength(variableHeaderLength);

    const packet = new Uint8Array(1 + remainingLengthBytes.length + variableHeaderLength);
    let offset = 0;
    packet[offset++] = 0x10; // CONNECT Packet Type
    packet.set(remainingLengthBytes, offset); offset += remainingLengthBytes.length;
    packet.set(protoName, offset); offset += protoName.length;
    packet.set(protoLevel, offset); offset += protoLevel.length;
    packet.set(connectFlags, offset); offset += connectFlags.length;
    packet.set(keepAlive, offset); offset += keepAlive.length;
    packet.set(clientIdBytes, offset);

    this.ws.send(packet.buffer);
  }

  handleIncomingData(data, onConnectedResolve) {
    if (!data || data.length === 0) return;
    const packetType = data[0] >> 4;

    switch (packetType) {
      case 2: { // CONNACK (0x20)
        if (data.length >= 4 && data[3] === 0x00) {
          this.isConnected = true;
          this.startPing();
          if (this.onStatusCallback) this.onStatusCallback('connected', '已接入全球高速公共信令网关');
          if (onConnectedResolve) onConnectedResolve();
        }
        break;
      }

      case 3: { // PUBLISH (0x30)
        // 解析 Topic 与 Payload (QoS 0)
        const { nextOffset } = this.decodeRemainingLength(data, 1);
        let offset = nextOffset;
        if (offset + 2 > data.length) return;

        const topicLen = (data[offset] << 8) | data[offset + 1];
        offset += 2;
        if (offset + topicLen > data.length) return;

        const topic = new TextDecoder().decode(data.subarray(offset, offset + topicLen));
        offset += topicLen;

        const payload = new TextDecoder().decode(data.subarray(offset));
        if (this.onMessageCallback) {
          this.onMessageCallback(topic, payload);
        }
        break;
      }

      case 9: { // SUBACK (0x90)
        break;
      }

      case 13: { // PINGRESP (0xD0)
        break;
      }
    }
  }

  /**
   * 订阅指定 Topic 频道
   */
  subscribe(topic) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isConnected) {
      this.subscribedTopics.add(topic);
      return;
    }

    this.subscribedTopics.add(topic);
    const topicBytes = this.encodeUtf8String(topic);
    const pId = this.packetId++;
    const packetIdBytes = new Uint8Array([(pId >> 8) & 0xff, pId & 0xff]);
    const qosByte = new Uint8Array([0x00]); // QoS 0

    const varPayloadLen = packetIdBytes.length + topicBytes.length + qosByte.length;
    const remainingLenBytes = this.encodeRemainingLength(varPayloadLen);

    const packet = new Uint8Array(1 + remainingLenBytes.length + varPayloadLen);
    let offset = 0;
    packet[offset++] = 0x82; // SUBSCRIBE Type with reserved bit
    packet.set(remainingLenBytes, offset); offset += remainingLenBytes.length;
    packet.set(packetIdBytes, offset); offset += packetIdBytes.length;
    packet.set(topicBytes, offset); offset += topicBytes.length;
    packet.set(qosByte, offset);

    this.ws.send(packet.buffer);
  }

  /**
   * 取消订阅 Topic 频道
   */
  unsubscribe(topic) {
    this.subscribedTopics.delete(topic);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isConnected) return;

    const topicBytes = this.encodeUtf8String(topic);
    const pId = this.packetId++;
    const packetIdBytes = new Uint8Array([(pId >> 8) & 0xff, pId & 0xff]);

    const varPayloadLen = packetIdBytes.length + topicBytes.length;
    const remainingLenBytes = this.encodeRemainingLength(varPayloadLen);

    const packet = new Uint8Array(1 + remainingLenBytes.length + varPayloadLen);
    let offset = 0;
    packet[offset++] = 0xa2; // UNSUBSCRIBE Type
    packet.set(remainingLenBytes, offset); offset += remainingLenBytes.length;
    packet.set(packetIdBytes, offset); offset += packetIdBytes.length;
    packet.set(topicBytes, offset);

    this.ws.send(packet.buffer);
  }

  /**
   * 向指定 Topic 广播消息 (QoS 0)
   */
  publish(topic, messageObj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isConnected) return false;

    const topicBytes = this.encodeUtf8String(topic);
    const payloadStr = typeof messageObj === 'string' ? messageObj : JSON.stringify(messageObj);
    const payloadBytes = new TextEncoder().encode(payloadStr);

    const varPayloadLen = topicBytes.length + payloadBytes.length;
    const remainingLenBytes = this.encodeRemainingLength(varPayloadLen);

    const packet = new Uint8Array(1 + remainingLenBytes.length + varPayloadLen);
    let offset = 0;
    packet[offset++] = 0x30; // PUBLISH QoS 0
    packet.set(remainingLenBytes, offset); offset += remainingLenBytes.length;
    packet.set(topicBytes, offset); offset += topicBytes.length;
    packet.set(payloadBytes, offset);

    this.ws.send(packet.buffer);
    return true;
  }

  startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isConnected) {
        // PINGREQ (0xC0, 0x00)
        this.ws.send(new Uint8Array([0xc0, 0x00]).buffer);
      }
    }, 20000);
  }

  stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  close() {
    this.isExplicitClosed = true;
    this.stopPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.isConnected = false;
    this.subscribedTopics.clear();
  }
}
