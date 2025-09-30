const express = require('express');
const path = require('path');
const cors = require('cors');
const AWS = require('aws-sdk');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// AWS DynamoDB 設定
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'ap-northeast-1'
});

// 環境變數
const {
  DYNAMODB_TABLE = 'ShareRecords',
  MAAC_API_URL = 'https://api.cresclab.com/openapi/v1/direct_message/push/',
  MAAC_API_KEY = 'iW2avIGc26d906bC3TfGRctPcAYAb/PuSZOLAkDatFo='
} = process.env;

// Template ID mapping based on item type
const TEMPLATE_MAPPING = {
  success: {
    "SWA": 134941,
    "SWB": 134943,
    "SWC": 134944,
    "SWD": 134945
  },
  limit: {
    "SWA": 134990,
    "SWB": 134991,
    "SWC": 134993,
    "SWD": 134994
  }
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 健康檢查端點
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'LIFF ShareTarget API'
  });
});

// 根路由 - 提供 LIFF 前端頁面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API 路由 - 處理分享請求
app.post('/api/share', async (req, res) => {
  console.log('Received share request:', JSON.stringify(req.body, null, 2));

  try {
    const { userId, item } = req.body;

    // 驗證必填欄位
    if (!userId || !item) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId and item'
      });
    }

    // 生成分享記錄
    const timestamp = Date.now();
    const shareId = uuidv4();

    // 查詢現有分享記錄
    const queryParams = {
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    };

    const existingShares = await dynamodb.query(queryParams).promise();
    const shareCount = existingShares.Items.length;

    console.log(`User ${userId} current share count: ${shareCount}`);

    // 儲存新的分享記錄
    const shareRecord = {
      userId,
      timestamp,
      shareId,
      item,
      createdAt: formatDateTime(new Date())
    };

    await dynamodb.put({
      TableName: DYNAMODB_TABLE,
      Item: shareRecord
    }).promise();

    console.log('Share record saved:', shareRecord);

    // 根據分享次數和項目類型選擇 template
    const isWithinLimit = shareCount < 3; // 0,1,2,3 = within limit, 4+ = exceeded
    const templateType = isWithinLimit ? 'success' : 'limit';
    const templateId = getTemplateId(item, templateType);
    const message = isWithinLimit ? '分享成功！' : '已達分享上限，但已記錄您的分享';

    // 驗證 template ID 存在
    if (!templateId) {
      throw new Error(`Invalid item type: ${item}. Supported types: ${Object.keys(TEMPLATE_MAPPING.success).join(', ')}`);
    }

    // 呼叫 MAAC Open API
    const maacResult = await callMaacApi(userId, templateId);

    console.log('MAAC API result:', maacResult);

    // 回傳成功回應
    res.status(200).json({
      success: true,
      message,
      data: {
        shareId,
        shareCount: shareCount + 1,
        isWithinLimit,
        maacMessageId: maacResult.messageId
      }
    });

  } catch (error) {
    console.error('Error processing share request:', error);

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// 取得用戶分享記錄 API
app.get('/api/shares/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const queryParams = {
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      ScanIndexForward: false // 最新的在前面
    };

    const result = await dynamodb.query(queryParams).promise();

    res.status(200).json({
      success: true,
      data: {
        userId,
        totalShares: result.Items.length,
        shares: result.Items
      }
    });

  } catch (error) {
    console.error('Error fetching user shares:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch user shares',
      error: error.message
    });
  }
});

// 輔助函數：格式化日期為 Y-m-d H:i:s (台北時區)
function formatDateTime(date) {
  return date.toLocaleString('sv-SE', {
    timeZone: 'Asia/Taipei'
  }); // YYYY-MM-DD HH:mm:ss 台北時間
}

// 輔助函數：根據項目類型和模板類型取得 template ID
function getTemplateId(item, templateType) {
  const templateMap = TEMPLATE_MAPPING[templateType];

  if (!templateMap) {
    console.error(`Invalid template type: ${templateType}`);
    return null;
  }

  const templateId = templateMap[item];

  if (!templateId) {
    console.error(`No template found for item: ${item}, type: ${templateType}`);
    return null;
  }

  console.log(`Selected template ID: ${templateId} for item: ${item}, type: ${templateType}`);
  return templateId;
}

// 呼叫 MAAC Open API
async function callMaacApi(userId, templateId) {
  try {
    const payload = {
      template_id: templateId,
      data: {
        line_uid: userId
      }
    };

    console.log('Calling MAAC API with payload:', payload);

    const response = await axios.post(MAAC_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MAAC_API_KEY}`,
      },
      timeout: 10000 // 10 seconds timeout
    });

    console.log('MAAC API response:', response.data);

    return {
      success: true,
      messageId: response.data.messageId || response.data.id,
      data: response.data
    };

  } catch (error) {
    console.error('MAAC API call failed:', error.message);

    // 不讓 MAAC API 失敗影響整個請求
    return {
      success: false,
      error: error.message,
      messageId: null
    };
  }
}

// 錯誤處理中介軟體
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 處理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Resource not found'
  });
});

// 啟動伺服器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 LIFF App: http://localhost:${PORT}/`);
  console.log(`🔌 API Endpoint: http://localhost:${PORT}/api/share`);
  console.log(`📝 DynamoDB Table: ${DYNAMODB_TABLE}`);
  console.log(`🔗 MAAC API URL: ${MAAC_API_URL}`);
});

module.exports = app;