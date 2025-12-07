'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  // MQTT 連線狀態
  const [mqttStatus, setMqttStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [mqttConfig, setMqttConfig] = useState({
    broker: 'broker.emqx.io',
    port: '8083',
    clientId: `smartplug_${Math.random().toString(16).slice(2, 10)}`,
    username: '',
    password: ''
  });

  // 設定檔案
  const [settings, setSettings] = useState<{
    mqtt: { broker: string; port: string; clientId: string; username: string; password: string };
    plugName: string;
    loginPassword: string;
  } | null>(null);

  // 插座資訊
  const [plugName, setPlugName] = useState('SmartPlug');
  const [voltage, setVoltage] = useState<string>('載入中...');
  const [voltageLoading, setVoltageLoading] = useState(true);

  // 登入狀態
  const [loginPassword, setLoginPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // 讀取設定檔案
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/data/setting.json');
        if (!response.ok) {
          throw new Error('無法讀取設定檔案');
        }
        const data = await response.json();
        setSettings(data);

        // 更新 MQTT 配置初始值
        setMqttConfig(prev => ({
          ...prev,
          broker: data.mqtt.broker,
          port: data.mqtt.port,
          clientId: data.mqtt.clientId === 'smartplug_random'
            ? `smartplug_${Math.random().toString(16).slice(2, 10)}`
            : data.mqtt.clientId,
          username: data.mqtt.username,
          password: data.mqtt.password
        }));

        // 更新插座名稱初始值
        setPlugName(data.plugName);
      } catch (error) {
        console.error('讀取設定檔案時發生錯誤:', error);
      }
    };

    loadSettings();
  }, []);

  // MQTT 配置顯示
  const [showMqttConfig, setShowMqttConfig] = useState(true);

  // 連接 MQTT
  const connectMqtt = async () => {
    if (!mqttConfig.broker || !mqttConfig.port || !mqttConfig.clientId) {
      alert('請填寫完整的 MQTT 連線資訊');
      return;
    }

    setMqttStatus('connecting');
    try {
      const response = await fetch('/api/mqtt/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mqttConfig)
      });

      const data = await response.json();

      if (data.success) {
        setMqttStatus('connected');
        setShowMqttConfig(false);
        // 連線成功後獲取插座名稱和電壓
        fetchPlugName();
        fetchVoltage();
      } else {
        setMqttStatus('disconnected');
        alert('MQTT 連線失敗: ' + data.message);
      }
    } catch (error) {
      setMqttStatus('disconnected');
      console.error('MQTT 連線錯誤:', error);
      alert('MQTT 連線失敗，請檢查網路設定');
    }
  };

  // 獲取插座名稱
  const fetchPlugName = async () => {
    try {
      const response = await fetch('/api/plugName');
      const data = await response.json();
      if (data.plugName && data.plugName.trim() !== '') {
        setPlugName(data.plugName);
      }
    } catch (error) {
      console.error('獲取插座名稱時發生錯誤:', error);
    }
  };

  // 獲取電壓
  const fetchVoltage = async () => {
    try {
      const response = await fetch('/api/voltage');
      const data = await response.json();
      setVoltage(`AC-${data.voltage}V`);
      setVoltageLoading(false);
    } catch (error) {
      console.error('獲取電壓時發生錯誤:', error);
      setVoltage('無法載入電壓');
      setVoltageLoading(false);
    }
  };

  // 登入處理
  const handleLogin = async () => {
    if (!loginPassword) {
      setErrorMessage('請輸入密碼');
      return;
    }

    setErrorMessage('');
    setLoginLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPassword })
      });

      if (response.ok) {
        console.log('登入成功，載入操作面板...');
        router.push('/operation');
      } else {
        const data = await response.json();
        setErrorMessage(data.message || '登入失敗，請檢查密碼。');
      }
    } catch (error) {
      console.error('登入錯誤:', error);
      setErrorMessage('登入失敗，請稍後再試。');
    } finally {
      setLoginLoading(false);
    }
  };

  // Enter 鍵登入
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && mqttStatus === 'connected' && !loginLoading) {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-5">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-6">
          智能家居遠控系統
        </h1>

        {/* MQTT 連線配置區 */}
        {showMqttConfig && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-blue-900">MQTT 連線設定</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${mqttStatus === 'connected' ? 'bg-green-500 text-white' :
                mqttStatus === 'connecting' ? 'bg-yellow-500 text-white' :
                  'bg-gray-500 text-white'
                }`}>
                {mqttStatus === 'connected' ? '已連線' :
                  mqttStatus === 'connecting' ? '連線中...' :
                    '未連線'}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  伺服器位址 *
                </label>
                <input
                  type="text"
                  value={mqttConfig.broker}
                  onChange={(e) => setMqttConfig({ ...mqttConfig, broker: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder={settings ? settings.mqtt.broker : "broker.emqx.io"}
                  disabled={mqttStatus === 'connecting'}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    連線埠號 *
                  </label>
                  <input
                    type="text"
                    value={mqttConfig.port}
                    onChange={(e) => setMqttConfig({ ...mqttConfig, port: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder={settings ? settings.mqtt.port : "8083"}
                    disabled={mqttStatus === 'connecting'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client ID *
                  </label>
                  <input
                    type="text"
                    value={mqttConfig.clientId}
                    onChange={(e) => setMqttConfig({ ...mqttConfig, clientId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder={settings ? settings.mqtt.clientId : "client_id"}
                    disabled={mqttStatus === 'connecting'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  使用者名稱
                </label>
                <input
                  type="text"
                  value={mqttConfig.username}
                  onChange={(e) => setMqttConfig({ ...mqttConfig, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder={settings ? (settings.mqtt.username || "選填") : "選填"}
                  disabled={mqttStatus === 'connecting'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  連線密碼
                </label>
                <input
                  type="password"
                  value={mqttConfig.password}
                  onChange={(e) => setMqttConfig({ ...mqttConfig, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder={settings ? (settings.mqtt.password ? "******" : "選填") : "選填"}
                  disabled={mqttStatus === 'connecting'}
                />
              </div>

              <button
                onClick={connectMqtt}
                disabled={mqttStatus === 'connecting' || mqttStatus === 'connected'}
                className={`w-full py-3 rounded-lg font-medium transition-opacity ${mqttStatus === 'connected'
                  ? 'bg-green-500 text-white cursor-not-allowed'
                  : mqttStatus === 'connecting'
                    ? 'bg-yellow-500 text-white cursor-wait'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
              >
                {mqttStatus === 'connected' ? '✓ 已連線' :
                  mqttStatus === 'connecting' ? '連線中...' :
                    '連線 MQTT'}
              </button>
            </div>
          </div>
        )}

        {/* 連線狀態顯示（收起後） */}
        {!showMqttConfig && mqttStatus === 'connected' && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-sm text-green-800 font-medium">MQTT 已連線</span>
            </div>
            <button
              onClick={() => setShowMqttConfig(true)}
              className="text-xs text-green-700 hover:text-green-900 underline"
            >
              查看設定
            </button>
          </div>
        )}

        {/* 插座名稱 */}
        <div className="mb-5">
          <label className="block text-gray-700 font-medium mb-2">插座名稱</label>
          <input
            type="text"
            value={plugName}
            readOnly
            className="w-full px-3 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-600"
          />
        </div>

        {/* 登入密碼 */}
        <div className="mb-5">
          <label className="block text-gray-700 font-medium mb-2">請輸入登入密碼</label>
          <input
            type="password"
            value={loginPassword}
            onChange={(e) => {
              setLoginPassword(e.target.value);
              setErrorMessage('');
            }}
            onKeyPress={handleKeyPress}
            placeholder={settings ? `預設密碼: ${settings.loginPassword}` : "輸入密碼..."}
            disabled={mqttStatus !== 'connected' || loginLoading}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          {errorMessage && (
            <div className="text-red-600 text-sm mt-2">{errorMessage}</div>
          )}
          {mqttStatus !== 'connected' && (
            <div className="text-gray-500 text-sm mt-2">
              請先連線 MQTT 伺服器
            </div>
          )}
        </div>

        {/* 登入按鈕 */}
        <button
          onClick={handleLogin}
          disabled={mqttStatus !== 'connected' || loginLoading}
          className="w-full py-3 bg-gradient-to-r from-green-500 to-green-400 text-white rounded-lg text-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loginLoading ? '登入中...' : '登入'}
        </button>

        {/* 系統電壓規格 */}
        <div className="mt-8 bg-blue-500 text-white p-5 rounded-xl text-center">
          <p className="text-lg font-bold mb-2">系統電壓規格</p>
          <span className={`text-3xl font-bold ${voltageLoading ? 'text-blue-200 italic' : ''}`}>
            {voltage}
          </span>
        </div>
      </div>
    </div>
  );
}
