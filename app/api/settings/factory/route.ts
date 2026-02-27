import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { publishMqtt, MqttTopics } from '@/lib/mqtt';

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

export async function POST() {
    try {
        console.log('🔄 開始執行回復原廠設定...');
        
        // 1. 讀取原廠設定檔案
        const factoryData = await fs.readFile(FACTORY_SETTINGS_PATH, 'utf-8');
        const factorySettings = JSON.parse(factoryData);
        
        // 2. 讀取當前設定以保留 plugId
        let currentPlugId = 'sp123456';
        try {
            const currentData = await fs.readFile(SETTINGS_PATH, 'utf-8');
            const currentSettings = JSON.parse(currentData);
            currentPlugId = currentSettings.plugId || 'sp123456';
            console.log(`📋 保留當前 PlugID: ${currentPlugId}`);
        } catch (error) {
            console.warn('無法讀取當前設定檔案，使用預設 PlugID');
        }
        
        // 3. 合併設定：原廠設定 + 保留的 plugId
        const mergedSettings = {
            ...factorySettings,
            plugId: currentPlugId  // 保留 plugId
        };
        
        // 4. 寫入新的設定檔案
        await fs.writeFile(SETTINGS_PATH, JSON.stringify(mergedSettings, null, 4), 'utf-8');
        await fs.writeFile(PUBLIC_SETTINGS_PATH, JSON.stringify(mergedSettings, null, 4), 'utf-8');
        
        console.log('✅ 設定檔案已更新完成');
        
        // 5. 透過 MQTT 廣播數據給 ESP32C3
        const broadcastResults = [];
        
        // 5.1 廣播 plugName
        if (mergedSettings.plugName) {
            const plugNameTopic = MqttTopics.plugName(currentPlugId);
            const plugNamePayload = JSON.stringify({ plugName: mergedSettings.plugName });
            const plugNameSuccess = publishMqtt(plugNameTopic, plugNamePayload, { qos: 1 });
            
            if (plugNameSuccess) {
                console.log(`📤 已廣播 plugName: ${mergedSettings.plugName} 到 ${plugNameTopic}`);
            } else {
                console.warn(`⚠️  廣播 plugName 失敗，MQTT 可能未連線`);
            }
            
            broadcastResults.push({ 
                type: 'plugName', 
                success: plugNameSuccess,
                topic: plugNameTopic,
                payload: plugNamePayload
            });
        }
        
        // 5.2 廣播繼電器名稱 (Relay 1 ~ Relay 6)
        if (mergedSettings.relayNames) {
            for (let i = 1; i <= 6; i++) {
                const relayKey = `relay${i}`;
                if (mergedSettings.relayNames[relayKey]) {
                    const relayNameTopic = MqttTopics.relayName(currentPlugId);
                    const relayNamePayload = JSON.stringify({ 
                        id: i - 1, // ESP32C3 使用 0-based 索引 (0-5)
                        name: mergedSettings.relayNames[relayKey]
                    });
                    const relayNameSuccess = publishMqtt(relayNameTopic, relayNamePayload, { qos: 1 });
                    
                    if (relayNameSuccess) {
                        console.log(`📤 已廣播 ${relayKey}: ${mergedSettings.relayNames[relayKey]} 到 ${relayNameTopic}`);
                    } else {
                        console.warn(`⚠️  廣播 ${relayKey} 失敗，MQTT 可能未連線`);
                    }
                    
                    broadcastResults.push({ 
                        type: relayKey, 
                        success: relayNameSuccess,
                        topic: relayNameTopic,
                        payload: relayNamePayload
                    });
                    
                    // 稍微延遲避免 MQTT 訊息擁塞
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        }
        
        return NextResponse.json({
            success: true,
            message: '原廠設定已回復完成',
            settings: mergedSettings,
            broadcastResults: broadcastResults,
            plugId: currentPlugId
        });
        
    } catch (error) {
        console.error('回復原廠設定失敗:', error);
        return NextResponse.json(
            { 
                success: false,
                error: '回復原廠設定失敗',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
