import axios from 'axios';
import fetch from 'node-fetch';

/**
 * TikTok Downloader & Search
 * Optimized for revid.ai (Search) and TikWM/Siputzx (Download)
 */

export async function tiktokSearch(query) {
    try {
        const { data } = await axios.post('https://www.revid.ai/api/tiktok-search', {
            keywords: query,
            count: 1
        });
        if (data?.videos?.[0]) {
            return data.videos[0];
        }
    } catch (e) {
        console.error('TikTok Search Error:', e.message);
    }
    return null;
}

export async function tiktokDownload(url) {
    // PRIMARY: TIKWM
    try {
        const res = await (await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`)).json();
        if (res?.data) return normalize(res.data);
    } catch {}

    // FALLBACK: SIPUTZX
    try {
        const res = await (await fetch(`https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(url)}`)).json();
        if (res?.data) return normalize(res.data);
    } catch {}

    return null;
}

function normalize(d) {
    return {
        title: d.title || d.desc || '',
        play_count: d.stats?.playCount || d.play_count || 0,
        digg_count: d.stats?.diggCount || d.digg_count || 0,
        comment_count: d.stats?.commentCount || d.comment_count || 0,
        share_count: d.stats?.shareCount || d.share_count || 0,
        author: {
            unique_id: d.author?.unique_id || d.author?.id || '',
            nickname: d.author?.nickname || d.author?.name || ''
        },
        duration: d.duration || 0,
        play: d.video || d.no_watermark || d.play || '',
        music: d.music || d.audio || d.music_info?.play || '',
        images: d.images || d.photo || d.images_url || []
    };
}
