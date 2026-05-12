import axios from 'axios';

export class SocialScraperService {
    async scrapeReddit(url: string) {
        try {
            const response = await axios.get('https://www.reddit.com/search.json', {
                params: { q: url, sort: 'new', limit: 25 },
                headers: { 'User-Agent': 'ReachLens/1.0' },
                timeout: 5000
            });

            const posts = response.data?.data?.children || [];
            return {
                count: posts.length,
                posts: posts.map((p: any) => ({
                    title: p.data.title,
                    permalink: `https://reddit.com${p.data.permalink}`,
                    score: p.data.score,
                    subreddit: p.data.subreddit
                }))
            };
        } catch (error) {
            console.error('Reddit scrape failed:', error);
            return { count: 0, posts: [] };
        }
    }

    async scrapeTwitter(url: string) {
        // Twitter is hard without API. 
        // Return 0 for now.
        return { count: 0, posts: [] };
    }
}
