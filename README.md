# LIFF ShareTarget AWS Serverless Application

這是一個基於 AWS Serverless 架構的 LIFF ShareTarget 應用程式，支援使用者分享內容並透過 MAAC Open API 推送訊息。

## 功能特色

- ✅ LIFF ShareTarget 整合
- ✅ AWS Serverless 架構 (Lambda + API Gateway + DynamoDB)
- ✅ 使用者分享次數限制 (最多4次)
- ✅ 自動呼叫 MAAC Open API 推送訊息
- ✅ 完整的分享記錄儲存
- ✅ 響應式前端設計

## 系統架構

```
LIFF App (S3 + CloudFront) → API Gateway → Lambda → DynamoDB
                                           ↓
                                    MAAC Open API
```

## 技術堆疊

- **前端**: HTML5, CSS3, JavaScript, LIFF SDK
- **後端**: AWS Lambda (Node.js 18.x)
- **API**: AWS API Gateway
- **資料庫**: Amazon DynamoDB
- **部署**: AWS SAM (Serverless Application Model)
- **CDN**: Amazon CloudFront
- **儲存**: Amazon S3

## 資料結構

### DynamoDB Table: ShareRecords

```json
{
  "userId": "U12345...",           // LINE User ID (Primary Key)
  "timestamp": 1694876400000,      // 分享時間戳 (Sort Key)
  "shareId": "uuid-v4",            // 唯一分享ID
  "item": "分享的內容字串",         // 分享內容
  "createdAt": "2024-09-16T12:34:00Z",
  "ttl": 1725412400               // TTL (1年後自動刪除)
}
```

## 部署前準備

### 1. 安裝必要工具

```bash
# 安裝 AWS CLI
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# 安裝 SAM CLI
brew install aws/tap/aws-sam-cli

# 驗證安裝
aws --version
sam --version
```

### 2. 設定 AWS 憑證

```bash
aws configure
# 輸入 AWS Access Key ID
# 輸入 AWS Secret Access Key
# 設定 Region: ap-northeast-1 (東京)
# 設定 Output format: json
```

### 3. 設定環境變數

在 `samconfig.toml` 中更新以下參數：

```toml
parameter_overrides = "Environment=\"dev\" MaacApiUrl=\"https://your-maac-api.com\" MaacApiKey=\"your-api-key\" SuccessTemplateId=\"SUCCESS_TEMPLATE\" LimitTemplateId=\"LIMIT_TEMPLATE\""
```

## 部署指南

### 1. 首次部署 (引導模式)

```bash
./deploy.sh --guided
```

### 2. 後續部署

```bash
./deploy.sh
```

### 3. 本地開發

```bash
# 安裝相依套件
npm install

# 本地啟動 API
sam local start-api

# 測試 API
curl -X POST http://localhost:3000/api/share \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user","item":"測試內容"}'
```

## 設定說明

### 1. 更新 LIFF ID

部署完成後，在 `public/app.js` 中更新你的 LIFF ID：

```javascript
await liff.init({
    liffId: 'YOUR_ACTUAL_LIFF_ID' // 替換為實際的 LIFF ID
});
```

### 2. 更新 API URL

部署腳本會自動更新 API URL，如需手動更新：

```javascript
this.apiUrl = 'https://YOUR_API_GATEWAY_URL/dev/api/share';
```

### 3. MAAC API 設定

確保在 AWS Parameter Store 或環境變數中正確設定：

- `MAAC_API_URL`: MAAC API 端點
- `MAAC_API_KEY`: API 金鑰
- `SUCCESS_TEMPLATE_ID`: 成功分享的模板ID
- `LIMIT_TEMPLATE_ID`: 達到上限的模板ID

## API 文件

### POST /api/share

分享內容到後端系統

**請求格式:**

```json
{
  "userId": "U12345...",
  "item": "分享的內容"
}
```

**回應格式:**

```json
{
  "success": true,
  "message": "分享成功！",
  "data": {
    "shareId": "uuid-v4",
    "shareCount": 1,
    "isWithinLimit": true,
    "maacMessageId": "msg123"
  }
}
```

## 監控與除錯

### 1. 查看 Lambda 日誌

```bash
sam logs -n ShareFunction --stack-name liff-sharetarget --tail
```

### 2. CloudWatch 監控

- Lambda 函數執行時間
- API Gateway 請求數量
- DynamoDB 讀寫單位

### 3. 本地測試

```bash
# 測試 Lambda 函數
echo '{"httpMethod":"POST","body":"{\"userId\":\"test\",\"item\":\"test\"}"}' | sam local invoke ShareFunction
```

## 常見問題

### Q1: CORS 錯誤
確保 API Gateway 已正確設定 CORS，檢查 `template.yaml` 中的 Cors 設定。

### Q2: DynamoDB 權限錯誤
確認 Lambda 函數有 DynamoDB 的讀寫權限，檢查 IAM 角色設定。

### Q3: MAAC API 呼叫失敗
檢查 API 金鑰和端點設定，查看 CloudWatch 日誌獲取詳細錯誤。

## 成本估算

以月流量 10 萬次為例：

- Lambda: ~$1
- API Gateway: ~$1
- DynamoDB: ~$1
- S3 + CloudFront: ~$1
- **總計: ~$4/月**

## 安全性

- ✅ HTTPS 強制執行
- ✅ API 金鑰保護
- ✅ DynamoDB 加密
- ✅ CloudFront WAF 保護
- ✅ 資料自動過期 (TTL)

## 授權

MIT License