// LIFF ShareTarget Application
class LiffShareTarget {
    constructor() {
        this.apiUrl = '/api/share';  // Same origin, no CORS needed

        // 圖片 URL 映射
        this.imageUrlMap = {
            'SWA': 'https://lineevent.s3.ap-northeast-1.amazonaws.com/NewbalanceEvent/U204LSWA_share.png',
            'KAB': 'https://lineevent.s3.ap-northeast-1.amazonaws.com/NewbalanceEvent/U204LSWD_share.png',
            'SWD': 'https://lineevent.s3.ap-northeast-1.amazonaws.com/NewbalanceEvent/U471KAA_share.png',
            'KAA': 'https://lineevent.s3.ap-northeast-1.amazonaws.com/NewbalanceEvent/U471KAB_share.png'
        };

        // 文字內容映射
        this.textContentMap = {
            'SWA': {
                title: 'NB 204L 精緻優雅系列',
                description: '質感薄底設計，讓你走得輕盈，也收穫專屬的好心情。'
            },
            'KAB': {
                title: 'NB 471 律動自在系',
                description: '再忙也要留點空白，穿上 471，把回家的路走成最自在的風景。'
            },
            'SWD': {
                title: 'NB 204L 精緻優雅系列',
                description: '細膩的質感氛圍，讓每一步都充滿儀式感，輕鬆綻放優雅。'
            },
            'KAA': {
                title: 'NB 471 律動自在系列',
                description: '穿上 471 釋放輕盈腳感，帶你走得率性，把煩惱一併丟棄。'
            }
        };

        // 分享內容對應表
        this.shareContentMap = this.generateShareContentMap();

        this.init();
    }

    // 生成 Flex Message 內容
    generateShareContentMap() {
        const contentMap = {};

        Object.keys(this.imageUrlMap).forEach(item => {
            const textContent = this.textContentMap[item];
            contentMap[item] = {
                type: 'flex',
                contents: {
                    type: "bubble",
                    hero: {
                        type: "image",
                        url: this.imageUrlMap[item],
                        size: "full",
                        aspectRatio: "1:1.35",
                        aspectMode: "cover"
                    },
                    body: {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: textContent.title,
                                weight: "bold",
                                size: "md",
                                wrap: true
                            },
                            {
                                type: "text",
                                text: textContent.description,
                                size: "sm",
                                color: "#666666",
                                wrap: true
                            }
                        ],
                        spacing: "sm"
                    },
                    footer: {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "button",
                                action: {
                                    type: "uri",
                                    label: "分享心情花語",
                                    uri: "https://maac.io/4FTeT"
                                },
                                style: "link",
                                color: "#3366CC"
                            }
                        ]
                    }
                }
            };
        });

        return contentMap;
    }

    async init() {
        try {
            console.log('Initializing LIFF...');

            // Initialize LIFF
            await liff.init({
                liffId: '1655995729-V0BrK6gq' // Update this with your actual LIFF ID
            });

            if (!liff.isLoggedIn()) {
                console.log('User not logged in, redirecting to login...');
                liff.login();
                return;
            }

            console.log('LIFF initialized successfully');
            await this.handleShareTarget();

        } catch (error) {
            console.error('LIFF initialization failed:', error);
            this.showError('LIFF 初始化失敗: ' + error.message);
        }
    }

    async handleShareTarget() {
        try {
            // Get user profile
            const profile = await liff.getProfile();
            const userId = profile.userId;
            const displayName = profile.displayName;
            console.log('User profile:', profile);

            // 取得 URL 參數中的 item
            const urlParams = new URLSearchParams(window.location.search);
            const item = urlParams.get('item');

            // 驗證 item 參數
            if (!item || !this.shareContentMap[item]) {
                throw new Error(`無效的 item 參數: ${item}. 支援的項目: ${Object.keys(this.shareContentMap).join(', ')}`);
            }

            // 根據 item 取得對應的分享內容
            const shareContent = this.shareContentMap[item];
            console.log('Share content for item:', item, shareContent);

            // 顯示分享資訊
            console.log('📋 分享資訊:', {
                userId: userId,
                item: item,
                content: shareContent.text
            });

            // 執行 LIFF ShareTargetPicker
            await this.executeShareTargetPicker(userId, item, shareContent, displayName);

        } catch (error) {
            console.error('❌ HandleShareTarget error:', error);
            console.error('🔴 處理分享失敗:', error.message);
            this.closeApp();
        }
    }

    async executeShareTargetPicker(userId, item, shareContent, displayName) {
        try {
            console.log('Executing ShareTargetPicker for:', item, shareContent);

            // 使用 LIFF ShareTargetPicker API
            const res = await liff.shareTargetPicker(
                [
                    {
                        type: 'text',
                        text: `${displayName} 把這份心情花語送給你\n讓你的每一步都能像花一樣盛放💐\n\n即日起至 10/19，分享喜歡的心情花語圖，就能獲得抽獎機會！\n新款 NB 204L 鞋履等你來抽✨\n👇🏻一起分享～願你的日常因NB而多一點浪漫🌹`
                    },
                    shareContent,
                ],
                {
                    isMultiple: true,
                }
            );

            if (res) {
                // succeeded in sending a message through TargetPicker
                console.log(`✅ ShareTargetPicker 成功: [${res.status}] Message sent!`);

                // 分享成功，發送請求到後端記錄
                await this.sendShareRequest(userId, item);

            } else {
                // sending message canceled
                console.log("⚠️ TargetPicker was closed!");
                console.log('🔴 分享已取消');
                this.closeApp();
            }

        } catch (error) {
            // something went wrong before sending a message
            console.error('❌ ShareTargetPicker error:', error);
            console.error('🔴 分享失敗:', error.message);
            this.closeApp();
        }
    }


    async sendShareRequest(userId, item) {
        try {
            console.log('Sending share request:', { userId, item });

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: userId,
                    item: item
                })
            });

            const result = await response.json();
            console.log('API response:', result);

            if (response.ok && result.success) {
                console.log('🎉 分享記錄成功:', result);
                console.log('📊 分享結果:', {
                    message: result.message,
                    shareCount: result.data.shareCount,
                    isWithinLimit: result.data.isWithinLimit,
                    maacMessageId: result.data.maacMessageId
                });

                // 分享完成，關閉視窗
                setTimeout(() => {
                    this.closeApp();
                }, 1000); // 延遲 1 秒讓用戶看到 console 訊息
            } else {
                throw new Error(result.message || 'API request failed');
            }

        } catch (error) {
            console.error('❌ Send share request error:', error);
            console.error('🔴 發送分享請求失敗:', error.message);
            this.closeApp();
        }
    }


    closeApp() {
        try {
            if (liff.isInClient()) {
                liff.closeWindow();
            } else {
                window.close();
            }
        } catch (error) {
            console.error('Close app error:', error);
            window.close();
        }
    }
}

// Close app function for global access
function closeApp() {
    try {
        if (typeof liff !== 'undefined' && liff.isInClient()) {
            liff.closeWindow();
        } else {
            window.close();
        }
    } catch (error) {
        console.error('Close app error:', error);
        window.close();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LiffShareTarget();
});

// Handle page errors
window.addEventListener('error', (event) => {
    console.error('❌ Global error:', event.error);
    console.error('🔴 應用程式發生錯誤:', event.error.message);
    closeApp();
});