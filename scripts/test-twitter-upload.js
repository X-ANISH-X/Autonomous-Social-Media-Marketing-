const fs = require('fs');
const path = require('path');
const { TwitterApi } = require('twitter-api-v2');

const SOCIAL_FILE = path.join(process.cwd(), 'data', 'social.json');
const IMAGE_PATH = path.join(process.cwd(), 'public', 'generated', 'a52a5fa9-a0c9-46e1-aae7-7dd2172273a0.png');

async function testUpload() {
    try {
        if (!fs.existsSync(SOCIAL_FILE)) {
            console.error('No social.json found');
            return;
        }

        const accounts = JSON.parse(fs.readFileSync(SOCIAL_FILE, 'utf8'));
        const twitterAccount = accounts.find(a => a.platform === 'twitter');

        if (!twitterAccount) {
            console.error('No Twitter account connected');
            return;
        }

        console.log(`Found Twitter account: @${twitterAccount.username}`);

        // Initialize client with OAuth 2.0 access token
        const client = new TwitterApi(twitterAccount.accessToken);

        if (!fs.existsSync(IMAGE_PATH)) {
            console.error('Example image not found:', IMAGE_PATH);
            return;
        }

        console.log('Uploading media with twitter-api-v2 (OAuth 2.0)...');
        // v1.uploadMedia is usually for OAuth 1.0a, but library might support OAuth 2.0 if scopes allow?
        // Wait, for OAuth 2.0 User Context, standard endpoint is supported but library separates v1/v2 clients.
        // client.v1 refers to v1.1 endpoints. client.v2 refers to v2.

        try {
            const mediaId = await client.v1.uploadMedia(IMAGE_PATH);
            console.log('Upload success! Media ID:', mediaId);

            console.log('Posting tweet with media...');
            const tweet = await client.v2.tweet({
                text: `Testing automation setup ${new Date().toISOString()}`,
                media: { media_ids: [mediaId] }
            });
            console.log('Tweet posted:', tweet.data.id);
        } catch (apiError) {
            console.error('API Error:', apiError);
            if (apiError.data) {
                console.error('Checking data:', JSON.stringify(apiError.data, null, 2));
            }
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

testUpload();
