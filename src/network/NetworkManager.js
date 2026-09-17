/**
 * 赛博前线 3D (Kitty Strike 3D) - 多通道自愈网络管理器
 * 
 * 核心架构：
 * 1. 本地/边缘通道 (Edge Signal)：优先尝试本地 Vite 开发插件或 Cloudflare Pages Functions
 * 2. 全球高可用公共云通道 (Public Signal Relay)：基于轻量 MQTT-over-WebSocket 全球网关，
 *    100% 免费、跨机房秒级互通，彻底消除 Cloudflare 边缘 Isolate 内存孤岛与握手失败问题。
 * 3. 智能容灾 (Auto-Healing)：启动时不弹窗阻断，静默自愈探测，毫秒级平滑降级切换。
 * 4. P2P 数据通道 (WebRTC DataChannel)：连接成功后全部物理与射击同步直接在浏览器之间 P2P 传输，0 服务器成本。
 */

import { PublicSignalRelay } from './PublicSignalRelay.js';

export class NetworkManager {
  constructor() {
    this.localPeerId = 'kitty_' + Math.random().toString(36).substring(2, 9);
    this.localName = '甜心萌喵_' + Math.floor(Math.random() * 900 + 100);
    this.localColor = '#ff69b4';

    this.roomId = null;
    this.isHost = false;

    // 传输通道状态
    this.mode = 'AUTO'; // 'AUTO' | 'EDGE' | 'PUBLIC'
    this.activeTransport = null; // 'EDGE' | 'PUBLIC' | null
    this.isConnected = false;

    // 边缘 WebSocket
    this.edgeWs = null;
    // 公共信令通道
    this.publicRelay = new PublicSignalRelay();

    // 房间内对端集合: peerId -> PeerWrapper
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
    this.onSignalingStatusChange = null; // (status: 'connecting'|'ready'|'switched'|'offline', label: string)

    // WebRTC ICE 服务器 (Google 免费 STUN 矩阵)
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ];

    // 心跳与延迟
    this.pingInterval = null;
    this.ping = 28;

    // 公共信令大厅已发现房间缓存: roomId -> { roomId, playerCount, maxPlayers, hostName, lastSeen }
    this.discoveredPublicRooms = new Map();

