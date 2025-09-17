const AWS = require('aws-sdk');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();

const {
  DYNAMODB_TABLE,
  MAAC_API_URL,
  MAAC_API_KEY
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

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,POST'
  };

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'CORS preflight handled' })
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { userId, item } = body;

    // Validate required fields
    if (!userId || !item) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Missing required fields: userId and item'
        })
      };
    }

    // Get current timestamp
    const timestamp = Date.now();
    const shareId = uuidv4();

    // Query existing share records for this user
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

    // Store the new share record (regardless of count)
    const shareRecord = {
      userId,
      timestamp,
      shareId,
      item,
      createdAt: new Date().toISOString(),
      ttl: Math.floor((Date.now() + (365 * 24 * 60 * 60 * 1000)) / 1000) // 1 year TTL
    };

    await dynamodb.put({
      TableName: DYNAMODB_TABLE,
      Item: shareRecord
    }).promise();

    console.log('Share record saved:', shareRecord);

    // Determine which template to use based on share count and item type
    const isWithinLimit = shareCount < 4; // 0,1,2,3 = within limit, 4+ = exceeded
    const templateType = isWithinLimit ? 'success' : 'limit';
    const templateId = getTemplateId(item, templateType);
    const message = isWithinLimit ? '分享成功！' : '已達分享上限，但已記錄您的分享';

    // Validate template ID exists
    if (!templateId) {
      throw new Error(`Invalid item type: ${item}. Supported types: ${Object.keys(TEMPLATE_MAPPING.success).join(', ')}`);
    }

    // Call MAAC Open API
    const maacResult = await callMaacApi(userId, templateId, {
      shareCount: shareCount + 1, // New count after this share
      item,
      isWithinLimit
    });

    console.log('MAAC API result:', maacResult);

    // Return success response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message,
        data: {
          shareId,
          shareCount: shareCount + 1,
          isWithinLimit,
          maacMessageId: maacResult.messageId
        }
      })
    };

  } catch (error) {
    console.error('Error processing share request:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error.message
      })
    };
  }
};

function getTemplateId(item, templateType) {
  // Get the template ID based on item type and template type (success/limit)
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

async function callMaacApi(userId, templateId, additionalData = {}) {
  try {
    const payload = {
      template_id: templateId,
      user_id: userId,
      data: additionalData
    };

    console.log('Calling MAAC API with payload:', payload);

    const response = await axios.post(MAAC_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MAAC_API_KEY}`,
        'X-API-Key': MAAC_API_KEY
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

    // Don't fail the entire request if MAAC API fails
    return {
      success: false,
      error: error.message,
      messageId: null
    };
  }
}