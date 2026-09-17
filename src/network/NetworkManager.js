/**
 * 赛博前线 3D - 网络管理器 (WebRTC P2P Mesh Network Manager)
 * 负责通过 Cloudflare Pages Functions 边缘信令建立玩家间端到端 WebRTC 直连，
 * 实现 0 服务器中继开销、超低延迟的物理同步与 PvP 枪战。
 */

export class NetworkManager {
  constructor() {
    this.localPeerId = 'p_' + Math.random().toString(36).substring(2, 9);
    this.localName = '甜心萌喵_' + Math.floor(Math.random() * 900 + 100);
    this.localColor = '#ff69b4'; // 默认草莓粉色

    this.roomId = null;
    this.isHost = false;
    this.ws = null;
    this.isConnected = false;

    // 连接的玩家集合: peerId -> PeerConnectionWrapper
    this.peers = new Map();

    // 状态广播频率控制 (30 Hz)
    this.lastBroadcastTime = 0;
    this.broadcastInterval = 1000 / 30;

    // 回调事件钩子
    this.onRoomJoined = null;       // (roomId, existingPeers)
    this.onPeerJoined = null;       // (peerData)
    this.onPeerLeft = null;         // (peerId)
    this.onPeerStateUpdate = null;  // (peerId, state)
    this.onPeerShoot = null;        // (peerId, shootData)
    this.onPeerHit = null;          // (hitData)
    this.onPeerKill = null;         // (killData)
    this.onPeerRespawn = null;      // (peerId, respawnData)
    this.onRoomListReceived = null; // (rooms)
    this.onError = null;            // (errorMsg)

    // WebRTC ICE 服务器 (Google 免费公用 STUN)
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' }
    ];

