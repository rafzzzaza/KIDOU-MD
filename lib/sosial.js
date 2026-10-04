import Builder from 'baileys-mbuilder'

const { AIRich } = Builder

export async function sendSocialMedia(conn, jid, quoted) {
    const pp = global.images?.ratio_1_1?.url || 'https://raw.githubusercontent.com/rafzzzaza/gambar/refs/heads/main/ASANAGI_FAMILY.png'

    return await new AIRich(conn)
        .addPost([
            {
                username: global.author || 'Owner',
                profile_url: pp,
                title: global.author || 'Owner',
                subtitle: 'Facebook',
                caption: 'AYO BERTEMAN DI PESNUK',
                verified: true,
                url: global.links?.facebook || 'https://www.facebook.com/share/',
                thumbnail: pp,
                source: 'FACEBOOK',
                footer: 'Facebook',
                deeplink: global.links?.facebook || 'https://www.facebook.com/share/',
                icon: pp,
                orientation: 'LANDSCAPE',
                post_type: 'PHOTO',
                like: 0,
                comment: 0,
                share: 0
            },
            {
                username: global.author || 'Owner',
                profile_url: pp,
                title: global.author || 'Owner',
                subtitle: 'Threads',
                caption: 'bukan threads ini tiktok follow tiktok mimin yh',
                verified: true,
                url: global.links?.tiktok || 'https://www.tiktok.com/@owner',
                thumbnail: pp,
                source: 'THREADS',
                footer: 'Threads',
                deeplink: global.links?.tiktok || 'https://www.tiktok.com/@owner',
                icon: pp,
                orientation: 'LANDSCAPE',
                post_type: 'PHOTO',
                like: 0,
                comment: 0,
                share: 0
            },
            {
                username: global.author || 'Owner',
                profile_url: pp,
                title: global.author || 'Owner',
                subtitle: 'Instagram',
                caption: 'yoo follow ig gw jga',
                verified: true,
                url: global.links?.instagram || 'https://www.instagram.com/owner',
                thumbnail: pp,
                source: 'INSTAGRAM',
                footer: 'Instagram',
                deeplink: global.links?.instagram || 'https://www.instagram.com/owner',
                icon: pp,
                orientation: 'LANDSCAPE',
                post_type: 'PHOTO',
                like: 0,
                comment: 0,
                share: 0
            }
        ])
        .send(jid, { quoted })
}