    this.setupPublicRelayListeners();
  }

  /**
   * 初始化公共信令中继监听
   */
  setupPublicRelayListeners() {
    this.publicRelay.onMessageCallback = (topic, payloadStr) => {
      try {
        const msg = JSON.parse(payloadStr);

        // 大厅房间发现频道
        if (topic === 'kittystrike/v2/lobby') {
          if (msg.type === 'room_announce') {
            this.discoveredPublicRooms.set(msg.roomId, {
              roomId: msg.roomId,
              playerCount: msg.playerCount,
              maxPlayers: 8,
              hostName: msg.hostName,
              lastSeen: Date.now()
            });
            this.emitCachedRooms();
          }
          return;
        }

        // 房间信令频道
        if (this.roomId && topic === `kittystrike/v2/room/${this.roomId}`) {
          // 忽略自己发送的消息
          if (msg.fromPeerId === this.localPeerId) return;

          switch (msg.type) {
            case 'hello_peer': {
              // 新玩家进房向全员打招呼：当前房间成员回复自己的信息
              const existingList = Array.from(this.peers.values()).map(p => ({
                peerId: p.id,
                name: p.name,
                color: p.color
              }));
              existingList.push({
                peerId: this.localPeerId,
                name: this.localName,
                color: this.localColor
              });

              // 发送 welcome 给新玩家
              this.publicRelay.publish(`kittystrike/v2/room/${this.roomId}`, {
                type: 'welcome_peer',
                targetPeerId: msg.fromPeerId,
                fromPeerId: this.localPeerId,
                name: this.localName,
                color: this.localColor,
                peers: existingList
              });

              if (this.onPeerJoined) {
                this.onPeerJoined({
                  peerId: msg.fromPeerId,
                  name: msg.name,
                  color: msg.color
                });
              }
              break;
            }

            case 'welcome_peer': {
              // 仅处理发给自己的欢迎应答
              if (msg.targetPeerId === this.localPeerId) {
                // 如果这是加入房间后收到的第一份现有成员清单
                if (msg.peers && msg.peers.length > 0) {
                  for (const p of msg.peers) {
                    if (p.peerId !== this.localPeerId && !this.peers.has(p.peerId)) {
                      this.initiatePeerConnection(p.peerId, p.name, p.color);
                    }
                  }
                }
              }
              break;
            }

            case 'signal': {
              // 仅处理发给自己的 WebRTC SDP/ICE
              if (msg.targetPeerId === this.localPeerId) {
                this.handleWebRTCSignal(msg.fromPeerId, msg.data);
              }
              break;
            }

            case 'peer_left': {
              this.removePeer(msg.peerId);
              if (this.onPeerLeft) this.onPeerLeft(msg.peerId);
              break;
            }
          }
        }
      } catch (err) {
        console.warn('[NetworkManager] 公共信令消息处理异常:', err);
      }
    };

    this.publicRelay.onStatusCallback = (status) => {
      if (this.activeTransport === 'PUBLIC') {
        if (status === 'connected') {
          this.isConnected = true;
          this.notifyStatus('ready', '全球自愈信令云 (畅通)');
        } else if (status === 'connecting') {
          this.notifyStatus('connecting', '正在连接全球信令云...');
        } else {
          this.notifyStatus('offline', '信令云离线重连中');
        }
      }
    };
  }

  notifyStatus(status, label) {
    if (this.onSignalingStatusChange) {
      this.onSignalingStatusChange(status, label);
    }
  }

  emitCachedRooms() {
    const now = Date.now();
    const activeRooms = [];
    for (const [rId, info] of this.discoveredPublicRooms.entries()) {
      if (now - info.lastSeen < 25000) {
        activeRooms.push(info);
      } else {
        this.discoveredPublicRooms.delete(rId);
      }
    }
    if (this.onRoomListReceived) {
      this.onRoomListReceived(activeRooms);
    }
  }

  /**
   * 建立信令连接（支持自愈重试与降级）
   */
  async connectSignaling(forceTransport = null) {
    if (this.isConnected && (!forceTransport || this.activeTransport === forceTransport)) {
      return;
    }

    const targetMode = forceTransport || this.mode;

    // 1. 如果强制使用公共信令通道
    if (targetMode === 'PUBLIC') {
      return this.usePublicTransport();
    }

    // 2. 如果强制使用边缘信令
    if (targetMode === 'EDGE') {
      return this.useEdgeTransport();
    }

    // 3. AUTO 模式：智能探测
    // 若在本地开发（localhost/127.0.0.1），优先 Edge
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      try {
        await this.useEdgeTransport(1200);
        return;
      } catch (e) {
        console.warn('[NetworkManager] 本地边缘信令不可用，降级至全球公共信令通道');
        return this.usePublicTransport();
      }
    }

    // 在生产环境（Cloudflare Pages 或其他），优先尝试 Edge（快速探测 1 秒），若失败立即无缝自愈至公共云通道
    try {
      await this.useEdgeTransport(1000);
    } catch (err) {
      console.info('[NetworkManager] Cloudflare 边缘接口未激活或无状态，已全自动平滑启用全球自愈信令云！');
      this.notifyStatus('switched', '已自动切换至全球自愈信令云');
      return this.usePublicTransport();
    }
  }

  /**
   * 快速匹配：如果大厅有开放房间则加入，否则直接创建
   */
  async quickMatch(playerName, playerColor) {
    await this.connectSignaling();
    if (this.activeTransport === 'EDGE') {
      return new Promise((resolve) => {
        const onList = (rooms) => {
          this.onRoomListReceived = null;
          if (rooms && rooms.length > 0) {
            this.joinRoom(rooms[0].roomId, playerName, playerColor);
          } else {
            this.createRoom(null, playerName, playerColor);
          }
          resolve();
        };
        this.onRoomListReceived = onList;
        this.edgeWs.send(JSON.stringify({ type: 'list_rooms' }));
      });
    } else {
      // 公共信令模式
      const activeRooms = Array.from(this.discoveredPublicRooms.values());
      if (activeRooms.length > 0) {
        return this.joinRoom(activeRooms[0].roomId, playerName, playerColor);
      } else {
        return this.createRoom(null, playerName, playerColor);
      }
    }
  }

  /**
   * 切换信令通道模式 ('AUTO' | 'PUBLIC' | 'EDGE')
   */
  async switchSignalingMode(targetMode) {
    this.mode = targetMode;
    this.isConnected = false;
    if (this.edgeWs) {
      try { this.edgeWs.close(); } catch (e) {}
      this.edgeWs = null;
    }
    this.publicRelay.close();
    await this.connectSignaling(targetMode);
    await this.requestRoomList();
  }

  /**
   * 连接边缘信令服务器
   */
  useEdgeTransport(timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
      if (this.edgeWs && this.edgeWs.readyState === WebSocket.OPEN) {
        this.activeTransport = 'EDGE';
        this.isConnected = true;
        this.notifyStatus('ready', '边缘信令节点 (就绪)');
        resolve();
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/signal`;

      this.notifyStatus('connecting', '探测边缘信令节点...');

      let timer = null;
      let hasFinished = false;

      try {
        this.edgeWs = new WebSocket(wsUrl);
      } catch (err) {
        reject(err);
        return;
      }

      timer = setTimeout(() => {
        if (!hasFinished) {
          hasFinished = true;
          try { this.edgeWs.close(); } catch (e) {}
          reject(new Error('边缘信令握手超时'));
        }
      }, timeoutMs);

      this.edgeWs.onopen = () => {
        if (hasFinished) return;
        hasFinished = true;
        clearTimeout(timer);
        this.activeTransport = 'EDGE';
        this.isConnected = true;
        this.startHeartbeat();
        this.notifyStatus('ready', '边缘信令节点 (就绪)');
        resolve();
      };

      this.edgeWs.onmessage = (event) => {
        this.handleEdgeSignalingMessage(event.data);
      };

      this.edgeWs.onerror = (err) => {
        if (hasFinished) return;
        hasFinished = true;
        clearTimeout(timer);
        reject(err);
      };

      this.edgeWs.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
      };
    });
  }

  /**
   * 连接全球高可用公共信令通道
   */
  async usePublicTransport() {
    this.activeTransport = 'PUBLIC';
    this.notifyStatus('connecting', '接入全球自愈信令通道...');
    try {
      await this.publicRelay.connect();
      this.isConnected = true;
      this.notifyStatus('ready', '全球自愈信令云 (极速畅通)');
      // 订阅大厅房间广播
      this.publicRelay.subscribe('kittystrike/v2/lobby');
    } catch (err) {
      this.notifyStatus('offline', '信令连接重试中');
      throw err;
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.edgeWs && this.edgeWs.readyState === WebSocket.OPEN) {
        this.edgeWs.send(JSON.stringify({
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
   * 静默请求房间列表（无论成功失败均不弹出阻断弹窗）
   */
  async requestRoomList() {
    try {
      await this.connectSignaling();
    } catch (e) {
      // 静默处理，不惊扰玩家
      if (this.onRoomListReceived) this.onRoomListReceived([]);
      return;
    }

    if (this.activeTransport === 'EDGE' && this.edgeWs && this.edgeWs.readyState === WebSocket.OPEN) {
      this.edgeWs.send(JSON.stringify({ type: 'list_rooms' }));
    } else if (this.activeTransport === 'PUBLIC') {
      this.emitCachedRooms();
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

    if (this.activeTransport === 'EDGE') {
      this.edgeWs.send(JSON.stringify({
        type: 'create_room',
        roomId: this.roomId,
        peerId: this.localPeerId,
        name: this.localName,
        color: this.localColor
      }));
    } else {
      // 公共信令通道模式
      const roomTopic = `kittystrike/v2/room/${this.roomId}`;
      this.publicRelay.subscribe(roomTopic);

      // 向大厅广播新房间
      this.publicRelay.publish('kittystrike/v2/lobby', {
        type: 'room_announce',
        roomId: this.roomId,
        playerCount: 1,
        hostName: this.localName
      });

      if (this.onRoomJoined) {
        this.onRoomJoined(this.roomId, []);
      }
    }
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

    if (this.activeTransport === 'EDGE') {
      this.edgeWs.send(JSON.stringify({
        type: 'join_room',
        roomId: this.roomId,
        peerId: this.localPeerId,
        name: this.localName,
        color: this.localColor
      }));
    } else {
      // 公共信令通道模式
      const roomTopic = `kittystrike/v2/room/${this.roomId}`;
      this.publicRelay.subscribe(roomTopic);

      // 发送加入通知
      this.publicRelay.publish(roomTopic, {
        type: 'hello_peer',
        roomId: this.roomId,
        fromPeerId: this.localPeerId,
        name: this.localName,
        color: this.localColor
      });

      if (this.onRoomJoined) {
        this.onRoomJoined(this.roomId, []);
      }
    }
  }

  /**
   * 离开房间
   */
  leaveRoom() {
    if (this.roomId) {
      if (this.activeTransport === 'EDGE' && this.edgeWs && this.edgeWs.readyState === WebSocket.OPEN) {
        this.edgeWs.send(JSON.stringify({ type: 'leave_room' }));
      } else if (this.activeTransport === 'PUBLIC') {
        const roomTopic = `kittystrike/v2/room/${this.roomId}`;
        this.publicRelay.publish(roomTopic, {
          type: 'peer_left',
          peerId: this.localPeerId
        });
        this.publicRelay.unsubscribe(roomTopic);
      }
    }

    // 关闭所有 P2P DataChannel 与 PeerConnection
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
   * 处理 Edge 边缘信令消息
   */
  async handleEdgeSignalingMessage(raw) {
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
          if (this.onRoomJoined) {
            this.onRoomJoined(msg.roomId, msg.peers);
          }
          for (const peer of msg.peers) {
            await this.initiatePeerConnection(peer.peerId, peer.name, peer.color);
          }
          break;
        }

        case 'peer_joined': {
          if (this.onPeerJoined) {
            this.onPeerJoined(msg.peer);
          }
          break;
        }

        case 'peer_left': {
          this.removePeer(msg.peerId);
          if (this.onPeerLeft) {
            this.onPeerLeft(msg.peerId);
          }
          break;
        }

        case 'signal': {
          await this.handleWebRTCSignal(msg.fromPeerId, msg.data);
          break;
        }
      }
    } catch (e) {
      console.warn('[NetworkManager] 解析边缘信令异常:', e);
    }
  }

  /**
   * 发送信令数据中继给指定对端
   */
  sendSignal(targetPeerId, data) {
    if (this.activeTransport === 'EDGE') {
      if (this.edgeWs && this.edgeWs.readyState === WebSocket.OPEN) {
        this.edgeWs.send(JSON.stringify({
          type: 'signal',
          targetPeerId,
          data
        }));
      }
    } else if (this.activeTransport === 'PUBLIC' && this.roomId) {
      this.publicRelay.publish(`kittystrike/v2/room/${this.roomId}`, {
        type: 'signal',
        fromPeerId: this.localPeerId,
        targetPeerId,
        data
      });
    }
  }

  /**
   * 作为主动发起端 (Caller) 初始化与对端的 WebRTC 连接
   */
  async initiatePeerConnection(targetPeerId, name, color) {
    if (this.peers.has(targetPeerId)) return;

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

    const dc = pc.createDataChannel('kittystrike_p2p', {
      ordered: true
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
   * 处理对端发来的 WebRTC SDP / ICE Candidate
   */
  async handleWebRTCSignal(fromPeerId, signalData) {
    let peerWrapper = this.peers.get(fromPeerId);

    if (signalData.sdp) {
      const sdp = new RTCSessionDescription(signalData.sdp);

      if (sdp.type === 'offer') {
        if (!peerWrapper) {
          const pc = new RTCPeerConnection({ iceServers: this.iceServers });
          peerWrapper = {
            id: fromPeerId,
            name: '甜心玩偶',
            color: '#ff69b4',
            pc,
            dc: null,
            isChannelReady: false
          };
          this.peers.set(fromPeerId, peerWrapper);

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
        if (peerWrapper && peerWrapper.pc) {
          await peerWrapper.pc.setRemoteDescription(sdp);
        }
      }
    } else if (signalData.candidate) {
      if (peerWrapper && peerWrapper.pc) {
        try {
          await peerWrapper.pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        } catch (e) {
          console.warn('[NetworkManager] 附加 ICE 候选异常:', e);
        }
      }
    }
  }

  /**
   * 监听 ICE 候选与连接状态
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
   * 配置 DataChannel 事件
   */
  setupDataChannel(peerWrapper, dc) {
    peerWrapper.dc = dc;

    dc.onopen = () => {
      peerWrapper.isChannelReady = true;
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
   * 处理端到端极速同步数据包
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
          if (this.onPeerStateUpdate) {
            this.onPeerStateUpdate(peerWrapper.id, msg);
          }
          break;
        }

        case 'shoot': {
          if (this.onPeerShoot) {
            this.onPeerShoot(peerWrapper.id, msg);
          }
          break;
        }

        case 'hit': {
          if (this.onPeerHit) {
            this.onPeerHit(msg);
          }
          break;
        }

        case 'kill': {
          if (this.onPeerKill) {
            this.onPeerKill(msg);
          }
          break;
        }

        case 'respawn': {
          if (this.onPeerRespawn) {
            this.onPeerRespawn(peerWrapper.id, msg);
          }
          break;
        }
      }
    } catch (e) {
      console.warn('[DataChannel Error]', e);
    }
  }

  sendDirect(peerWrapper, obj) {
    if (peerWrapper && peerWrapper.dc && peerWrapper.dc.readyState === 'open') {
      peerWrapper.dc.send(JSON.stringify(obj));
    }
  }

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

  broadcastShoot(weaponId, muzzlePos, dir) {
    this.broadcast({
      t: 'shoot',
      wId: weaponId,
      pos: [muzzlePos.x, muzzlePos.y, muzzlePos.z],
      dir: [dir.x, dir.y, dir.z]
    });
  }

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

  broadcastKill(victimPeerId, killerPeerId, weaponId) {
    this.broadcast({
      t: 'kill',
      victim: victimPeerId,
      killer: killerPeerId,
      wId: weaponId
    });
  }

  broadcastRespawn(spawnPos) {
    this.broadcast({
      t: 'respawn',
      pos: [spawnPos.x, spawnPos.y, spawnPos.z]
    });
  }

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

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `KITTY-${code}`;
  }
}