    // 心跳检测
    this.pingInterval = null;
    this.ping = 0;
  }

  /**
   * 连接信令服务器并等待连接建立
   */
  connectSignaling() {
    return new Promise((resolve, reject) => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        resolve();
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/signal`;

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (err) {
        reject(new Error(`无法连接信令服务: ${err.message}`));
        return;
      }

      this.ws.onopen = () => {
        this.isConnected = true;
        this.startHeartbeat();
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleSignalingMessage(event.data);
      };

      this.ws.onerror = (err) => {
        console.error('[NetworkManager] 信令服务连接错误:', err);
        if (this.onError) this.onError('无法连接网络信令服务器');
        reject(err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
      };
    });
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'ping',
          timestamp: performance.now()
        }));
      }
    }, 4000);
  }

  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * 请求公开房间列表
   */
  async requestRoomList() {
    await this.connectSignaling();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'list_rooms' }));
    }
  }

  /**
   * 创建新房间
   */
  async createRoom(roomId, playerName, playerColor) {
    await this.connectSignaling();
    this.localName = playerName || this.localName;
    this.localColor = playerColor || this.localColor;
    this.roomId = (roomId || this.generateRoomCode()).toUpperCase();
    this.isHost = true;

    this.ws.send(JSON.stringify({
      type: 'create_room',
      roomId: this.roomId,
      peerId: this.localPeerId,
      name: this.localName,
      color: this.localColor
    }));
  }

  /**
   * 加入已有房间
   */
  async joinRoom(roomId, playerName, playerColor) {
    await this.connectSignaling();
    this.localName = playerName || this.localName;
    this.localColor = playerColor || this.localColor;
    this.roomId = roomId.trim().toUpperCase();
    this.isHost = false;

    this.ws.send(JSON.stringify({
      type: 'join_room',
      roomId: this.roomId,
      peerId: this.localPeerId,
      name: this.localName,
      color: this.localColor
    }));
  }

  /**
   * 离开当前房间与对局
   */
  leaveRoom() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'leave_room' }));
    }

    // 关闭所有 P2P 连接
    for (const [, peer] of this.peers.entries()) {
      try {
        if (peer.dc) peer.dc.close();
        if (peer.pc) peer.pc.close();
      } catch (e) {}
    }
    this.peers.clear();
    this.roomId = null;
    this.isHost = false;
  }

  /**
   * 处理从信令服务器接收到的消息
   */
  async handleSignalingMessage(raw) {
    try {
      const msg = JSON.parse(raw);
      switch (msg.type) {
        case 'pong': {
          this.ping = Math.round(performance.now() - msg.timestamp);
          break;
        }

        case 'room_list': {
          if (this.onRoomListReceived) {
            this.onRoomListReceived(msg.rooms || []);
          }
          break;
        }

        case 'error': {
          if (this.onError) this.onError(msg.message);
          break;
        }

        case 'room_created': {
          if (this.onRoomJoined) {
            this.onRoomJoined(msg.roomId, []);
          }
          break;
        }

        case 'room_joined': {
          // 加入房间成功，主动作为发起方与房间内所有现有玩家建立 WebRTC 连接
          if (this.onRoomJoined) {
            this.onRoomJoined(msg.roomId, msg.peers);
          }

          for (const peer of msg.peers) {
            await this.initiatePeerConnection(peer.peerId, peer.name, peer.color);
          }
          break;
        }

        case 'peer_joined': {
          // 新玩家进入，等待该玩家发起 WebRTC Offer
          const { peer } = msg;
          if (this.onPeerJoined) {
            this.onPeerJoined(peer);
          }
          break;
        }

        case 'peer_left': {
          const { peerId } = msg;
          this.removePeer(peerId);
          if (this.onPeerLeft) {
            this.onPeerLeft(peerId);
          }
          break;
        }

        case 'signal': {
          // 收到对端的 WebRTC 信令数据 (Offer, Answer, ICE)
          await this.handleWebRTCSignal(msg.fromPeerId, msg.data);
          break;
        }
      }
    } catch (e) {
      console.error('[NetworkManager] 解析信令报文异常:', e);
    }
  }

  /**
   * 作为主动发起端 (Caller) 初始化与新 Peer 的连接
   */
  async initiatePeerConnection(targetPeerId, name, color) {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peerWrapper = {
      id: targetPeerId,
      name,
      color,
      pc,
      dc: null,
      isChannelReady: false
    };
    this.peers.set(targetPeerId, peerWrapper);

    // 创建 DataChannel
    const dc = pc.createDataChannel('cyberstrike_p2p', {
      ordered: true // 可靠且保序交付
    });
    this.setupDataChannel(peerWrapper, dc);

    this.setupPeerConnectionEvents(peerWrapper);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.sendSignal(targetPeerId, {
        sdp: pc.localDescription
      });
    } catch (err) {
      console.error('[NetworkManager] 创建 Offer 失败:', err);
    }
  }

  /**
   * 处理对端发送过来的 WebRTC SDP / ICE Candidate
   */
  async handleWebRTCSignal(fromPeerId, signalData) {
    let peerWrapper = this.peers.get(fromPeerId);

    if (signalData.sdp) {
      const sdp = new RTCSessionDescription(signalData.sdp);

      if (sdp.type === 'offer') {
        // 作为被叫端 (Callee)
        if (!peerWrapper) {
          const pc = new RTCPeerConnection({ iceServers: this.iceServers });
          peerWrapper = {
            id: fromPeerId,
            name: '战斗人员',
            color: '#ff0055',
            pc,
            dc: null,
            isChannelReady: false
          };
          this.peers.set(fromPeerId, peerWrapper);

          // Callee 等待 ondatachannel 触发
          pc.ondatachannel = (event) => {
            this.setupDataChannel(peerWrapper, event.channel);
          };

          this.setupPeerConnectionEvents(peerWrapper);
        }

        await peerWrapper.pc.setRemoteDescription(sdp);
        const answer = await peerWrapper.pc.createAnswer();
        await peerWrapper.pc.setLocalDescription(answer);

        this.sendSignal(fromPeerId, {
          sdp: peerWrapper.pc.localDescription
        });
      } else if (sdp.type === 'answer') {
        // 作为呼叫端收到 Answer
        if (peerWrapper) {
          await peerWrapper.pc.setRemoteDescription(sdp);
        }
      }
    } else if (signalData.candidate) {
      // 收到 ICE 候选
      if (peerWrapper && peerWrapper.pc) {
        try {
          await peerWrapper.pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        } catch (e) {
          console.warn('[NetworkManager] 添加 ICE 候选失败:', e);
        }
      }
    }
  }

  /**
   * 配置 PeerConnection 事件 (收集与发送 ICE)
   */
  setupPeerConnectionEvents(peerWrapper) {
    const { pc, id } = peerWrapper;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(id, {
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(id);
        if (this.onPeerLeft) this.onPeerLeft(id);
      }
    };
  }

  /**
   * 配置 WebRTC DataChannel 监听
   */
  setupDataChannel(peerWrapper, dc) {
    peerWrapper.dc = dc;

    dc.onopen = () => {
      peerWrapper.isChannelReady = true;
      // 握手包：告知对方自己的名字和颜色
      this.sendDirect(peerWrapper, {
        t: 'intro',
        name: this.localName,
        color: this.localColor
      });
    };

    dc.onclose = () => {
      peerWrapper.isChannelReady = false;
    };

    dc.onmessage = (event) => {
      this.handleDataChannelMessage(peerWrapper, event.data);
    };
  }

  /**
   * 解析对端通过 WebRTC DataChannel 极速传输的二进制/JSON 游戏报文
   */
  handleDataChannelMessage(peerWrapper, data) {
    try {
      const msg = JSON.parse(data);
      const type = msg.t;

      switch (type) {
        case 'intro': {
          peerWrapper.name = msg.name || peerWrapper.name;
          peerWrapper.color = msg.color || peerWrapper.color;
          break;
        }

        case 'state': {
          // 远程玩家位姿同步 (position, rotation, etc.)
          if (this.onPeerStateUpdate) {
            this.onPeerStateUpdate(peerWrapper.id, msg);
          }
          break;
        }

        case 'shoot': {
          // 远程玩家开火射击
          if (this.onPeerShoot) {
            this.onPeerShoot(peerWrapper.id, msg);
          }
          break;
        }

        case 'hit': {
          // 击中伤害判定
          if (this.onPeerHit) {
            this.onPeerHit(msg);
          }
          break;
        }

        case 'kill': {
          // 击杀事件
          if (this.onPeerKill) {
            this.onPeerKill(msg);
          }
          break;
        }

        case 'respawn': {
          // 玩家复活
          if (this.onPeerRespawn) {
            this.onPeerRespawn(peerWrapper.id, msg);
          }
          break;
        }
      }
    } catch (e) {
      console.error('[DataChannel Error]', e);
    }
  }

  /**
   * 发送信令中继给指定对端
   */
  sendSignal(targetPeerId, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'signal',
        targetPeerId,
        data
      }));
    }
  }

  /**
   * 直接通过 WebRTC DataChannel 单播消息给指定对端
   */
  sendDirect(peerWrapper, obj) {
    if (peerWrapper && peerWrapper.dc && peerWrapper.dc.readyState === 'open') {
      peerWrapper.dc.send(JSON.stringify(obj));
    }
  }

  /**
   * 直接通过 WebRTC DataChannel 向房间内所有已连接的玩家广播消息
   */
  broadcast(obj) {
    const json = JSON.stringify(obj);
    for (const [, peer] of this.peers.entries()) {
      if (peer.dc && peer.dc.readyState === 'open') {
        try {
          peer.dc.send(json);
        } catch (e) {}
      }
    }
  }

  /**
   * 高频广播本地玩家位姿状态 (带 30Hz 限频)
   */
  broadcastPlayerState(state) {
    const now = performance.now();
    if (now - this.lastBroadcastTime < this.broadcastInterval) return;
    this.lastBroadcastTime = now;

    this.broadcast({
      t: 'state',
      p: [
        parseFloat(state.x.toFixed(2)),
        parseFloat(state.y.toFixed(2)),
        parseFloat(state.z.toFixed(2))
      ],
      r: [
        parseFloat(state.yaw.toFixed(3)),
        parseFloat(state.pitch.toFixed(3))
      ],
      w: state.weaponIndex,
      m: state.isMoving ? 1 : 0,
      j: state.isJumping ? 1 : 0
    });
  }

  /**
   * 广播开火射击事件
   */
  broadcastShoot(weaponId, muzzlePos, dir) {
    this.broadcast({
      t: 'shoot',
      wId: weaponId,
      pos: [muzzlePos.x, muzzlePos.y, muzzlePos.z],
      dir: [dir.x, dir.y, dir.z]
    });
  }

  /**
   * 广播击中判定
   */
  broadcastHit(targetPeerId, damage, isCrit, hitPos) {
    this.broadcast({
      t: 'hit',
      target: targetPeerId,
      attacker: this.localPeerId,
      dmg: damage,
      crit: isCrit ? 1 : 0,
      pos: [hitPos.x, hitPos.y, hitPos.z]
    });
  }

  /**
   * 广播击杀事件
   */
  broadcastKill(victimPeerId, killerPeerId, weaponId) {
    this.broadcast({
      t: 'kill',
      victim: victimPeerId,
      killer: killerPeerId,
      wId: weaponId
    });
  }

  /**
   * 广播复活事件
   */
  broadcastRespawn(spawnPos) {
    this.broadcast({
      t: 'respawn',
      pos: [spawnPos.x, spawnPos.y, spawnPos.z]
    });
  }

  /**
   * 移除离线或断开的对端
   */
  removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (peer) {
      try {
        if (peer.dc) peer.dc.close();
        if (peer.pc) peer.pc.close();
      } catch (e) {}
      this.peers.delete(peerId);
    }
  }

  /**
   * 随机生成 6 位易记房间码 (如 CYBER-8K2A)
   */
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `CYBER-${code}`;
  }
}
