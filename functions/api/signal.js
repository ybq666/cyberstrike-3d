/**
 * Cloudflare Pages Functions - 边缘 WebRTC 信令中继服务 (/api/signal)
 * 运行于 Cloudflare 全球边缘节点，100% 免费额度。
 * 负责客户端房间加入、离开以及 WebRTC 的 SDP Offer/Answer 和 ICE 候选交换。
 */

// 边缘实例内存房间字典 (在同一边缘实例中常驻)
const rooms = new Map(); // roomId -> { id, createdAt, players: Map<peerId, { ws, name, color }> }

function getPublicRooms() {
  const list = [];
  for (const [roomId, room] of rooms.entries()) {
    if (room.players.size > 0 && room.players.size < 8) {
      const host = Array.from(room.players.values())[0];
      list.push({
        roomId,
        playerCount: room.players.size,
        maxPlayers: 8,
        hostName: host ? host.name : '未知玩家'
      });
    }
  }
  return list;
}

export async function onRequest(context) {
  const { request } = context;
  const upgradeHeader = request.headers.get('Upgrade');

  // 如果不是 WebSocket 请求，提供基础 HTTP 房间状态查询
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/list')) {
      return new Response(JSON.stringify({ rooms: getPublicRooms() }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({
      status: 'ok',
      service: 'Cyberstrike 3D Signaling Service',
      publicRooms: getPublicRooms().length
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // 接收 WebSocket 升级
  const webSocketPair = new WebSocketPair();
  const [clientWs, serverWs] = Object.values(webSocketPair);

  serverWs.accept();

  let currentRoomId = null;
  let currentPeerId = null;

  const send = (data) => {
    try {
      serverWs.send(JSON.stringify(data));
    } catch (e) {
      // 忽略关闭时的异常
    }
  };

  const cleanupCurrentPeer = () => {
    if (!currentRoomId || !currentPeerId) return;
    const room = rooms.get(currentRoomId);
    if (room) {
      room.players.delete(currentPeerId);

      // 广播给房间其他玩家
      for (const [, pData] of room.players.entries()) {
        try {
          pData.ws.send(JSON.stringify({
            type: 'peer_left',
            peerId: currentPeerId
          }));
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
              message: `房间 ${roomId} 不存在，请检查房间码或新建房间`
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
            if (pId !== peerId) {
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
          if (target) {
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
    webSocket: clientWs
  });
}
