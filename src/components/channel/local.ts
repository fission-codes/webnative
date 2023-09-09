import { Channel, ChannelOptions } from "../../channel.js"
import { Implementation } from "./implementation.js"

////////
// 🛠️ //
////////

export function establish(
  options: ChannelOptions
): Promise<Channel> {
  throw new Error("No local channel available just yet.") // NOTE: Do WebRTC implementation?
}

////////
// 🛳️ //
////////

export function implementation(): Implementation {
  return {
    establish,
  }
}
