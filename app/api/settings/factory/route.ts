import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getMqttClient } from '@/lib/mqtt';

const FACTORY_SETTINGS_PATH = path.join(process.cwd(), 'data', 'setting.factory.json');
const SETTINGS_PATH = path.join(process.cwd(), 'data', 'setting.json');
const PUBLIC_SETTINGS_PATH = path.join(process.cwd(), 'public', 'data', 'setting.json');

export async function GET() {
    try {
        const data = await fs.readFile(FACTORY_SETTINGS_PATH, 'utf-8');
        const factorySettings = JSON.parse(data);
        return NextResponse.json(factorySettings);
    } catch (error) {
        console.error('讀取原廠設定檔案失敗:', error);
        return NextResponse.json(
            { error: '無法讀取原廠設定檔案' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clientId, identity } = body;
        console.log(`🔄 [${identity || clientId}] 開始執行回復原廠設定...`);

        // 1. 讀取原廠設定檔案
        const factoryData = await fs.readFile(FACTORY_SETTINGS_PATH, 'utf-8');
        const factorySettings = JSON.parse(factoryData);

        // 2. 讀取當前設定檔案以保留 MQTT 連線設定與 plugId
        let currentSettings: any = {};
        try {
            const currentData = await fs.readFile(SETTINGS_PATH, 'utf-8');
            currentSettings = JSON.parse(currentData);
        } catch (error) {
            console.warn('無法讀取當前設定檔案，將使用原廠設定:', error);
        }

        // 3. 完整重置為原廠設定，只保留使用者的 plugId（裝置識別碼）
        const mergedSettings = {
            ...factorySettings,
            plugId: currentSettings.plugId || factorySettings.plugId || 'sp123456'
        };

        console.log('📋 合併後的設定:', JSON.stringify(mergedSettings, null, 2));

        // 4. 寫入設定檔案
        await fs.writeFile(SETTINGS_PATH, JSON.stringify(mergedSettings, null, 4), 'utf-8');
        await fs.writeFile(PUBLIC_SETTINGS_PATH, JSON.stringify(mergedSettings, null, 4), 'utf-8');
        console.log('💾 設定檔案已更新');

        // 5. 取得 MQTT 連線
        const mqttClient = getMqttClient(clientId);
        if (!mqttClient || !mqttClient.connected) {
            console.warn('⚠️ MQTT 未連線，無法發送廣播訊息');
            return NextResponse.json({
                success: true,
                message: '原廠設定已回復，但 MQTT 未連線，無法發送廣播訊息',
                settings: mergedSettings
            });
        }

        const plugId = mergedSettings.plugId || 'defaultPlug';
        console.log(`📤 準備發送 MQTT 廣播: PlugID=${plugId}, Identity=${identity}`);

        // 6. 廣播插座名稱（廣播主題，不帶 identity）
        const plugNameTopic = `smartplug/${plugId}/plugName`;
        mqttClient.publish(plugNameTopic, JSON.stringify({ plugName: mergedSettings.plugName }), { qos: 1 });
        console.log(`📤 已發送設備名稱廣播: ${plugNameTopic}`);

        // 7. 廣播繼電器名稱（帶 identity 的控制主題）
        console.log('📤 開始發送繼電器名稱廣播...');
        const relayNames = mergedSettings.relayNames || {};
        for (let i = 0; i < 6; i++) {
            const relayKey = `relay${i + 1}`;
            const relayName = relayNames[relayKey] || `Relay ${i + 1}`;
            if (identity) {
                const nameTopic = `smartplug/${plugId}/${identity}/name`;
                const namePayload = JSON.stringify({ id: i, name: relayName });
                mqttClient.publish(nameTopic, namePayload, { qos: 1 });
                console.log(`✅ 已發送繼電器 ${i} 名稱: ${relayName}`);
            } else {
                console.error(`❌ 發送繼電器 ${i} 名稱失敗 (缺少 identity)`);
            }
        }
        console.log('✅ 所有廣播訊息已發送完成');

        return NextResponse.json({
            success: true,
            message: '原廠設定已成功回復並廣播',
            settings: mergedSettings
        });

    } catch (error: any) {
        console.error('❌ 回復原廠設定失敗:', error);
        return NextResponse.json(
            { success: false, error: '回復原廠設定失敗', details: error.message || '未知錯誤' },
            { status: 500 }
        );
    }
}
