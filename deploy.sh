#!/bin/bash

# LIFF ShareTarget AWS Serverless Deployment Script

set -e

echo "🚀 Starting LIFF ShareTarget deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo -e "${RED}❌ SAM CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Build the application
echo -e "${YELLOW}📦 Building SAM application...${NC}"
sam build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ SAM build failed${NC}"
    exit 1
fi

# Deploy the application
echo -e "${YELLOW}🚀 Deploying to AWS...${NC}"

# Check if this is first deployment
if [ "$1" = "--guided" ]; then
    echo -e "${YELLOW}📋 Running guided deployment...${NC}"
    sam deploy --guided
else
    # Use existing configuration
    sam deploy
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

# Get outputs
echo -e "${YELLOW}📄 Getting deployment outputs...${NC}"
API_URL=$(aws cloudformation describe-stacks --stack-name liff-sharetarget --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)
WEBSITE_URL=$(aws cloudformation describe-stacks --stack-name liff-sharetarget --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' --output text)
TABLE_NAME=$(aws cloudformation describe-stacks --stack-name liff-sharetarget --query 'Stacks[0].Outputs[?OutputKey==`DynamoDBTable`].OutputValue' --output text)

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo -e "${YELLOW}📊 Deployment Information:${NC}"
echo "API Gateway URL: $API_URL"
echo "Website URL: https://$WEBSITE_URL"
echo "DynamoDB Table: $TABLE_NAME"
echo ""

# Upload static files to S3
echo -e "${YELLOW}📤 Uploading static files to S3...${NC}"
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name liff-sharetarget --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' --output text | sed 's/\.s3-website-.*//')

if [ ! -z "$BUCKET_NAME" ]; then
    # Update API URL in app.js before upload
    sed -i.bak "s|https://YOUR_API_GATEWAY_URL/dev/api/share|$API_URL/api/share|g" public/app.js

    aws s3 sync public/ s3://$BUCKET_NAME/ --delete

    # Restore original file
    mv public/app.js.bak public/app.js

    echo -e "${GREEN}✅ Static files uploaded successfully${NC}"
else
    echo -e "${RED}❌ Could not determine S3 bucket name${NC}"
fi

echo ""
echo -e "${GREEN}🎉 LIFF ShareTarget application deployed successfully!${NC}"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Update LIFF ID in public/app.js"
echo "2. Update MAAC API credentials in parameter store"
echo "3. Test the application with LINE LIFF"
echo ""
echo -e "${YELLOW}🔧 Useful commands:${NC}"
echo "View logs: sam logs -n ShareFunction --stack-name liff-sharetarget --tail"
echo "Test API locally: sam local start-api"
echo "Delete stack: aws cloudformation delete-stack --stack-name liff-sharetarget"