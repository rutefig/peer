import { ModulesConfig } from "@proto-kit/common";
import { Balances, UInt64 } from "@proto-kit/library";
import { Publications } from "./Publication";
import { Reputation } from "./Reputation";
import { ZKPeer } from "./ZKPeer";

export const modules = {
  Balances,
  ZKPeer: ZKPeer,
  Publications: Publications,
  Reputation,
};

export const config: ModulesConfig<typeof modules> = {
  Balances: {},
  ZKPeer: {},
  Publications: {},
  Reputation: {},
};

export default {
  modules,
  config,
};
