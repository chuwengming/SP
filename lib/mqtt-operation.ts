import mqtt, { MqttClient } from 'mqtt';

// MQTT 客戶端實例
let mqttClient: MqttClient | null = null;

// 儲存感測器數據
interface RelayData {
  id: number;
  name: string;
  state: boolean;
}

interface SensorData {
  temperature: number;
  relays: RelayData[];
}

let sensorData: SensorData = {
  temperature: 0,
  relays: Array.from({ length: 6 }, (_, i) => ({
    id: i,
    name: `Relay ${i + 1}`,
    state: false
  }))
};

// WebSocket 客戶端管理
const wsClients = new Set<any>();

// MQTT 主題定義
const MQTT_TOPICS = {
  TEMPERATURE: 'smartplug/temperature',
  RELAY_STATE: 'smartplug/relay/state',
  RELAY_CONTROL: 'smartplug/relay/control',
  RELAY_NAME: 'smartplug/relay/name',
  SENSOR_DATA: 'smartplug/sensor/data',
};

// 獲取 MQTT 客戶端
export function getMqttClient(): MqttClient | null {
  return mqttClient;
}

// 設置 MQTT 客戶端（從登入頁面連線後）
export function setMqttClient(client: MqttClient) {
  mqttClient = client;
  subscribeMqttTopics();
}

// 訂閱 MQTT 主題
export function subscribeMqttTopics() {
  if (!mqttClient || !mqttClient.connected) {
    console.warn('MQTT 未連線，無法訂閱主題');
    return;
  }

  // 訂閱所有相關主題
  Object.values(MQTT_TOPICS).forEach(topic => {
    mqttClient?.subscribe(topic, (err) => {
      if (!err) {
        console.log(`📩 已訂閱: ${topic}`);
      } else {
        console.error(`訂閱失敗: ${topic}`, err);
      }
    });
  });

  // 設置訊息處理
  mqttClient.on('message', handleMqttMessage);

  // 請求初始數據
  publishMqtt(MQTT_TOPICS.SENSOR_DATA, JSON.stringify({ action: 'request' }));
}

// 處理 MQTT 訊息
function handleMqttMessage(topic: string, message: Buffer) {
  const data = message.toString();
  console.log(`📨 收到 MQTT 訊息 [${topic}]:`, data);

  try {
    const jsonData = JSON.parse(data);

    switch (topic) {
      case MQTT_TOPICS.TEMPERATURE:
        sensorData.temperature = jsonData.temperature || 0;
        broadcastToClients({
          type: 'sensor_data',
          temperature: sensorData.temperature,
          relays: sensorData.relays
        });
        break;

      case MQTT_TOPICS.RELAY_STATE:
        if (jsonData.id !== undefined && jsonData.state !== undefined) {
          sensorData.relays[jsonData.id].state = jsonData.state;
          broadcastToClients({
            type: 'relay_response',
            relay_id: jsonData.id,
            state: jsonData.state,
            success: true
          });
        }
        break;

      case MQTT_TOPICS.RELAY_NAME:
        if (jsonData.id !== undefined && jsonData.name !== undefined) {
          sensorData.relays[jsonData.id].name = jsonData.name;
          broadcastToClients({
            type: 'relay_name_updated',
            relay_id: jsonData.id,
            name: jsonData.name
          });
        }
        break;

      case MQTT_TOPICS.SENSOR_DATA:
        if (jsonData.temperature !== undefined) {
          sensorData.temperature = jsonData.temperature;
        }
        if (jsonData.relays && Array.isArray(jsonData.relays)) {
          jsonData.relays.forEach((relay: any) => {
            if (relay.id !== undefined) {
              sensorData.relays[relay.id] = {
                id: relay.id,
                name: relay.name || `Relay ${relay.id + 1}`,
                state: relay.state || false
              };
            }
          });
        }
        broadcastToClients({
          type: 'sensor_data',
          temperature: sensorData.temperature,
          relays: sensorData.relays
        });
        break;
    }
  } catch (e) {
    console.error('解析 MQTT 訊息失敗:', e);
  }
}

// 發布 MQTT 訊息
export function publishMqtt(topic: string, message: string): boolean {
  if (!mqttClient || !mqttClient.connected) {
    console.error('MQTT 未連線');
    return false;
  }
  
  mqttClient.publish(topic, message, (err) => {
    if (err) {
      console.error(`發布失敗 [${topic}]:`, err);
    } else {
      console.log(`📤 已發布 [${topic}]:`, message);
    }
  });
  
  return true;
}

// 控制繼電器
export function controlRelay(relayId: number, state: boolean): boolean {
  const message = JSON.stringify({
    id: relayId,
    state: state
  });
  return publishMqtt(MQTT_TOPICS.RELAY_CONTROL, message);
}

// 更新繼電器名稱
export function updateRelayName(relayId: number, name: string): boolean {
  const message = JSON.stringify({
    id: relayId,
    name: name
  });
  return publishMqtt(MQTT_TOPICS.RELAY_NAME, message);
}

// 獲取當前感測器數據
export function getSensorData(): SensorData {
  return sensorData;
}

// WebSocket 客戶端管理
export function addWsClient(client: any) {
  wsClients.add(client);
  // 發送當前數據給新客戶端
  client.send(JSON.stringify({
    type: 'sensor_data',
    temperature: sensorData.temperature,
    relays: sensorData.relays
  }));
}

export function removeWsClient(client: any) {
  wsClients.delete(client);
}

// 廣播給所有 WebSocket 客戶端
function broadcastToClients(data: any) {
  const message = JSON.stringify(data);
  wsClients.forEach(client => {
    try {
      if (client.readyState === 1) { // OPEN
        client.send(message);
      }
    } catch (e) {
      console.error('廣播失敗:', e);
    }
  });
}

// 處理 WebSocket 訊息
export function handleWsMessage(message: string, client: any) {
  try {
    const data = JSON.parse(message);
    console.log('📨 收到 WS 命令:', data);

    switch (data.command) {
      case 'get_sensors':
        client.send(JSON.stringify({
          type: 'sensor_data',
          temperature: sensorData.temperature,
          relays: sensorData.relays
        }));
        break;

      case 'relay_control':
        const { relay_id, state } = data;
        if (relay_id !== undefined && state !== undefined) {
          controlRelay(relay_id, state);
          // MQTT 回應會觸發廣播
        }
        break;

      case 'ping':
        client.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now()
        }));
        break;

      default:
        client.send(JSON.stringify({
          type: 'error',
          message: 'Unknown command'
        }));
    }
  } catch (e) {
    console.error('處理 WS 訊息失敗:', e);
    client.send(JSON.stringify({
      type: 'error',
      message: 'Invalid message format'
    }));
  }
}

// 設置 MQTT 訊息回調（用於外部處理）
export function onMqttMessage(callback: (topic: string, message: string) => void) {
  if (mqttClient) {
    mqttClient.on('message', (topic, message) => {
      callback(topic, message.toString());
    });
  }
}