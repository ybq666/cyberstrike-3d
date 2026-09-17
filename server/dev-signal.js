import { WebSocketServer } from 'ws';

/**
 * 赛博前线 3D - 本地开发信令服务器 (WebRTC Signaling Server)
 * 供开发阶段双开、局域网联机调试使用，生产环境对应 Cloudflare Pages Functions
 */
export function devSignalingPlugin() {
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

  return {
    name: 'cyberstrike-dev-signaling',
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });

      server.httpServer?.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        if (url.pathname === '/api/signal') {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        }
      });

      wss.on('connection', (ws) => {
        let currentRoomId = null;
        let currentPeerId = null;

        const send = (data) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(data));
          }
        };

        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
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
                  players: new Map([[peerId, { ws, name, color }]])
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

                // 获取已有玩家列表（不含自己）
                const existingPeers = [];
                for (const [pId, pData] of room.players.entries()) {
                  existingPeers.push({
                    peerId: pId,
                    name: pData.name,
                    color: pData.color
                  });
                }

                // 加入房间
                room.players.set(peerId, { ws, name, color });

                // 响应加入成功
                send({
                  type: 'room_joined',
                  roomId,
                  peerId,
                  peers: existingPeers
                });

                // 通知房间内其他所有玩家有新玩家加入
                for (const [pId, pData] of room.players.entries()) {
                  if (pId !== peerId && pData.ws.readyState === pData.ws.OPEN) {
                    pData.ws.send(JSON.stringify({
                      type: 'peer_joined',
                      peer: { peerId, name, color }
                    }));
                  }
                }
                break;
              }

              case 'signal': {
                // WebRTC 信令中继：将 SDP offer/answer 或 ICE 候选转发给指定对端
                const { targetPeerId, data } = msg;
                if (!currentRoomId) return;
                const room = rooms.get(currentRoomId);
                if (!room) return;

                const target = room.players.get(targetPeerId);
                if (target && target.ws.readyState === target.ws.OPEN) {
                  target.ws.send(JSON.stringify({
                    type: 'signal',
                    fromPeerId: currentPeerId,
                    data
                  }));
                }
                break;
              }

              case 'leave_room': {
                cleanupCurrentPeer();
                break;
              }
            }
          } catch (err) {
            console.error('[Signaling Server Error]', err);
          }
        });

        const cleanupCurrentPeer = () => {
          if (!currentRoomId || !currentPeerId) return;
          const room = rooms.get(currentRoomId);
          if (room) {
            room.players.delete(currentPeerId);

            // 广播离开通知
            for (const [, pData] of room.players.entries()) {
              if (pData.ws.readyState === pData.ws.OPEN) {
                pData.ws.send(JSON.stringify({
                  type: 'peer_left',
                  peerId: currentPeerId
                }));
              }
            }

            // 若房间已空，回收房间
            if (room.players.size === 0) {
              rooms.delete(currentRoomId);
            }
          }
          currentRoomId = null;
          currentPeerId = null;
        };

        ws.on('close', cleanupCurrentPeer);
        ws.on('error', cleanupCurrentPeer);
      });

      console.log('🚀 [Cyberstrike Dev Signaling] 本地 WebRTC 信令服务已就绪 (/api/signal)');
    }
  };
}
