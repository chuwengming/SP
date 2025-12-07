import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'setting.json');

// 讀取設定
export async function GET() {
    try {
        const data = await fs.readFile(SETTINGS_PATH, 'utf-8');
        const settings = JSON.parse(data);
        return NextResponse.json(settings);
    } catch (error) {
        console.error('讀取設定檔案失敗:', error);
        return NextResponse.json(
            { error: '無法讀取設定檔案' },
            { status: 500 }
        );
    }
}

// 更新設定
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 驗證必要的欄位
        if (!body.mqtt || !body.mqtt.broker || !body.mqtt.port || !body.mqtt.clientId) {
            return NextResponse.json(
                { error: '缺少必要的設定欄位' },
                { status: 400 }
            );
        }

        // 保留原有的 loginPassword 如果沒有提供（空白表示不修改）
        const existingData = JSON.parse(await fs.readFile(SETTINGS_PATH, 'utf-8'));
        if (!body.loginPassword) {
            body.loginPassword = existingData.loginPassword;
        }

        // 寫入檔案
        await fs.writeFile(SETTINGS_PATH, JSON.stringify(body, null, 4), 'utf-8');

        // 同時複製到 public/data/setting.json 以供前端讀取
        const publicPath = path.join(process.cwd(), 'public', 'data', 'setting.json');
        await fs.writeFile(publicPath, JSON.stringify(body, null, 4), 'utf-8');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('儲存設定檔案失敗:', error);
        return NextResponse.json(
            { error: '儲存設定失敗' },
            { status: 500 }
        );
    }
}
