import { ModulesConfig } from "@proto-kit/common";
import { Publish } from "./publish/publish";
import { Publications } from "./publish/publications";
import { Balances, UInt64 } from "@proto-kit/library";

export const modules = {
  Publish,
  Publications,
  Balances,
};

export const config: ModulesConfig<typeof modules> = {
  Publish: {},
  Publications: {},
  Balances: {
    totalSupply: UInt64.from(10000),
  },
};

export default {
  modules,
  config,
};
