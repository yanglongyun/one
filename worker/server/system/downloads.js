const VERSION = '0.4.0';

const RELEASES = Object.freeze({
    macos: {
        platform: 'macos',
        version: VERSION,
        filename: `one-macos-arm64-${VERSION}.dmg`,
        key: `releases/${VERSION}/one-macos-arm64-${VERSION}.dmg`,
        contentType: 'application/x-apple-diskimage',
    },
    windows: {
        platform: 'windows',
        version: VERSION,
        filename: `one-windows-x64-${VERSION}.exe`,
        key: `releases/${VERSION}/one-windows-x64-${VERSION}.exe`,
        contentType: 'application/vnd.microsoft.portable-executable',
    },
    android: {
        platform: 'android',
        version: VERSION,
        filename: `one-android-${VERSION}.apk`,
        key: `releases/${VERSION}/one-android-${VERSION}.apk`,
        contentType: 'application/vnd.android.package-archive',
    },
    browser: {
        platform: 'browser',
        version: VERSION,
        filename: `one-browser-${VERSION}.zip`,
        key: `releases/${VERSION}/one-browser-${VERSION}.zip`,
        contentType: 'application/zip',
    },
});

export async function releaseManifest(env) {
    const releases = await Promise.all(Object.values(RELEASES).map(async ({ key, contentType, ...release }) => ({
        ...release,
        available: Boolean(await env.DOWNLOADS.head(key)),
        url: `/api/downloads/${release.platform}`,
    })));
    return { version: VERSION, releases };
}

export async function serveDownload(env, platform) {
    const release = RELEASES[platform];
    if (!release) return new Response('not found', { status: 404 });
    const object = await env.DOWNLOADS.get(release.key);
    if (!object) return new Response('package not ready', { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Content-Type', release.contentType);
    headers.set('Content-Disposition', `attachment; filename="${release.filename}"`);
    headers.set('Cache-Control', 'public, max-age=3600');
    headers.set('ETag', object.httpEtag);
    return new Response(object.body, { headers });
}
