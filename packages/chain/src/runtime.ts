import { ModulesConfig } from "@proto-kit/common";
import { Balances, UInt64 } from "@proto-kit/library";
import { ZKPeer } from "./ZKPeer";

export const modules = {
  Balances,
  ZKPeer: ZKPeer,
};

export const config: ModulesConfig<typeof modules> = {
  Balances: {},
  ZKPeer: {},
};

export default {
  modules,
  config,
};
