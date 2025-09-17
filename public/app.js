// LIFF ShareTarget Application
class LiffShareTarget {
    constructor() {
        this.apiUrl = '/api/share';  // Same origin, no CORS needed

        // 分享內容對應表
        this.shareContentMap = {
            'SWA': {
                type: 'text',
                text: 'Hello, World! 這是 SWA 項目的分享內容'
            },
            'SWB': {
                type: 'text',
                text: 'Hello, World! 這是 SWB 項目的分享內容'
            },
            'SWC': {
                type: 'text',
                text: 'Hello, World! 這是 SWC 項目的分享內容'
            },
            'SWD': {
                type: 'text',
                text: 'Hello, World! 這是 SWD 項目的分享內容'
            }
        };

        this.init();
    }

    async init() {
        try {
            console.log('Initializing LIFF...');

            // Initialize LIFF
            await liff.init({
                liffId: '2000109710-rB1KXDBD' // Update this with your actual LIFF ID
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
            await this.executeShareTargetPicker(userId, item, shareContent);

        } catch (error) {
            console.error('❌ HandleShareTarget error:', error);
            console.error('🔴 處理分享失敗:', error.message);
            this.closeApp();
        }
    }

    async executeShareTargetPicker(userId, item, shareContent) {
        try {
            console.log('Executing ShareTargetPicker for:', item, shareContent);

            // 使用 LIFF ShareTargetPicker API
            const res = await liff.shareTargetPicker(
                [
                    {
                        type: shareContent.type,
                        text: shareContent.text,
                    },
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