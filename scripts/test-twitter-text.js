const fs = require('fs');
const path = require('path');
const { TwitterApi } = require('twitter-api-v2');

const SOCIAL_FILE = path.join(process.cwd(), 'data', 'social.json');

async function testPost() {
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
        const client = new TwitterApi(twitterAccount.accessToken);

        console.log('Posting text tweet with twitter-api-v2...');
        try {
            const tweet = await client.v2.tweet({
                text: `Testing automation setup ${new Date().toISOString()}`
            });
            console.log('Tweet posted successfully:', tweet.data.id);
        } catch (apiError) {
            console.error('API Error:', apiError);
            if (apiError.code) console.error('Error Code:', apiError.code);
            if (apiError.data) console.error('Error Data:', JSON.stringify(apiError.data, null, 2));
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

testPost();
