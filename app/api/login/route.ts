import { NextRequest, NextResponse } from 'next/server';
import { getMqttStatus } from '@/lib/mqtt';

// 預設密碼（實際應用中應該從環境變數或資料庫讀取）
const DEFAULT_PASSWORD = '123456';

export async function POST(request: NextRequest) {
  try {
    // 檢查 MQTT 是否連線
    if (!getMqttStatus()) {
      return NextResponse.json(
        { message: 'MQTT 未連線，無法登入' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { message: '請輸入密碼' },
        { status: 400 }
      );
    }

    console.log('收到登入請求 - 密碼:', password);

    // 驗證密碼（實際應用中應該使用加密比對）
    if (password === DEFAULT_PASSWORD) {
      console.log('✅ 密碼驗證成功');
      return NextResponse.json({ 
        success: true,
        message: '登入成功' 
      });
    } else {
      console.log('❌ 密碼驗證失敗');
      return NextResponse.json(
        { message: '密碼錯誤，請重新輸入。' },
        { status: 401 }
      );
    }
  } catch (error: any) {
    console.error('登入錯誤:', error);
    return NextResponse.json(
      { message: '登入失敗，請稍後再試。' },
      { status: 500 }
    );
  }
}