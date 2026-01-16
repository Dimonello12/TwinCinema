import { DiscordSDK } from "@discord/embedded-app-sdk";
import { DiscordUser } from "../types";
import { CLIENT_ID } from "../constants";

// Lazy load the SDK variable
let discordSdk: DiscordSDK | null = null;
let instanceId: string = "local-dev-room";

// Detect if we are in an iframe (Embedded) or just browser
const queryParams = new URLSearchParams(window.location.search);
const isEmbedded = queryParams.has("frame_id");

// Check if there is an instanceId in the URL for web joins
if (!isEmbedded && queryParams.has("instanceId")) {
    const urlInstanceId = queryParams.get("instanceId");
    if (urlInstanceId) instanceId = urlInstanceId;
}

export const isDiscordEnvironment = () => isEmbedded;

export const initializeDiscordSdk = async (): Promise<DiscordUser> => {
  if (!isEmbedded) {
    console.log("Running in browser environment. Returning mock for Web Flow.");
    // We return a Mock user, but App.tsx will handle the "Landing Page" logic 
    // based on `isDiscordEnvironment()` or the lack of an instanceId
    return mockDiscordSetup();
  }

  if (!discordSdk) {
    discordSdk = new DiscordSDK(CLIENT_ID);
  }

  await discordSdk.ready();

  // Capture the instance ID for the sync service
  if (discordSdk.instanceId) {
    instanceId = discordSdk.instanceId;
  }

  // Authorize with Discord Client
  const { code } = await discordSdk.commands.authorize({
    client_id: CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: [
      "identify",
      "guilds",
    ],
  });

  const response = await fetch("/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  });

  if (!response.ok) {
      throw new Error("Failed to exchange token");
  }

  const { access_token } = await response.json();

  const auth = await discordSdk.commands.authenticate({
    access_token,
  });

  if (auth == null) {
    throw new Error("Authenticate command failed");
  }

  return {
    id: auth.user.id,
    username: auth.user.username,
    discriminator: auth.user.discriminator,
    avatar: auth.user.avatar ?? null,
    public_flags: auth.user.public_flags
  };
};

export const mockDiscordSetup = (): DiscordUser => {
  // Generate a random ID for web users so they don't clash
  const randomId = Math.floor(Math.random() * 1000000).toString();
  return {
    id: `web-user-${randomId}`,
    username: `Guest ${randomId.slice(0, 4)}`,
    discriminator: "0000",
    avatar: null,
  };
};

export const getDiscordSdk = () => discordSdk;
export const getInstanceId = () => instanceId;
export const setInstanceId = (id: string) => { instanceId = id; };