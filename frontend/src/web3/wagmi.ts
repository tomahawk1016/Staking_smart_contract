import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { APP_WAGMI_CHAINS, buildTransports } from "../config/networkConfig";

export const config = createConfig({
  chains: APP_WAGMI_CHAINS,
  connectors: [
    injected({
      target: "metaMask",
    }),
    injected(),
  ],
  transports: buildTransports(),
});
