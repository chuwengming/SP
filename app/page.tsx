'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  // PlugID 狀態
  const [plugId, setPlugId] = useState('');
  const [plugIdError, setPlugIdError] = useState('');

  // Identity (身分變數) 狀態
  const [identity, setIdentity] = useState('');
  const [identityError, setIdentityError] = useState('');

  // MQTT 連線狀態
  const [mqttStatus, setMqttStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [mqttConfig, setMqttConfig] = useState({
    broker: 's4eb1262.ala.cn-hangzhou.emqxsl.cn',
    port: '8084',
    clientId: 's4eb1262', // 技術連線 ID
    username: 'chuwm',
    password: 'chuwengming'
  });

  // 設定檔案
  const [settings, setSettings] = useState<{
    mqtt: { broker: string; port: string; clientId: string; username: string; password: string };
    plugName: string;
    loginPassword: string;
    plugId?: string;
  } | null>(null);

  // 插座資訊
  const [plugName, setPlugName] = useState('SmartPlug');
  const [voltage, setVoltage] = useState<string>('-- V'); // 初始顯示
  const [voltageLoading, setVoltageLoading] = useState(false);

  // ESP32 回應狀態
  const [esp32Status, setEsp32Status] = useState<'waiting' | 'responding' | 'timeout' | 'success' | 'error'>('waiting');

  // 登入狀態
  const [loginPassword, setLoginPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // MQTT 配置顯示切換
  const [showMqttConfig, setShowMqttConfig] = useState(true);

  // 身分變數驗證
  const validateIdentity = (val: string): string => {
    if (val.length < 2) return '身分變數至少需要 2 個字元';
    if (!/^[a-zA-Z0-9_]+$/.test(val)) return '身分變數僅限英文、數字與下底線';
    return '';
  };

  // 處理 PlugID 變更
  const handlePlugIdChange = (value: string) => {
    setPlugId(value);
    const error = validatePlugId(value);
    setPlugIdError(error);
  };

  // 處理 Identity 變更
  const handleIdentityChange = (value: string) => {
    setIdentity(value);
    setIdentityError(validateIdentity(value));
  };

  // 讀取設定檔案與啟動連線狀態輪詢
  useEffect(() => {
    // 產生隨機 ClientID
    const randomId = `smartplug_${Math.random().toString(16).slice(2, 10)}`;

    const loadSettings = async () => {
      try {
        const response = await fetch('/data/setting.json');
        if (!response.ok) {
          throw new Error('無法讀取設定檔案');
        }
        const data = await response.json();
        setSettings(data);

        // 更新 MQTT 配置初始值 (優先使用雲端固定值)
        setMqttConfig({
          broker: data.mqtt?.broker || 's4eb1262.ala.cn-hangzhou.emqxsl.cn',
          port: data.mqtt?.port || '8084',
          clientId: data.mqtt?.clientId || 's4eb1262',
          username: data.mqtt?.username || 'chuwm',
          password: data.mqtt?.password || 'chuwengming'
        });

        // 檢查後端目前是否已連線
        checkMqttStatus();

        if (data.plugId) {
          setPlugId(data.plugId);
          const error = validatePlugId(data.plugId);
          if (error) setPlugIdError(error);
        }
      } catch (error) {
        console.error('讀取設定檔案時發生錯誤:', error);
        setMqttConfig(prev => ({ ...prev, clientId: randomId }));
      }
    };

    const checkMqttStatus = async () => {
      // 優先使用 sessionStorage 記錄的實際 session clientId
      const cid = sessionStorage.getItem('mqttClientId') || mqttConfig.clientId;
      if (!cid) return;

      try {
        const response = await fetch(`/api/mqtt/status?clientId=${cid}`);
        const data = await response.json();
        if (data.connected) {
          setMqttStatus('connected');
          setShowMqttConfig(false);
          // 如果已經連線，嘗試從 session 恢復 identity
          const savedIdentity = sessionStorage.getItem('mqttIdentity');
          if (savedIdentity) setIdentity(savedIdentity);

          fetchPlugName();
          fetchVoltage();
        } else {
          setMqttStatus('disconnected');
        }
      } catch (e) { }
    };

    loadSettings();

    // 每 5 秒檢查一次連線狀態
    const interval = setInterval(checkMqttStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // 獲取插座名稱 (API)
  const fetchPlugName = async () => {
    try {
      const cid = sessionStorage.getItem('mqttClientId');
      const response = await fetch(`/api/plugName?clientId=${encodeURIComponent(cid || '')}`);
      const data = await response.json();
      if (data.plugName && data.plugName.trim() !== '') {
        setPlugName(data.plugName);
      }
    } catch (error) {
      console.error('獲取插座名稱時發生錯誤:', error);
    }
  };

  // 獲取電壓 (API)
  const fetchVoltage = async () => {
    setVoltageLoading(true);
    try {
      const identity = sessionStorage.getItem('mqttIdentity');
      const response = await fetch(`/api/voltage?clientId=${encodeURIComponent(identity || '')}`);
      const data = await response.json();

      // 根據回傳值判斷顯示
      if (data.voltage !== undefined && data.voltage !== 0) {
        setVoltage(`AC-${data.voltage}V`);
      } else {
        setVoltage('AC-0V (無數據)');
      }
    } catch (error) {
      console.error('獲取電壓時發生錯誤:', error);
      setVoltage('無法載入電壓');
    } finally {
      setVoltageLoading(false);
    }
  };

  // 儲存 PlugID 和 MQTT 設定到設定檔案 (API)
  const savePlugIdToSettings = async (id: string, mqttConfig: any) => {
    try {
      // 讀取當前設定檔案，確保獲取完整的設定結構
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('無法讀取設定檔案');
      const currentSettings = await response.json();

      // 更新 plugId 和 MQTT 連線參數，但【保留】設定檔中原有的 clientId
      // 注意：mqttConfig.clientId 是 Next.js 動態產生的 session ID (臨時亂碼)，不應寫入設定檔
      const newSettings = {
        ...currentSettings,
        plugId: id,
        mqtt: {
          ...currentSettings.mqtt,
          broker: mqttConfig.broker,
          port: mqttConfig.port,
          clientId: currentSettings.mqtt?.clientId || mqttConfig.clientId, // 優先保留設定檔中的 clientId
          username: mqttConfig.username || '',
          password: mqttConfig.password || ''
        }
      };

      const saveResponse = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });

      const result = await saveResponse.json();
      if (!saveResponse.ok || !result.success) {
        throw new Error(result.error || '儲存設定失敗');
      }

      console.log('PlugID 和 MQTT 設定已儲存到設定檔案:', {
        plugId: id,
        clientId: newSettings.mqtt.clientId
      });
      return true;
    } catch (error) {
      console.error('儲存 PlugID 和 MQTT 設定時發生錯誤:', error);
      return false;
    }
  };

  // 連接 MQTT
  const connectMqtt = async () => {
    // 檢查 PlugID 是否有效
    if (!plugId || plugIdError) {
      alert('請輸入有效的 PlugID');
      return;
    }

    if (!mqttConfig.broker || !mqttConfig.port || !mqttConfig.clientId) {
      alert('請填寫完整的 MQTT 連線資訊');
      return;
    }

    // 先儲存 PlugID 和 MQTT 設定到設定檔案
    const saved = await savePlugIdToSettings(plugId, mqttConfig);
    if (!saved) {
      alert('儲存 PlugID 失敗，請稍後再試');
      return;
    }

    setMqttStatus('connecting');
    setVoltage('偵測中...');

    try {
      // 呼叫後端 API 建立 MQTT 連線
      const response = await fetch('/api/mqtt/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...mqttConfig,
          identity: identity // 傳遞身分變數
        })
      });

      const data = await response.json();

      if (data.success) {
        setMqttStatus('connected');
        setShowMqttConfig(false);

        // 保存連線資訊到 sessionStorage，供操作頁面使用
        try {
          sessionStorage.setItem('mqttClientId', mqttConfig.clientId);
          sessionStorage.setItem('mqttIdentity', identity); // 新增 identity 儲存
          sessionStorage.setItem('plugId', plugId);
          console.log('連線資訊已保存到 sessionStorage');
        } catch (e) {
          console.error('保存 sessionStorage 失敗:', e);
        }

        // 獲取靜態名稱
        fetchPlugName();

        // 關鍵：延遲 2.5 秒後呼叫 API 獲取電壓
        // 這是為了確保 ESP32 已經處理 announce 並發送完畢初始狀態
        setTimeout(() => {
          fetchVoltage();
        }, 2500);

      } else {
        setMqttStatus('disconnected');
        alert('MQTT 連線失敗: ' + data.message);
      }
    } catch (error) {
      setMqttStatus('disconnected');
      setVoltage('-- V');
      console.error('MQTT 連線錯誤:', error);
      alert('MQTT 連線失敗，請檢查網路設定');
    }
  };

  // 登入處理
  const handleLogin = async () => {
    if (!loginPassword) {
      setErrorMessage('請輸入密碼');
      return;
    }

    // 再次確保 Session 正確 (雙重保險)
    if (plugId) sessionStorage.setItem('plugId', plugId);

    // 取得真正的背景連線 ID
    const actualClientId = sessionStorage.getItem('mqttClientId') || mqttConfig.clientId;

    setErrorMessage('');
    setLoginLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: loginPassword,
          clientId: actualClientId // Login API 需要真正的 session 連線 ID 來驗證底層狀態
        })
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

        {/* Identity (身分變數) 輸入區 */}
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">
            身分變數 (Identity)
          </label>
          <input
            type="text"
            value={identity}
            onChange={(e) => handleIdentityChange(e.target.value)}
            placeholder="請輸入身分識別碼 (如 user1)"
            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={mqttStatus === 'connecting' || mqttStatus === 'connected'}
          />
          {identityError && (
            <div className="text-red-600 text-sm mt-2">{identityError}</div>
          )}
        </div>

        {/* PlugID 輸入區 */}
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">
            插座識別碼 (PlugID)
          </label>
          <input
            type="text"
            value={plugId}
            onChange={(e) => handlePlugIdChange(e.target.value)}
            placeholder="請輸入設備 PlugID"
            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={mqttStatus === 'connecting' || mqttStatus === 'connected'}
          />
          {plugIdError && (
            <div className="text-red-600 text-sm mt-2">{plugIdError}</div>
          )}
        </div>

        {/* MQTT 連線配置區 - 簡化顯示，隱藏細節 */}
        {showMqttConfig && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-md font-semibold text-gray-700">雲端 MQTT 通道設定</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${mqttStatus === 'connected' ? 'bg-green-500 text-white' :
                mqttStatus === 'connecting' ? 'bg-yellow-500 text-white' :
                  'bg-gray-500 text-white'
                }`}>
                {mqttStatus === 'connected' ? '服務已就緒' :
                  mqttStatus === 'connecting' ? '建立中...' :
                    '未啟動'}
              </span>
            </div>

            <div className="text-xs text-gray-400 mb-4 space-y-1">
              <p>• 系統將自動根據 PlugID 建立專屬加密通道</p>
              <p>• 目前伺服器：{mqttConfig.broker}</p>
            </div>

            <button
              onClick={connectMqtt}
              disabled={mqttStatus === 'connecting' || mqttStatus === 'connected' || !identity || !plugId}
              className={`w-full py-3 rounded-lg font-medium transition-all ${mqttStatus === 'connected'
                ? 'bg-green-100 text-green-700 cursor-not-allowed border border-green-200'
                : mqttStatus === 'connecting'
                  ? 'bg-yellow-500 text-white cursor-wait'
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-md hover:shadow-lg'
                }`}
            >
              {mqttStatus === 'connected' ? '✓ 通道已建立' :
                mqttStatus === 'connecting' ? '正在建立加密通道...' :
                  '啟動連線服務'}
            </button>
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
              onClick={() => {
                setShowMqttConfig(true);
                setMqttStatus('disconnected');
                setVoltage('-- V');
              }}
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
            placeholder="請輸入密碼"
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
          <span className={`text-3xl font-bold ${voltageLoading ? 'opacity-70 animate-pulse' : ''}`}>
            {voltage}
          </span>
        </div>
      </div>
    </div>
  );
}
