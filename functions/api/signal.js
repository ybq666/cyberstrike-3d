/**
 * Cloudflare Pages Functions - 边缘 WebRTC 信令服务 (/api/signal)
 * 运行于 Cloudflare 全球边缘节点，100% 免费额度。
 * 双模协议支持：
 * 1. 优先 WebSocket 升级握手 (/api/signal)
 * 2. 备用 HTTP REST 轮询通道 (CORS 跨域无限制，容灾兜底)
 */

// 内存房间字典
const rooms = new Map(); // roomId -> { id, createdAt, players: Map<peerId, { ws, name, color, lastSeen }> }
// HTTP 降级消息信箱 (peerId -> Array<msg>)
const pendingHttpMessages = new Map();

function getPublicRooms() {
  const list = [];
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    // 清理超过 10 分钟无活动的空房间
    if (room.players.size === 0 && now - room.createdAt > 600000) {
      rooms.delete(roomId);
      continue;
    }
    if (room.players.size > 0 && room.players.size < 8) {
      const host = Array.from(room.players.values())[0];
      list.push({
        roomId,
        playerCount: room.players.size,
        maxPlayers: 8,
        hostName: host ? host.name : '可爱小猫'
      });
    }
  }
  return list;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Upgrade, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Extensions',
  'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
  const { request } = context;

  // 处理 CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(request.url);
  const upgradeHeader = request.headers.get('Upgrade');

  // ==========================================
  // 模式一：HTTP REST 接口 (支持轮询降级与列表查询)
  // ==========================================
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    const action = url.searchParams.get('action');

    // 1. 公开房间列表
    if (action === 'list' || url.pathname.endsWith('/list')) {
      return new Response(JSON.stringify({
        status: 'ok',
        rooms: getPublicRooms()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. HTTP 消息拉取轮询
    if (action === 'poll') {
      const peerId = url.searchParams.get('peerId');
      const queue = pendingHttpMessages.get(peerId) || [];
      pendingHttpMessages.set(peerId, []);
      return new Response(JSON.stringify({ status: 'ok', messages: queue }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. HTTP 消息投递
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        const { type } = body;

        if (type === 'create_room') {
          const { roomId, peerId, name, color } = body;
          const room = {
            id: roomId,
            createdAt: Date.now(),
            players: new Map([[peerId, { ws: null, name, color, lastSeen: Date.now() }]])
          };
          rooms.set(roomId, room);
          return new Response(JSON.stringify({ status: 'ok', type: 'room_created', roomId, peerId }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (type === 'join_room') {
          const { roomId, peerId, name, color } = body;
          const room = rooms.get(roomId);
          if (!room) {
            return new Response(JSON.stringify({ status: 'error', message: '房间不存在' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const existingPeers = [];
          for (const [pId, pData] of room.players.entries()) {
            existingPeers.push({ peerId: pId, name: pData.name, color: pData.color });
            // 通知旧玩家有新玩家加入
            const q = pendingHttpMessages.get(pId) || [];
            q.push({ type: 'peer_joined', peer: { peerId, name, color } });
            pendingHttpMessages.set(pId, q);
          }

          room.players.set(peerId, { ws: null, name, color, lastSeen: Date.now() });
          return new Response(JSON.stringify({ status: 'ok', type: 'room_joined', roomId, peerId, peers: existingPeers }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (type === 'signal') {
          const { targetPeerId, data, fromPeerId } = body;
          const q = pendingHttpMessages.get(targetPeerId) || [];
          q.push({ type: 'signal', fromPeerId, data });
          pendingHttpMessages.set(targetPeerId, q);
          return new Response(JSON.stringify({ status: 'ok' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (err) {
        return new Response(JSON.stringify({ status: 'error', message: err.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 默认健康状态返回
    return new Response(JSON.stringify({
      status: 'ok',
      service: 'Kitty Strike 3D Hybrid Signaling Service',
      version: '2.0.0',
      rooms: getPublicRooms().length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // ==========================================
  // 模式二：WebSocket 协议升级
  // ==========================================
  try {
    const webSocketPair = new WebSocketPair();
    const [clientWs, serverWs] = Object.values(webSocketPair);

    serverWs.accept();

    let currentRoomId = null;
    let currentPeerId = null;

    const send = (data) => {
      try {
        serverWs.send(JSON.stringify(data));
      } catch (e) {}
    };

    const cleanupCurrentPeer = () => {
      if (!currentRoomId || !currentPeerId) return;
      const room = rooms.get(currentRoomId);
      if (room) {
        room.players.delete(currentPeerId);

        for (const [, pData] of room.players.entries()) {
          try {
            if (pData.ws) {
              pData.ws.send(JSON.stringify({
                type: 'peer_left',
                peerId: currentPeerId
              }));
            }
          } catch (e) {}
        }

        if (room.players.size === 0) {
          rooms.delete(currentRoomId);
        }
      }
      currentRoomId = null;
      currentPeerId = null;
    };

    serverWs.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type } = msg;

        switch (type) {
          case 'ping': {
            send({ type: 'pong', timestamp: msg.timestamp });
            break;
          }

          case 'list_rooms': {
            send({
              type: 'room_list',
              rooms: getPublicRooms()
            });
            break;
          }

          case 'create_room': {
            const { roomId, peerId, name, color } = msg;
            currentRoomId = roomId;
            currentPeerId = peerId;

            const room = {
              id: roomId,
              createdAt: Date.now(),
              players: new Map([[peerId, { ws: serverWs, name, color }]])
            };
            rooms.set(roomId, room);

            send({
              type: 'room_created',
              roomId,
              peerId,
              peers: []
            });
            break;
          }

          case 'join_room': {
            const { roomId, peerId, name, color } = msg;
            const room = rooms.get(roomId);

            if (!room) {
              send({
                type: 'error',
                code: 'ROOM_NOT_FOUND',
                message: `房间 ${roomId} 不存在，请检查房间码或重新创建`
              });
              return;
            }

            if (room.players.size >= 8) {
              send({
                type: 'error',
                code: 'ROOM_FULL',
                message: `房间 ${roomId} 人数已满（上限 8 人）`
              });
              return;
            }

            currentRoomId = roomId;
            currentPeerId = peerId;

            const existingPeers = [];
            for (const [pId, pData] of room.players.entries()) {
              existingPeers.push({
                peerId: pId,
                name: pData.name,
                color: pData.color
              });
            }

            room.players.set(peerId, { ws: serverWs, name, color });

            send({
              type: 'room_joined',
              roomId,
              peerId,
              peers: existingPeers
            });

            for (const [pId, pData] of room.players.entries()) {
              if (pId !== peerId && pData.ws) {
                try {
                  pData.ws.send(JSON.stringify({
                    type: 'peer_joined',
                    peer: { peerId, name, color }
                  }));
                } catch (e) {}
              }
            }
            break;
          }

          case 'signal': {
            const { targetPeerId, data } = msg;
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;

            const target = room.players.get(targetPeerId);
            if (target && target.ws) {
              try {
                target.ws.send(JSON.stringify({
                  type: 'signal',
                  fromPeerId: currentPeerId,
                  data
                }));
              } catch (e) {}
            }
            break;
          }

          case 'leave_room': {
            cleanupCurrentPeer();
            break;
          }
        }
      } catch (err) {
        console.error('Signal message parse error', err);
      }
    });

    serverWs.addEventListener('close', cleanupCurrentPeer);
    serverWs.addEventListener('error', cleanupCurrentPeer);

    return new Response(null, {
      status: 101,
      webSocket: clientWs,
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      message: 'WebSocket 握手异常: ' + error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
