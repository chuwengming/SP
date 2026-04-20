import { NextRequest, NextResponse } from 'next/server';
import { connectMqtt } from '@/lib/mqtt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { broker, port, clientId, identity, username, password } = body;

    // 驗證必填欄位 (新增 identity)
    if (!broker || !port || !clientId || !identity) {
      return NextResponse.json(
        { success: false, message: '請填寫完整的連線資訊 (含身分變數)' },
        { status: 400 }
      );
    }

    // 連接 MQTT
    const result = await connectMqtt({
      broker,
      port,
      clientId,
      identity,
      username,
      password,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message
      });
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('MQTT 連線錯誤:', error);
    return NextResponse.json(
      { success: false, message: '連線失敗: ' + error.message },
      { status: 500 }
    );
  }
}