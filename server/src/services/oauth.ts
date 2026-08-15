import axios from "axios";
import { google } from "googleapis";
import { callbackUrl, config } from "../config.js";
import { createOAuthState, decrypt, encrypt, verifyOAuthState } from "../crypto.js";
import { getConnection, saveConnection } from "../store.js";
import type { Platform, StoredConnection } from "../types.js";

const metaScopes = [
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish"
];

export function getAuthorizationUrl(platform: Platform) {
  const state = createOAuthState(platform);

  if (platform === "youtube") {
    const client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      callbackUrl("youtube")
    );
    return client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      state,
      scope: [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly"
      ]
    });
  }

  if (platform === "tiktok") {
    const params = new URLSearchParams({
      client_key: config.tiktok.clientKey,
      response_type: "code",
      scope: "user.info.basic,video.publish,video.upload",
      redirect_uri: callbackUrl("tiktok"),
      state
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  }

  const params = new URLSearchParams({
    client_id: config.meta.appId,
    redirect_uri: callbackUrl(platform),
    state,
    response_type: "code"
  });

  if (config.meta.loginConfigId) {
    params.set("config_id", config.meta.loginConfigId);
    params.set("override_default_response_type", "true");
  } else {
    params.set("scope", metaScopes.join(","));
  }

  return `https://www.facebook.com/${config.meta.graphVersion}/dialog/oauth?${params.toString()}`;
}

export async function completeOAuth(platform: Platform, code: string, state: string) {
  if (!verifyOAuthState(state, platform)) throw new Error("جلسة الربط انتهت أو غير صالحة");
  if (platform === "youtube") return completeGoogle(code);
  if (platform === "tiktok") return completeTikTok(code);
  return completeMeta(platform, code);
}

async function completeGoogle(code: string) {
  const client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    callbackUrl("youtube")
  );
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const youtube = google.youtube({ version: "v3", auth: client });
  const response = await youtube.channels.list({ part: ["snippet"], mine: true });
  const channel = response.data.items?.[0];
  if (!tokens.access_token || !channel?.id) throw new Error("تعذر قراءة قناة YouTube المرتبطة");

  const connection: StoredConnection = {
    platform: "youtube",
    connected: true,
    accountId: channel.id,
    accountName: channel.snippet?.title ?? "YouTube Channel",
    accessToken: encrypt(tokens.access_token),
    refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : undefined,
    connectedAt: new Date().toISOString()
  };
  await saveConnection(connection);
  return connection;
}

async function completeTikTok(code: string) {
  const body = new URLSearchParams({
    client_key: config.tiktok.clientKey,
    client_secret: config.tiktok.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: callbackUrl("tiktok")
  });
  const tokenResponse = await axios.post("https://open.tiktokapis.com/v2/oauth/token/", body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
  const token = tokenResponse.data as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    open_id?: string;
  };
  if (!token.access_token || !token.open_id) throw new Error("TikTok لم يُرجع بيانات الربط المطلوبة");

  const profile = await axios.get("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  const user = profile.data?.data?.user;
  const connection: StoredConnection = {
    platform: "tiktok",
    connected: true,
    accountId: token.open_id,
    accountName: user?.display_name ?? "TikTok Creator",
    accessToken: encrypt(token.access_token),
    refreshToken: token.refresh_token ? encrypt(token.refresh_token) : undefined,
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : undefined,
    connectedAt: new Date().toISOString()
  };
  await saveConnection(connection);
  return connection;
}

async function completeMeta(platform: "facebook" | "instagram", code: string) {
  const tokenResponse = await axios.get(`https://graph.facebook.com/${config.meta.graphVersion}/oauth/access_token`, {
    params: {
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      redirect_uri: callbackUrl(platform),
      code
    }
  });
  const shortToken = tokenResponse.data?.access_token as string | undefined;
  if (!shortToken) throw new Error("Meta لم تُرجع رمز وصول");

  const longResponse = await axios.get(`https://graph.facebook.com/${config.meta.graphVersion}/oauth/access_token`, {
    params: {
      grant_type: "fb_exchange_token",
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      fb_exchange_token: shortToken
    }
  });
  const userToken = (longResponse.data?.access_token ?? shortToken) as string;
  const pagesResponse = await axios.get(`https://graph.facebook.com/${config.meta.graphVersion}/me/accounts`, {
    params: { fields: "id,name,access_token,instagram_business_account{id,username}", access_token: userToken }
  });
  const pages = pagesResponse.data?.data as Array<{
    id: string;
    name: string;
    access_token: string;
    instagram_business_account?: { id: string; username?: string };
  }> | undefined;
  const page = platform === "instagram"
    ? pages?.find((item) => item.instagram_business_account?.id)
    : pages?.[0];
  if (!page) {
    throw new Error(platform === "instagram"
      ? "لم نجد حساب Instagram Professional مربوطًا بصفحة Facebook"
      : "لم نجد صفحة Facebook يمكن للبرنامج إدارتها");
  }

  const accountId = platform === "instagram" ? page.instagram_business_account!.id : page.id;
  const accountName = platform === "instagram"
    ? `@${page.instagram_business_account!.username ?? page.name}`
    : page.name;
  const connection: StoredConnection = {
    platform,
    connected: true,
    accountId,
    accountName,
    accessToken: encrypt(page.access_token),
    expiresAt: longResponse.data?.expires_in
      ? new Date(Date.now() + Number(longResponse.data.expires_in) * 1000).toISOString()
      : undefined,
    metadata: { pageId: page.id, pageName: page.name },
    connectedAt: new Date().toISOString()
  };
  await saveConnection(connection);
  return connection;
}

export async function getGoogleAuthClient() {
  const connection = await getConnection("youtube");
  if (!connection) throw new Error("حساب YouTube غير متصل");
  const client = new google.auth.OAuth2(config.google.clientId, config.google.clientSecret, callbackUrl("youtube"));
  client.setCredentials({
    access_token: decrypt(connection.accessToken),
    refresh_token: connection.refreshToken ? decrypt(connection.refreshToken) : undefined,
    expiry_date: connection.expiresAt ? new Date(connection.expiresAt).getTime() : undefined
  });
  client.on("tokens", async (tokens) => {
    if (tokens.access_token) connection.accessToken = encrypt(tokens.access_token);
    if (tokens.refresh_token) connection.refreshToken = encrypt(tokens.refresh_token);
    if (tokens.expiry_date) connection.expiresAt = new Date(tokens.expiry_date).toISOString();
    await saveConnection(connection);
  });
  return client;
}
