import mqtt, { MqttClient } from 'mqtt';
import { setMqttClient as setOperationMqttClient } from './mqtt-operation';

// MQTT 客戶端實例
let mqttClient: MqttClient | null = null;

// 儲存從 MQTT 接收的數據
let plugNameData: string = 'SmartPlug';
let voltageData: number = 110;

// MQTT 連線配置
interface MqttConfig {
  broker: string;
  port: string;
  clientId: string;
  username?: string;
  password?: string;
}

// 連接到 MQTT Broker
export async function connectMqtt(config: MqttConfig): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    try {
      // 如果已經有連線，先斷開
      if (mqttClient && mqttClient.connected) {
        mqttClient.end();
      }

      // 構建連線 URL
      const protocol = config.port === '8083' || config.port === '8084' ? 'ws' : 'mqtt';
      const connectUrl = `${protocol}://${config.broker}:${config.port}/mqtt`;

      console.log('連接到 MQTT Broker:', connectUrl);

      // 建立連線
      mqttClient = mqtt.connect(connectUrl, {
        clientId: config.clientId,
        username: config.username || undefined,
        password: config.password || undefined,
        clean: true,
        reconnectPeriod: 0, // 不自動重連
        connectTimeout: 10000,
      });

      // 連線成功
      mqttClient.on('connect', () => {
        console.log('✅ MQTT 連線成功');
        
        // 設置操作面板的 MQTT 客戶端
        if (mqttClient) {
          setOperationMqttClient(mqttClient);
        }
        
        // 訂閱登入頁面需要的主題
        mqttClient?.subscribe('smartplug/plugName', (err) => {
          if (!err) console.log('📩 已訂閱 smartplug/plugName');
        });
        
        mqttClient?.subscribe('smartplug/voltage', (err) => {
          if (!err) console.log('📩 已訂閱 smartplug/voltage');
        });

        // 請求插座名稱和電壓資料
        mqttClient?.publish('smartplug/request', JSON.stringify({ 
          type: 'getPlugName' 
        }));
        
        mqttClient?.publish('smartplug/request', JSON.stringify({ 
          type: 'getVoltage' 
        }));

        resolve({ success: true, message: 'MQTT 連線成功' });
      });

      // 連線錯誤
      mqttClient.on('error', (error) => {
        console.error('❌ MQTT 連線錯誤:', error);
        resolve({ success: false, message: `連線錯誤: ${error.message}` });
      });

      // 接收訊息
      mqttClient.on('message', (topic, message) => {
        const data = message.toString();
        console.log(`📨 收到訊息 [${topic}]:`, data);

        try {
          const jsonData = JSON.parse(data);
          
          if (topic === 'smartplug/plugName') {
            plugNameData = jsonData.plugName || 'SmartPlug';
            console.log('更新插座名稱:', plugNameData);
          } else if (topic === 'smartplug/voltage') {
            voltageData = jsonData.voltage || 110;
            console.log('更新電壓:', voltageData);
          }
        } catch (e) {
          console.error('解析 MQTT 訊息失敗:', e);
        }
      });

      // 連線超時處理
      setTimeout(() => {
        if (!mqttClient?.connected) {
          resolve({ success: false, message: '連線超時' });
        }
      }, 12000);

    } catch (error: any) {
      console.error('MQTT 連線異常:', error);
      resolve({ success: false, message: error.message || '未知錯誤' });
    }
  });
}

// 獲取 MQTT 連線狀態
export function getMqttStatus(): boolean {
  return mqttClient?.connected || false;
}

// 獲取 MQTT 客戶端
export function getMqttClient(): MqttClient | null {
  return mqttClient;
}

// 獲取插座名稱
export function getPlugName(): string {
  return plugNameData;
}

// 獲取電壓
export function getVoltage(): number {
  return voltageData;
}

// 發布訊息到 MQTT
export function publishMqtt(topic: string, message: string): boolean {
  if (!mqttClient || !mqttClient.connected) {
    return false;
  }
  mqttClient.publish(topic, message);
  return true;
}

// 斷開 MQTT 連線
export function disconnectMqtt(): void {
  if (mqttClient) {
    mqttClient.end();
    mqttClient = null;
  }
}