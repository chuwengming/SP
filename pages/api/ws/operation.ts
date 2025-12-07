import { NextApiRequest } from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { 
  addWsClient, 
  removeWsClient, 
  handleWsMessage,
  setMqttClient,
  getMqttClient
} from '@/lib/mqtt-operation';

// 全域 WebSocket 伺服器實例
let wss: WebSocketServer | null = null;

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: NextApiRequest, res: any) {
  if (!res.socket.server.wss) {
    console.log('🔧 初始化 WebSocket 伺服器...');
    
    wss = new WebSocketServer({ noServer: true });

    res.socket.server.wss = wss;

    wss.on('connection', (ws: WebSocket) => {
      console.log('✅ 新的 WebSocket 連線');
      
      // 添加客戶端
      addWsClient(ws);

      // 處理訊息
      ws.on('message', (message: Buffer) => {
        const msg = message.toString();
        console.log('📨 收到訊息:', msg);
        handleWsMessage(msg, ws);
      });

      // 處理斷線
      ws.on('close', () => {
        console.log('❌ WebSocket 連線關閉');
        removeWsClient(ws);
      });

      // 處理錯誤
      ws.on('error', (error) => {
        console.error('❌ WebSocket 錯誤:', error);
        removeWsClient(ws);
      });
    });

    // 處理升級請求
    res.socket.server.on('upgrade', (request: any, socket: any, head: any) => {
      if (request.url === '/api/ws/operation') {
        wss?.handleUpgrade(request, socket, head, (ws) => {
          wss?.emit('connection', ws, request);
        });
      }
    });
  }

  // 檢查 MQTT 連線狀態
  const mqttClient = getMqttClient();
  const connected = mqttClient?.connected || false;

  res.status(200).json({ 
    status: 'WebSocket server is running',
    mqttConnected: connected
  });
}